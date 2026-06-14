import { chromium, Browser, Page } from "playwright";
import fs from "fs";
import path from "path";
import { BaseJob, JobData, JobProvider, ProviderOptions } from "./providers/types";
import { generateId } from "./utils/id";
import { ProviderYourator } from "./providers/yourator";
import { Provider104 } from "./providers/provider104";
import { Provider1111 } from "./providers/provider1111";

export interface CrawlerOptions extends ProviderOptions {
  providers: string[];
  output?: string; // optional: skip writing if undefined
}

// #2: PROVIDER_NAMES 是唯一真相。satisfies 在宣告時強制 key 完整對應，
// 缺少或多餘任何一個 provider 都會立即得到編譯錯誤。
const PROVIDER_NAMES = ["104", "yourator", "1111"] as const;
type ProviderName = (typeof PROVIDER_NAMES)[number];

const registry = {
  yourator: ProviderYourator,
  "104": Provider104,
  "1111": Provider1111,
} satisfies Record<ProviderName, JobProvider>;

// 執行期以 string 查詢的別名，避免在 lookup 點散落強制轉型
const providerByName: Record<string, JobProvider> = registry;

export const KNOWN_PROVIDERS: ReadonlySet<string> = new Set(PROVIDER_NAMES);

// #8: 共用 env 預設值，parseCliArgs 與 mergeOptions 不再各自讀取 process.env
function getEnvDefaults() {
  return {
    keyword:   process.env.KEYWORD   ?? "前端工程師",
    pages:     Number(process.env.PAGES   ?? 1)   || 1,
    delay:     Number(process.env.DELAY   ?? 700)  || 700,
    providers: (process.env.PROVIDERS ?? "104,yourator,1111")
      .split(",").map((s) => s.trim()).filter(Boolean),
    debug:  process.env.DEBUG === "true",
    output: process.env.OUTPUT ?? "/app/data/jobs.json",
  };
}

// CLI parser retained for direct execution usage
function parseCliArgs(): CrawlerOptions {
  const argv = process.argv.slice(2);
  const get = (k: string, def: string) => {
    const hit = argv.find((a) => a.startsWith(`--${k}=`));
    return hit ? hit.split("=").slice(1).join("=") : def;
  };
  const has = (k: string) => argv.includes(`--${k}`);
  const env = getEnvDefaults();
  const pages = Number(get("pages", String(env.pages)));
  const delay = Number(get("delay", String(env.delay)));
  return {
    keyword:   get("keyword", env.keyword),
    pages:     pages > 0 ? pages : 1,
    delay:     isNaN(delay) ? 700 : delay,
    providers: get("providers", env.providers.join(",")).split(",").map((s) => s.trim()).filter(Boolean),
    debug:     has("debug") || env.debug,
    output:    get("output", env.output),
  };
}

function mergeOptions(partial?: Partial<CrawlerOptions>): CrawlerOptions {
  const env = getEnvDefaults();
  return {
    keyword:   partial?.keyword ?? env.keyword,
    pages:     Number(partial?.pages ?? env.pages) || 1,
    delay:     Number(partial?.delay ?? env.delay) || 700,
    providers: partial?.providers?.length ? partial.providers : env.providers,
    debug:     typeof partial?.debug === "boolean" ? partial.debug : env.debug,
    output:    partial?.output === "" ? undefined : (partial?.output ?? env.output),
  };
}

function dedupeByUrl(jobs: JobData[]): JobData[] {
  const map = new Map<string, JobData>();
  for (const j of jobs) if (!map.has(j.url)) map.set(j.url, j);
  return [...map.values()];
}

export function assignIds(jobs: JobData[]): BaseJob[] {
  const seenIds = new Map<string, string>(); // id → url
  const result: BaseJob[] = [];
  for (const job of jobs) {
    const id = generateId(job.url);
    if (seenIds.has(id)) {
      console.warn(
        `[ID COLLISION] id=${id} url1=${seenIds.get(id)} url2=${job.url} 捨棄後者`
      );
      continue;
    }
    seenIds.set(id, job.url);
    result.push({ ...job, id });
  }
  return result;
}

// 每個 provider 的逾時包裝（FR-008）
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  name: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`[${name}] 逾時 (${ms}ms)`)),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function scrapeOnce(opts: CrawlerOptions): Promise<BaseJob[]> {
  let browser: Browser | null = null;
  const all: JobData[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });

    // 各 provider 並行執行（FR-004），每個 provider 使用獨立 Page
    const providerTasks = opts.providers.map(async (name) => {
      const provider = providerByName[name];
      const started = Date.now();
      if (!provider) {
        console.warn(`[WARN] 未知 provider: ${name} (跳過)`);
        return [] as JobData[];
      }
      console.log(`\n[PROVIDER] 開始 ${provider.name}`);
      const page: Page = await browser!.newPage();
      await page.setExtraHTTPHeaders({ "accept-language": "zh-TW,zh;q=0.9" });
      try {
        const jobs: JobData[] = await withTimeout(
          provider.fetch(page, opts),
          120_000,
          name
        );
        console.log(`[PROVIDER] ${provider.name} 回傳 ${jobs.length} 筆 (${Date.now() - started}ms)`);
        return jobs;
      } finally {
        await page.close().catch(() => {});
      }
    });

    const results = await Promise.allSettled(providerTasks);

    // 彙整結果，記錄失敗 provider（FR-005）
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const name = opts.providers[i];
      if (r.status === "fulfilled") {
        all.push(...r.value);
      } else {
        console.warn(
          `[PROVIDER ERROR] name=${name} error=${r.reason?.message ?? r.reason}`
        );
      }
    }
  } finally {
    if (browser) await browser.close();
  }
  const deduped = dedupeByUrl(all);
  const withIds = assignIds(deduped);
  console.log(
    `\n[SUMMARY] 原始=${all.length} 去重後=${deduped.length} id注入後=${withIds.length}`
  );
  return withIds;
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
