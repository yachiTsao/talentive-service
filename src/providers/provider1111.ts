import { Page } from 'playwright';
import { BaseJob, JobProvider, ProviderOptions } from './types';

// 1111 人力銀行 Provider: 以瀏覽器載入搜尋結果頁，解析 DOM (不呼叫內部 API)
// URL 範例: https://www.1111.com.tw/search/job?ks=關鍵字&page=1
// 職缺卡片 selector: div.job-card
// 主要欄位：
//  - 連結: a[href^="/job/"]
//  - 標題: a[href^="/job/"] h2
//  - 公司: a[href^="/corp/"] h2
//  - 地點: .job-card-condition__text (第一個)
//  - 薪資: .job-card-condition__text (包含 薪 / 面議 / 元) (第二個)
//  - 日期: 卡片內第一個日期字串 (格式 mm / dd) 於手機版區塊 或 job-summary 內
export const Provider1111: JobProvider = {
  name: '1111',
  async fetch(page: Page, options: ProviderOptions): Promise<BaseJob[]> {
    const { keyword, pages, delay, debug } = options;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const results: BaseJob[] = [];

    async function dump(tag: string) {
      if (!debug) return;
      try {
        const html = await page.content();
        require('fs').writeFileSync(`debug-1111-${tag}.html`, html, 'utf-8');
        console.log(`[DEBUG][1111] 輸出 debug-1111-${tag}.html`);
      } catch {}
    }

    for (let p = 1; p <= pages; p++) {
      const url = `https://www.1111.com.tw/search/job?ks=${encodeURIComponent(keyword)}&page=${p}`;
      if (debug) console.log(`[DEBUG][1111] 導航頁面 ${url}`);
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        // 嘗試等待 job-card 出現
        await page.waitForSelector('.job-card', { timeout: 12_000 }).catch(()=>{});

        // 若為懶加載 (滑動以載入更多) - 目前觀察一頁即固定數量，可保留安全滑動幾次
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
          await page.waitForTimeout(700);
        }

        const pageJobs: BaseJob[] = await page.$$eval('.job-card', (cards) => {
          const jobs: BaseJob[] = [];
          for (const card of cards) {
            try {
              const linkA = card.querySelector('a[href^="/job/"]') as HTMLAnchorElement | null;
              if (!linkA) continue;
              const url = linkA.getAttribute('href') || '';
              const titleEl = linkA.querySelector('h2');
              const title = (titleEl?.textContent || linkA.textContent || '').replace(/\s+/g,' ').trim();
              if (!title) continue;
              const corpA = card.querySelector('a[href^="/corp/"]');
              let company = '';
              if (corpA) {
                const h2 = corpA.querySelector('h2');
                company = (h2?.textContent || corpA.textContent || '').replace(/\s+/g,' ').trim();
              }
              // 條件區
              const condTexts = Array.from(card.querySelectorAll('.job-card-condition__text')).map(el => (el as HTMLElement).innerText.trim());
              let location = condTexts[0] || '';
              let salary = '';
              // 嘗試在 condTexts 找薪資 (含 月薪, 年薪, 面議, 元)
              for (const t of condTexts) {
                if (/月薪|年薪|元|面議/.test(t)) { salary = t; break; }
              }
              // 日期: job-summary 或 mobile 顯示區: 含 mm / dd pattern
              let date = '';
              const datePattern = /\b(0?\d{1})\s*\/\s*(\d{1,2})\b/; // e.g. 09 / 17
              const summary = card.querySelector('.job-summary');
              if (summary && datePattern.test(summary.textContent || '')) {
                const m = (summary.textContent || '').match(datePattern); if (m) date = m[0].replace(/\s+/g,'');
              } else {
                // 手機版日期在 card 內第一個 <p> text 之一
                const p = card.querySelector('p');
                if (p && datePattern.test(p.textContent || '')) {
                  const m = (p.textContent || '').match(datePattern); if (m) date = m[0].replace(/\s+/g,'');
                }
              }
              jobs.push({
                title,
                company,
                location,
                salary,
                date,
                url: url.startsWith('http') ? url : ('https://www.1111.com.tw' + url),
                page: 1,
                source: '1111'
              });
            } catch {}
          }
          return jobs.filter(j => j.title && j.url);
        });
        pageJobs.forEach(j => j.page = p);
        if (debug) console.log(`[DEBUG][1111] 第 ${p} 頁擷取 ${pageJobs.length} 筆`);
        results.push(...pageJobs);
        if (p < pages) await sleep(delay);
      } catch (e: any) {
        if (debug) {
          console.log(`[DEBUG][1111] 第 ${p} 頁錯誤: ${e?.message || e}`);
          await dump(`p${p}-error`);
        }
        break;
      }
    }

    return results;
  }
};
