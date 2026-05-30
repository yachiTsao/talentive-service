import express, { Request, Response } from "express";
import fs from "fs";
import { runCrawler, CrawlerOptions } from "./crawler";
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

// ── OpenAPI spec ─────────────────────────────────────────────
const BASE_JOB_SCHEMA = {
  type: "object",
  properties: {
    id:       { type: "string", example: "a3f9c021", description: "SHA-256 前 8 碼" },
    title:    { type: "string", example: "前端工程師" },
    company:  { type: "string", example: "範例公司" },
    location: { type: "string", example: "台北市" },
    salary:   { type: "string", example: "60,000–90,000" },
    date:     { type: "string", example: "2026/04/01" },
    url:      { type: "string", example: "https://www.104.com.tw/job/xxxxxxxx" },
    page:     { type: "number", example: 1 },
    source:   { type: "string", example: "104" },
  },
};

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Talentive Service API",
    version: "1.0.0",
    description: "職缺爬蟲服務 API — 支援 104、Yourator、1111 平台並行爬取",
  },
  servers: [{ url: `http://localhost:${process.env.PORT || 3000}` }],
  paths: {
    "/crawl": {
      post: {
        summary: "觸發爬蟲",
        description: "啟動多平台並行爬蟲，回傳本次爬取的所有職缺",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  keyword:   { type: "string",        default: "前端工程師", description: "搜尋關鍵字" },
                  pages:     { type: "number",        default: 1,            description: "各 provider 抓取頁數" },
                  providers: {
                    oneOf: [
                      { type: "array", items: { type: "string" } },
                      { type: "string", description: "逗號分隔字串" },
                    ],
                    default: ["104", "yourator", "1111"],
                    description: "指定平台清單",
                  },
                  delay:  { type: "number",  default: 700,   description: "頁面間延遲（毫秒）" },
                  debug:  { type: "boolean", default: false, description: "啟用 debug HTML 快照" },
                  output: { type: "string",  default: "/app/data/jobs.json", description: "輸出檔路徑（空字串 = 不寫檔）" },
                },
              },
              example: { keyword: "資料工程師", pages: 2, providers: ["104", "yourator"] },
            },
          },
        },
        responses: {
          "200": {
            description: "爬取成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok:         { type: "boolean", example: true },
                    durationMs: { type: "number",  example: 8432 },
                    count:      { type: "number",  example: 2 },
                    data:       { type: "array", items: BASE_JOB_SCHEMA },
                  },
                },
              },
            },
          },
          "409": {
            description: "爬蟲執行中（請稍後再試）",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, message: { type: "string" } } },
              },
            },
          },
          "500": {
            description: "伺服器錯誤",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/last": {
      get: {
        summary: "取得上次爬取結果",
        description: "讀取磁碟上的 jobs.json；若舊版資料缺少 id 欄位，伺服器即時補齊後回傳（不改寫磁碟）",
        responses: {
          "200": {
            description: "職缺陣列",
            content: {
              "application/json": {
                schema: { type: "array", items: BASE_JOB_SCHEMA },
              },
            },
          },
          "404": {
            description: "尚無爬取結果",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, message: { type: "string" } } },
              },
            },
          },
          "500": {
            description: "伺服器錯誤",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        summary: "健康狀態",
        responses: {
          "200": {
            description: "服務狀態",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok:      { type: "boolean", example: true },
                    running: { type: "boolean", example: false },
                    last:    {
                      type: "object",
                      nullable: true,
                      properties: {
                        at:    { type: "string", example: "2026-04-06T12:00:00.000Z" },
                        count: { type: "number", example: 42 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/favorites/{id}": {
      post: {
        summary: "新增職缺至收藏清單",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", pattern: "^[0-9a-f]{8}$" }, description: "8 碼十六進位職缺 id" }],
        responses: {
          "201": { description: "新增成功", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean" }, data: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, company: { type: "string" }, location: { type: "string" }, salary: { type: "string" }, url: { type: "string" }, source: { type: "string" }, savedAt: { type: "string" } } } } } } } },
          "400": { description: "id 格式不合法", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "404": { description: "職缺 id 不存在於爬取結果", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "409": { description: "職缺已在收藏清單中", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "500": { description: "伺服器錯誤", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
        },
      },
      delete: {
        summary: "從收藏清單移除職缺（冪等）",
        parameters: [{ in: "path", name: "id", required: true, schema: { type: "string", pattern: "^[0-9a-f]{8}$" }, description: "8 碼十六進位職缺 id" }],
        responses: {
          "200": { description: "移除成功（或原本不存在）", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: true } } } } } },
          "400": { description: "id 格式不合法", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
          "500": { description: "伺服器錯誤", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
        },
      },
    },
    "/charts": {
      get: {
        summary: "取得圖表統計資料",
        description: "聚合 jobs.json 回傳三張圖表所需統計：來源平台比例、前端技術標籤 Top 3、工作地點分佈，附帶最後爬取時間戳",
        responses: {
          "200": {
            description: "圖表統計資料",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean", example: true },
                    data: {
                      type: "object",
                      properties: {
                        platforms: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              platform: { type: "string", example: "104" },
                              count: { type: "number", example: 42 },
                            },
                          },
                        },
                        tags: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              tag: { type: "string", example: "Vue" },
                              count: { type: "number", example: 30 },
                            },
                          },
                        },
                        locations: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              location: { type: "string", example: "台北市" },
                              count: { type: "number", example: 20 },
                            },
                          },
                        },
                        lastCrawledAt: { type: "string", nullable: true, example: "2026-04-12T08:00:00.000Z" },
                      },
                    },
                  },
                },
              },
            },
          },
          "500": {
            description: "伺服器錯誤",
            content: {
              "application/json": {
                schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } },
              },
            },
          },
        },
      },
    },
    "/favorites": {
      get: {
        summary: "取得依平台分群的收藏清單",
        responses: {
          "200": { description: "分群收藏清單", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: true }, data: { type: "object", additionalProperties: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, company: { type: "string" }, location: { type: "string" }, salary: { type: "string" }, url: { type: "string" }, source: { type: "string" }, savedAt: { type: "string" } } } } } } } } } },
          "500": { description: "伺服器錯誤", content: { "application/json": { schema: { type: "object", properties: { ok: { type: "boolean", example: false }, error: { type: "string" } } } } } },
        },
      },
    },
  },
};

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
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  if (!fs.existsSync(output)) return [];
  const txt = fs.readFileSync(output, "utf-8");
  return JSON.parse(txt) as BaseJob[];
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
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  return output.replace(/[^/\\]*$/, "meta.json");
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

app.post("/crawl", async (req: Request, res: Response) => {
  if (isRunning) {
    return res.status(409).json({ ok: false, message: "Crawler 正在執行中" });
  }
  isRunning = true;
  const started = Date.now();
  try {
    const body = req.body || {};
    if (typeof body.providers === "string") {
      body.providers = body.providers
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    const data = await runCrawler(body as Partial<CrawlerOptions>);
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
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  if (!fs.existsSync(output))
    return res.status(404).json({ ok: false, message: "檔案不存在" });
  try {
    const jobs = readPatchedJobs();
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
