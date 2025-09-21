import { chromium, Browser, Page } from 'playwright';
import fs from 'fs';
import { BaseJob, ProviderOptions } from './providers/types';
import { ProviderYourator } from './providers/yourator';
import { Provider104 } from './providers/provider104';
import { Provider1111 } from './providers/provider1111';

interface CliOptions extends ProviderOptions { providers: string[]; output: string; }

function parseArgs(): CliOptions {
  const argv = process.argv.slice(2);
  const get = (k: string, def?: string) => {
    const hit = argv.find(a => a.startsWith(`--${k}=`));
    if (hit) return hit.split('=').slice(1).join('=');
    return def;
  };
  const has = (k: string) => argv.includes(`--${k}`);
  const keyword = get('keyword', '前端工程師')!;
  const pages = Number(get('pages', '1'));
  const delay = Number(get('delay', '700'));
  const providers = get('providers', '104,yourator,1111')!.split(',').map(s => s.trim()).filter(Boolean);
  const debug = has('debug');
  const output = get('output', 'jobs.json')!;
  return {
    keyword,
    pages: pages > 0 ? pages : 1,
    delay: isNaN(delay) ? 700 : delay,
    providers,
    debug,
    output
  };
}

function dedupeByUrl(jobs: BaseJob[]): BaseJob[] {
  const map = new Map<string, BaseJob>();
  for (const j of jobs) {
    if (!map.has(j.url)) map.set(j.url, j);
  }
  return [...map.values()];
}

const registry = {
  'yourator': ProviderYourator,
  '104': Provider104,
  '1111': Provider1111
};

async function run(): Promise<void> {
  const opts = parseArgs();
  console.log(`[INFO] keyword="${opts.keyword}" pages=${opts.pages} delay=${opts.delay} providers=${opts.providers.join(',')} debug=${opts.debug}`);
  let browser: Browser | null = null;
  const all: BaseJob[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
    });

    for (const name of opts.providers) {
      const provider = (registry as any)[name];
      if (!provider) {
        console.warn(`[WARN] 未知 provider: ${name} (跳過)`);
        continue;
      }
      console.log(`\n[PROVIDER] 開始 ${provider.name}`);
      const page: Page = await browser.newPage();
      await page.setExtraHTTPHeaders({ 'accept-language': 'zh-TW,zh;q=0.9' });
      const jobs = await provider.fetch(page, opts);
      console.log(`[PROVIDER] ${provider.name} 回傳 ${jobs.length} 筆`);
      all.push(...jobs);
      await page.close();
    }

    const deduped = dedupeByUrl(all);
    console.log(`\n[SUMMARY] 原始=${all.length} 去重後=${deduped.length}`);
    console.dir(deduped.slice(0,5), { depth: null });
    fs.writeFileSync(opts.output, JSON.stringify(deduped, null, 2), 'utf-8');
    console.log(`[OUTPUT] 已寫入 ${opts.output}`);
  } catch (e) {
    console.error('[ERROR] 執行失敗', e);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

run();