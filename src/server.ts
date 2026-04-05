import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import { runCrawler, CrawlerOptions } from "./crawler";
import { runMigrations } from "./db/migrate";

// T007: HealthResponse interface — declared here per constitution VII (no cross-boundary imports)
interface HealthResponse {
  ok: true;
  running: boolean;
  last: { at: string; count: number } | null;
}

const app = express();

// T006: CORS middleware — must come before all routes (FR-003)
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "256kb" }));

let isRunning = false;
let lastMeta: { at: string; count: number } | null = null;

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
    res.json({
      ok: true,
      durationMs: Date.now() - started,
      count: data.length,
      data,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: msg });
  } finally {
    isRunning = false;
  }
});

// T007: satisfies HealthResponse ensures compile-time contract verification (FR-004)
app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, running: isRunning, last: lastMeta } satisfies HealthResponse);
});

app.get("/last", (_req: Request, res: Response) => {
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  if (!fs.existsSync(output))
    return res.status(404).json({ ok: false, message: "檔案不存在" });
  try {
    const txt = fs.readFileSync(output, "utf-8");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(txt);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: msg });
  }
});

// T005: read env vars with defaults (FR-006, FR-009, FR-005)
const port = Number(process.env.PORT || 3000);
const dbPath = process.env.DB_PATH || "./data/talentive.db";
const nodeEnv = process.env.NODE_ENV || "development";

// T005: run migrations before starting the HTTP listener (FR-002)
runMigrations(dbPath);

app.listen(port, () => {
  // T005: structured startup log with port and NODE_ENV (FR-005, constitution VI)
  console.log(`[INFO] server listening on :${port} (${nodeEnv})`);
});
