import { Page } from 'playwright';
import { BaseJob, JobProvider, ProviderOptions } from './types';

// Yourator Provider: 攔截 /api/v4/jobs 解析，失敗再 fallback HTML。
export const ProviderYourator: JobProvider = {
  name: 'yourator',
  async fetch(page: Page, options: ProviderOptions): Promise<BaseJob[]> {
    const { keyword, pages, delay, debug } = options;
    const results: BaseJob[] = [];
    const encoded = encodeURIComponent(keyword);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // --- A) Session Warmup ---
    try {
      const warmupUrl = `https://www.yourator.co/`;
      if (debug) console.log(`[DEBUG][yourator] Session warmup -> ${warmupUrl}`);
      await page.goto(warmupUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await sleep(500);
    } catch (e) {
      if (debug) console.log('[DEBUG][yourator] Warmup 失敗 (可忽略)', e);
    }

    const interesting: { url: string; status: number; size?: number; ctype?: string }[] = [];
    const interceptedPages: Record<number, any> = {};

    const respListener = async (resp: any) => {
      try {
        const url = resp.url();
        if (/yourator\.co\/api\//.test(url) || /\/jobs/.test(url)) {
          const ctype = resp.headers()['content-type'] || '';
          interesting.push({ url, status: resp.status(), ctype });
          if (debug) console.log(`[DEBUG][yourator][response] ${resp.status()} ${url} ctype=${ctype}`);
          const m = url.match(/\/api\/v4\/jobs\?([^#]+)/);
          if (m && resp.status() === 200 && /json/.test(ctype)) {
            try {
              const json = await resp.json();
              const params = new URLSearchParams(m[1]);
              const pageNum = Number(params.get('page') || '1');
              interceptedPages[pageNum] = json;
              if (debug) {
                const fs = require('fs');
                const file = `debug-yourator-api-page${pageNum}.json`;
                fs.writeFileSync(file, JSON.stringify(json, null, 2));
                console.log(`[DEBUG][yourator] 已輸出 ${file}`);
              }
            } catch (e) {
              if (debug) console.log('[DEBUG][yourator] 解析攔截 JSON 失敗', e);
            }
          }
        }
      } catch {}
    };
    page.on('response', respListener);

    async function dumpHtml(tag: string) {
      try {
        const html = await page.content();
        const file = `debug-yourator-${tag}.html`;
        require('fs').writeFileSync(file, html, 'utf-8');
        if (debug) console.log(`[DEBUG][yourator] 已輸出 ${file}`);
      } catch (e) {
        if (debug) console.log('[DEBUG][yourator] dumpHtml 失敗', e);
      }
    }

    for (let p = 1; p <= pages; p++) {
      // --- 1) 直接呼叫 v4 API ---
      const apiUrl = `https://www.yourator.co/api/v4/jobs?page=${p}&term=${encoded}`;
      let pageJobs: BaseJob[] = [];
      try {
        const resp = await page.request.get(apiUrl, {
          headers: {
            'Accept': 'application/json, text/plain, */*',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
            'Referer': `https://www.yourator.co/jobs?term=${encoded}&page=${p}`
          }
        });
        if (resp.ok()) {
          const json: any = await resp.json();
          if (debug) {
            const fs = require('fs');
            const file = `debug-yourator-direct-page${p}.json`;
            fs.writeFileSync(file, JSON.stringify(json, null, 2));
            console.log(`[DEBUG][yourator] 直接呼叫寫出 ${file}`);
          }
          const list = extractJobsArray(json);
          if (Array.isArray(list) && list.length > 0) {
            pageJobs = list.map(item => normalizeJob(item, p));
          } else if (debug) {
            console.log(`[DEBUG][yourator] API json 無 jobs 陣列，鍵： ${JSON.stringify(Object.keys(json))}`);
          }
        }
      } catch (e) {
        if (debug) console.log('[DEBUG][yourator] 直接 API 呼叫失敗', e);
      }

      if (pageJobs.length === 0 && interceptedPages[p]) {
        if (debug) console.log(`[DEBUG][yourator] 使用攔截 JSON page=${p}`);
        const list = extractJobsArray(interceptedPages[p]);
        if (Array.isArray(list) && list.length > 0) {
          pageJobs = list.map(item => normalizeJob(item, p));
        }
      }

      // --- 2) HTML fallback (改為 anchor 解析) ---
      if (pageJobs.length === 0) {
        try {
          const listUrl = `https://www.yourator.co/jobs?term=${encoded}&page=${p}`;
          if (debug) console.log(`[DEBUG][yourator] HTML fallback -> ${listUrl}`);
          await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          try { await page.waitForLoadState('networkidle', { timeout: 10_000 }); } catch {}
          // 滾動幾次觸發 lazy 載入
          let lastCount = 0;
          for (let i = 0; i < 6; i++) {
            const count = await page.$$eval('#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]', els => els.length).catch(()=>0);
            if (count > lastCount) lastCount = count; else break;
            await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
            await page.waitForTimeout(800);
          }
          await page.waitForSelector('#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]', { timeout: 8000 }).catch(()=>{});
          pageJobs = await page.$$eval('#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]', anchors => {
            function pickTitle(lines: string[]): string {
              const pattern = /(工程師|Developer|Engineer|設計|Designer|Manager|Product|行銷|Marketing|PM|資料|Data|Frontend|Backend|Full ?Stack|iOS|Android|QA|DevOps)/i;
              for (const l of lines) if (pattern.test(l)) return l; return lines[0] || '';
            }
            function pickCompany(lines: string[], used: string): string {
              const companyKeywords = /(股份有限公司|有限公司|公司|Studio|Team|Inc\.?|Co\.?|Limited|Ltd\.?)/i;
              for (const l of lines) {
                if (l === used) continue;
                if (companyKeywords.test(l) || (l.length <= 20 && /[A-Za-z0-9]/.test(l))) return l;
              }
              return '';
            }
            function pickSalary(lines: string[]): string { for (const l of lines) if (/\d/.test(l) && /(月|年|萬|k|K|NT|薪|USD)/.test(l)) return l; return ''; }
            function pickLocation(lines: string[]): string { for (const l of lines) if (/(市|區|縣|台北|新北|桃園|台中|台南|高雄|Hsinchu|Taipei|Remote|遠端)/i.test(l)) return l; return ''; }
            return anchors.map(a => {
              const href = a.getAttribute('href') || '';
              const raw = (a as HTMLElement).innerText.split('\n').map(t => t.trim()).filter(Boolean);
              const unique: string[] = []; for (const r of raw) if (!unique.includes(r)) unique.push(r);
              const title = pickTitle(unique);
              const company = pickCompany(unique, title);
              const salary = pickSalary(unique);
              const location = pickLocation(unique);
              return { title, company, location, salary, date: '', url: href.startsWith('http') ? href : ('https://www.yourator.co' + href), page: 1, source: 'yourator' };
            }).filter(j => j.title && j.url);
          });
          pageJobs.forEach(j => j.page = p);
          if (debug) console.log(`[DEBUG][yourator] fallback anchors 擷取 ${pageJobs.length} 筆`);
          if (debug && pageJobs.length === 0) await dumpHtml(`p${p}-empty`);
        } catch (e) {
          if (debug) console.log('[DEBUG][yourator] HTML fallback 失敗', e);
          if (debug) await dumpHtml(`p${p}-error`);
        }
      }

      if (pageJobs.length === 0) {
        if (p === 1) {
          if (debug) console.log('[DEBUG][yourator] 第一頁為 0 筆，停止後續頁');
          break;
        } else {
          if (debug) console.log(`[DEBUG][yourator] 第 ${p} 頁為 0，結束迴圈`);
          break;
        }
      }

      results.push(...pageJobs);
      if (debug) console.log(`[DEBUG][yourator] 第 ${p} 頁累計 ${pageJobs.length} / 總 ${results.length}`);
      if (p < pages) await sleep(delay);
    }

    if (debug && interesting.length) {
      const fs = require('fs');
      fs.writeFileSync('debug-yourator-responses.json', JSON.stringify(interesting, null, 2));
      console.log('[DEBUG][yourator] 已輸出 debug-yourator-responses.json');
    }
    page.off('response', respListener);
    return results;
  }
};

function extractJobsArray(root: any): any[] | undefined {
  if (!root || typeof root !== 'object') return undefined;
  const candidateKeys = ['jobs','data','results','items','list'];
  for (const k of candidateKeys) {
    const v = (root as any)[k];
    if (Array.isArray(v) && v.length && isJobLike(v[0])) return v;
  }
  const queue: any[] = [root];
  let depth = 0;
  while (queue.length && depth < 5) {
    const size = queue.length;
    for (let i=0;i<size;i++) {
      const obj = queue.shift();
      if (obj && typeof obj === 'object') {
        for (const [k,v] of Object.entries(obj)) {
          if (Array.isArray(v) && v.length && isJobLike(v[0])) return v as any[];
          if (v && typeof v === 'object') queue.push(v);
        }
      }
    }
    depth++;
  }
  return undefined;
}

function isJobLike(o: any): boolean {
  if (!o || typeof o !== 'object') return false;
  return 'name' in o || 'title' in o || 'company' in o || 'company_name' in o;
}

function normalizeJob(item: any, page: number): BaseJob {
  return {
    title: item.name || item.title || '',
    company: item.company_name || item.company?.name || '',
    location: (item.city || item.location || '') + '' || '',
    salary: item.salary || item.compensation || '',
    date: item.published_at || item.created_at || '',
    url: item.url || (item.path ? ('https://www.yourator.co' + item.path) : (item.slug ? `https://www.yourator.co/jobs/${item.slug}` : '')),
    page,
    source: 'yourator'
  };
}