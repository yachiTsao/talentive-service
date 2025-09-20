import { Page } from 'playwright';
import { BaseJob, JobProvider, ProviderOptions } from './types';

// Yourator Provider (新版): 不直接呼叫 API。流程: 首頁 -> 搜尋輸入 -> 送出 -> 擷取結果 -> 多頁以 URL 導航。
export const ProviderYourator: JobProvider = {
  name: 'yourator',
  async fetch(page: Page, options: ProviderOptions): Promise<BaseJob[]> {
    const { keyword, pages, delay, debug } = options;
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const results: BaseJob[] = [];

    async function dump(tag: string) {
      if (!debug) return;
      try {
        const html = await page.content();
        require('fs').writeFileSync(`debug-yourator-${tag}.html`, html, 'utf-8');
        console.log(`[DEBUG][yourator] 輸出 debug-yourator-${tag}.html`);
      } catch {}
    }

    // 1) 開啟首頁並輸入關鍵字 (只需第一次)。
    try {
      if (debug) console.log('[DEBUG][yourator] 打開首頁 https://www.yourator.co/');
      await page.goto('https://www.yourator.co/', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      // 嘗試尋找首頁搜尋欄位 (觀察常見 selector)。
      // 若無法定位，直接 fallback 導航到 jobs?term=
      const searchSelectorCandidates = [
        'input[name="term"]',
        'input#search-term',
        'form[action="/jobs"] input[type="text"]',
        'form[action="/jobs"] input[name="keyword"]'
      ];
      let foundSelector: string | null = null;
      for (const sel of searchSelectorCandidates) {
        const el = await page.$(sel);
        if (el) { foundSelector = sel; break; }
      }
      if (foundSelector) {
        if (debug) console.log(`[DEBUG][yourator] 使用搜尋框 selector=${foundSelector}`);
        await page.fill(foundSelector, keyword);
        // 嘗試 Enter 或提交 form
        await page.keyboard.press('Enter');
        // 等待導向 jobs 結果頁
        await page.waitForURL(/\/jobs/, { timeout: 15_000 }).catch(()=>{});
      } else {
        if (debug) console.log('[DEBUG][yourator] 未找到搜尋框，直接導向搜尋結果頁');
        console.log('keywords',keyword)
        await page.goto(`https://www.yourator.co/jobs?sort=most_related&term[]=${keyword}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      }
    } catch (e) {
      if (debug) console.log('[DEBUG][yourator] 首頁搜尋流程失敗，改直接導向結果頁', e);
      await page.goto(`https://www.yourator.co/jobs?sort=most_related&term[]=${keyword}`, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(()=>{});
    }

    // 2) 迭代頁面: 使用 ?term=keyword&page=N，不進行 API request，只靠 HTML/JS 渲染結果。
    for (let p = 1; p <= pages; p++) {
      try {
        if (p > 1) {
          const url = `https://www.yourator.co/jobs?sort=most_related&term=${encodeURIComponent(keyword)}[]&page=${p}`;
          if (debug) console.log(`[DEBUG][yourator] 導航到第 ${p} 頁 -> ${url}`);
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        }

        // 等待 networkidle(若有) + lazy load 滾動
        try { await page.waitForLoadState('networkidle', { timeout: 10_000 }); } catch {}

        let lastCount = 0;
        for (let i = 0; i < 6; i++) {
          const sel = '#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]';
          const count = await page.$$eval(sel, els => els.length).catch(()=>0);
          if (count > lastCount) {
            lastCount = count;
          } else {
            break; // 沒再增加
          }
          await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
          await page.waitForTimeout(800);
        }
        await page.waitForSelector('#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]', { timeout: 8000 }).catch(()=>{});

        const pageJobs: BaseJob[] = await page.$$eval(
          '#normal-jobs a[href^="/companies/"][href*="/jobs/"], #scroll-monitored-jobs a[href^="/companies/"][href*="/jobs/"]',
          (anchors) => {
            function pickTitle(lines: string[]): string {
              const pattern = /(工程師|Developer|Engineer|設計|Designer|Manager|Product|行銷|Marketing|PM|資料|Data|Frontend|Backend|Full ?Stack|iOS|Android|QA|DevOps)/i;
              for (const l of lines) if (pattern.test(l)) return l;
              return lines[0] || '';
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
          }
        );
        pageJobs.forEach(j => j.page = p);
        if (debug) console.log(`[DEBUG][yourator] 第 ${p} 頁擷取 ${pageJobs.length} 筆`);
        if (pageJobs.length === 0) {
          await dump(`p${p}-empty`);
          if (p === 1) break; else break;
        }
        results.push(...pageJobs);
        if (p < pages) await sleep(delay);
      } catch (e: any) {
        if (debug) {
          console.log(`[DEBUG][yourator] 第 ${p} 頁錯誤:`, e?.message || e);
          await dump(`p${p}-error`);
        }
        break;
      }
    }

    return results;
  }
};