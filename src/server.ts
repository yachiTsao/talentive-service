import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { runCrawler } from "./crawler";
import { openApiSpec } from "./openapi";
import { requireApiKey } from "./middleware/auth";
import { validateCrawlInput } from "./utils/validateCrawl";
import { generateId } from "./utils/id";
import favoritesRouter from "./favorites/router";
import { getFavoriteIds } from "./favorites/store";
import {
  groupByPlatform,
  extractTechTags,
  groupByLocation,
  type ChartStats,
} from "./utils/chartUtils";
import type { BaseJob } from "./providers/types";

const app = express();
app.use(express.json({ limit: "256kb" }));

const JOBS_PATH = process.env.OUTPUT ?? "/app/data/jobs.json";


// ── /docs — Swagger UI (via CDN, no extra npm packages) ──────
app.get("/docs/openapi.json", (_req: Request, res: Response) => {
  res.json(openApiSpec);
});

app.get("/docs", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8" />
  <title>Talentive Service API Docs</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "/docs/openapi.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: "BaseLayout",
      deepLinking: true,
    });
  </script>
</body>
</html>`);
});

/** 讀取 jobs.json；檔案不存在時回傳 []，無效 JSON 時拋出例外 */
function readJobs(): BaseJob[] {
  try {
    return JSON.parse(fs.readFileSync(JOBS_PATH, "utf-8")) as BaseJob[];
  } catch (e: any) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

/** 讀取並補齊舊版缺少 id 的職缺；/last 與 /charts 共用同一資料管道 */
function readPatchedJobs(): BaseJob[] {
  const jobs = readJobs();
  const needsPatch = jobs.some((j: any) => !j.id);
  if (!needsPatch) return jobs;
  return jobs.map((j: any) => {
    if (j.id) return j;
    if (!j.url) {
      console.warn(`[readPatchedJobs] 無法產生 id，缺少 url: ${JSON.stringify(j)}`);
      return { ...j, id: "" };
    }
    return { ...j, id: generateId(j.url) };
  });
}

// ── lastMeta 持久化（meta.json，與 jobs.json 同目錄）────────
function metaPath(): string {
  return path.join(path.dirname(JOBS_PATH), "meta.json");
}

function loadMeta(): { at: string; count: number } | null {
  const p = metaPath();
  try {
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function saveMeta(meta: { at: string; count: number }): void {
  const p = metaPath();
  const tmp = p + ".tmp";
  try {
    fs.writeFileSync(tmp, JSON.stringify(meta), "utf-8");
    fs.renameSync(tmp, p);
  } catch (e) {
    console.warn("[meta] 寫入失敗:", e);
  }
}

let isRunning = false;
let lastMeta: { at: string; count: number } | null = loadMeta();

app.post("/crawl", requireApiKey, async (req: Request, res: Response) => {
  if (isRunning) {
    return res.status(409).json({ ok: false, message: "Crawler 正在執行中" });
  }

  const validation = validateCrawlInput(req.body || {});
  if (!validation.ok) {
    return res.status(validation.status).json({ ok: false, error: validation.error });
  }

  isRunning = true;
  const started = Date.now();
  try {
    const data = await runCrawler(validation.opts);
    lastMeta = { at: new Date().toISOString(), count: data.length };
    saveMeta(lastMeta);
    res.json({
      ok: true,
      durationMs: Date.now() - started,
      count: data.length,
      data,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    isRunning = false;
  }
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, running: isRunning, last: lastMeta });
});

app.get("/last", (_req: Request, res: Response) => {
  try {
    const jobs = readPatchedJobs();
    if (jobs.length === 0) {
      return res.status(404).json({ ok: false, message: "尚無爬取結果" });
    }
    // FR-009/FR-010: attach is_fav from favorites store (no lock needed for read)
    const favIds = getFavoriteIds();
    return res.json(jobs.map((j: any) => ({ ...j, is_fav: favIds.has(j.id) })));
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get("/charts", (_req: Request, res: Response) => {
  try {
    const jobs = readPatchedJobs();
    const stats: ChartStats = {
      platforms: groupByPlatform(jobs),
      tags: extractTechTags(jobs),
      locations: groupByLocation(jobs),
      lastCrawledAt: lastMeta?.at ?? null,
    };
    res.json({ ok: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT || 3000);

// ── Mount routers ────────────────────────────────────────────
app.use('/favorites', favoritesRouter);

app.listen(port, () => {
  console.log(`[API] listening on :${port}`);
});
