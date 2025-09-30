import { chromium, Browser, Page } from "playwright";
import fs from "fs";
import path from "path";
import { BaseJob, ProviderOptions } from "./providers/types";
import { ProviderYourator } from "./providers/yourator";
import { Provider104 } from "./providers/provider104";
import { Provider1111 } from "./providers/provider1111";

export interface CrawlerOptions extends ProviderOptions {
  providers: string[];
  output?: string; // optional: skip writing if undefined
  debug?: boolean;
}

// Registry of provider classes
const registry = {
  yourator: ProviderYourator,
  "104": Provider104,
  "1111": Provider1111,
};

// CLI parser retained for direct execution usage
interface CliOptions extends CrawlerOptions {}

function parseCliArgs(): CliOptions {
  const argv = process.argv.slice(2);
  const get = (k: string, def?: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    if (hit) return hit.split("=").slice(1).join("=");
    return def;
  };
  const has = (k: string) => argv.includes(`--${k}`);
  const keyword = get("keyword", process.env.KEYWORD || "前端工程師")!;
  const pages = Number(get("pages", process.env.PAGES || "1"));
  const delay = Number(get("delay", process.env.DELAY || "700"));
  const providers = get(
    "providers",
    process.env.PROVIDERS || "104,yourator,1111"
  )!
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const debug = has("debug") || process.env.DEBUG === "true";
  const output = get("output", process.env.OUTPUT || "/app/data/jobs.json")!;
  return {
    keyword,
    pages: pages > 0 ? pages : 1,
    delay: isNaN(delay) ? 700 : delay,
    providers,
    debug,
    output,
  };
}

function mergeOptions(partial?: Partial<CrawlerOptions>): CrawlerOptions {
  const envProviders = (process.env.PROVIDERS || "104,yourator,1111")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    keyword: partial?.keyword ?? process.env.KEYWORD ?? "前端工程師",
    pages: Number(partial?.pages ?? process.env.PAGES ?? 1) || 1,
    delay: Number(partial?.delay ?? process.env.DELAY ?? 700) || 700,
    providers:
      partial?.providers && partial.providers.length
        ? partial.providers
        : envProviders,
    debug:
      typeof partial?.debug === "boolean"
        ? partial.debug
        : process.env.DEBUG === "true",
    output:
      partial?.output === ""
        ? undefined
        : partial?.output ?? process.env.OUTPUT ?? "/app/data/jobs.json",
  };
}

function dedupeByUrl(jobs: BaseJob[]): BaseJob[] {
  const map = new Map<string, BaseJob>();
  for (const j of jobs) if (!map.has(j.url)) map.set(j.url, j);
  return [...map.values()];
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function scrapeOnce(opts: CrawlerOptions): Promise<BaseJob[]> {
  let browser: Browser | null = null;
  const all: BaseJob[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    for (const name of opts.providers) {
      const provider = (registry as any)[name];
      if (!provider) {
        console.warn(`[WARN] 未知 provider: ${name} (跳過)`);
        continue;
      }
      console.log(`\n[PROVIDER] 開始 ${provider.name}`);
      const page: Page = await browser.newPage();
      await page.setExtraHTTPHeaders({ "accept-language": "zh-TW,zh;q=0.9" });
      const jobs = await provider.fetch(page, opts);
      console.log(`[PROVIDER] ${provider.name} 回傳 ${jobs.length} 筆`);
      all.push(...jobs);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
  }
  const deduped = dedupeByUrl(all);
  console.log(`\n[SUMMARY] 原始=${all.length} 去重後=${deduped.length}`);
  return deduped;
}

export async function runCrawler(
  partial?: Partial<CrawlerOptions>
): Promise<BaseJob[]> {
  const opts = mergeOptions(partial);
  console.log(
    `[INFO] keyword="${opts.keyword}" pages=${opts.pages} delay=${
      opts.delay
    } providers=${opts.providers.join(",")} debug=${opts.debug} output=${
      opts.output ?? "(skip)"
    }`
  );
  const result = await scrapeOnce(opts);
  if (opts.output) {
    try {
      ensureDirForFile(opts.output);
      fs.writeFileSync(opts.output, JSON.stringify(result, null, 2), "utf-8");
      console.log(`[OUTPUT] 已寫入 ${opts.output}`);
    } catch (e) {
      console.error("[ERROR] 寫檔失敗", e);
    }
  }
  return result;
}

// If executed directly via node dist/crawler.js keep CLI behavior
if (require.main === module) {
  const cli = parseCliArgs();
  runCrawler(cli)
    .then((r) => console.log(`[DONE] 共 ${r.length} 筆`))
    .catch((e) => {
      console.error("[ERROR] 執行失敗", e);
      process.exit(1);
    });
}
