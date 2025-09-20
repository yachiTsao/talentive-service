import { chromium, Browser } from 'playwright';
import fs from 'fs';

interface JobItem {
  title: string;
  company: string;
  location: string;
  salary: string;
  date?: string;
  url: string;
  page: number;
  source: string;
}

interface CliOptions {
  keyword: string;
  pages: number;
  delay: number;
  debug: boolean;
}

function parseArgs(): CliOptions {
  const argv = process.argv.slice(2);
  const get = (k: string, def?: string) => {
    const hit = argv.find(a => a.startsWith(`--${k}=`));
    if (hit) return hit.split('=').slice(1).join('=');
    return def;
  };
  const hasFlag = (k: string) => argv.includes(`--${k}`);
  const keyword = get('keyword', '前端工程師')!;
  const pages = Number(get('pages', '1'));
  const delay = Number(get('delay', '700'));
  const debug = hasFlag('debug');
  return {
    keyword,
    pages: pages > 0 ? pages : 1,
    delay: isNaN(delay) ? 700 : delay,
    debug
  };
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run(): Promise<void> {
  const opts = parseArgs();
  console.log(`[INFO] (yourator) 關鍵字="${opts.keyword}" 預計抓取頁數=${opts.pages} delay=${opts.delay}ms debug=${opts.debug}`);
  let browser: Browser | null = null;
  const encoded = encodeURIComponent(opts.keyword);

  const all: JobItem[] = [];
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'accept-language': 'zh-TW,zh;q=0.9' });

    for (let p = 1; p <= opts.pages; p++) {
      const listUrl = `https://www.yourator.co/jobs?term=${encoded}&page=${p}`;
      console.log(`[PAGE ${p}] 打開 ${listUrl}`);
      try {
        await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        // 等待網路靜止，確保前端 JS 把職缺渲染出來
        try { await page.waitForLoadState('networkidle', { timeout: 10_000 }); } catch {}

        // 滾動幾次以觸發 lazy / infinite 區塊 (#scroll-monitored-jobs)
        let lastCount = 0;
        for (let i = 0; i < 6; i++) {
          const count = await page.$$eval('#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]', els => els.length).catch(()=>0);
          if (count > lastCount) {
            lastCount = count;
          } else {
            // 沒新增就結束
            break;
          }
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
          await page.waitForTimeout(800);
        }

        // 確保至少有一個 anchor
        await page.waitForSelector('#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]', { timeout: 8000 }).catch(()=>{});

        const pageJobs: JobItem[] = await page.$$eval(
          '#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]',
          (anchors) => {
            function pickTitle(lines: string[]): string {
              const pattern = /(工程師|Developer|Engineer|設計|Designer|Manager|Product|行銷|Marketing|PM|資料|Data|Frontend|Backend|Full ?Stack|iOS|Android|QA|DevOps)/i;
              for (const l of lines) if (pattern.test(l)) return l;
              return lines[0] || '';
            }
            function pickCompany(lines: string[], used: string): string {
              const companyKeywords = /(股份有限公司|有限公司|公司|Studio|Team|Inc\.?|Co\.?|Limited|Ltd\.?)/i;
              let best = '';
              for (const l of lines) {
                if (l === used) continue;
                if (companyKeywords.test(l) || (l.length <= 20 && /[A-Za-z0-9]/.test(l))) {
                  best = l; break;
                }
              }
              return best;
            }
            function pickSalary(lines: string[]): string {
              for (const l of lines) if (/\d/.test(l) && /(月|年|萬|k|K|NT|薪|USD|USD)/.test(l)) return l;
              return '';
            }
            function pickLocation(lines: string[]): string {
              for (const l of lines) if (/(市|區|縣|台北|新北|桃園|台中|台南|高雄|Hsinchu|Taipei|Remote|遠端)/i.test(l)) return l;
              return '';
            }
            return anchors.map(a => {
              const href = a.getAttribute('href') || '';
              // 收集可見文字
              const raw = (a as HTMLElement).innerText.split('\n').map(t => t.trim()).filter(Boolean);
              const unique: string[] = [];
              for (const r of raw) if (!unique.includes(r)) unique.push(r);
              const title = pickTitle(unique);
              const company = pickCompany(unique, title);
              const salary = pickSalary(unique);
              const location = pickLocation(unique);
              return {
                title,
                company,
                location,
                salary,
                date: '',
                url: href.startsWith('http') ? href : ('https://www.yourator.co' + href),
                page: 1,
                source: 'yourator'
              };
            }).filter(j => j.title && j.url);
          }
        );
        pageJobs.forEach(j => j.page = p);
        console.log(`[PAGE ${p}] 擷取 ${pageJobs.length} 筆 (anchors)`);
        if (pageJobs.length === 0) {
          if (opts.debug) {
            const html = await page.content();
            fs.writeFileSync(`debug-yourator-p${p}-empty.html`, html, 'utf-8');
            console.log(`[DEBUG] 已輸出 debug-yourator-p${p}-empty.html`);
          }
          break;
        }
        all.push(...pageJobs);
      } catch (e: any) {
        console.warn(`[WARN] 第 ${p} 頁抓取失敗:`, e?.message || e);
        if (opts.debug) {
          const html = await page.content().catch(()=> '');
          fs.writeFileSync(`debug-yourator-p${p}-error.html`, html, 'utf-8');
        }
        break;
      }

      if (p < opts.pages) await sleep(opts.delay);
    }

    console.log(`\n[SUMMARY] 總計 ${all.length} 筆，實際頁數=${[...new Set(all.map(j=>j.page))].length}`);
    console.dir(all.slice(0,5), { depth: null });
    fs.writeFileSync('jobs-yourator.json', JSON.stringify(all, null, 2), 'utf-8');
    console.log('[OUTPUT] 已寫入 jobs-yourator.json');
  } catch (err) {
    console.error('[ERROR] 執行失敗:', err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

run();
