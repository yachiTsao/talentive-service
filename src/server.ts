import express, { Request, Response } from "express";
import fs from "fs";
import { runCrawler, CrawlerOptions } from "./crawler";

const app = express();
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
    const txt = fs.readFileSync(output, "utf-8");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(txt);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`[API] listening on :${port}`);
});
