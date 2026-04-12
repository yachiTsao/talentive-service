import { Page } from 'playwright';
import { JobData, JobProvider, ProviderOptions } from './types';

// 104 Provider：瀏覽推薦頁並截攔 /jobs/search/api/jobs 回應（搭配 stealth 繞過反爬蟲）
export const Provider104: JobProvider = {
  name: '104',
  async fetch(page: Page, options: ProviderOptions): Promise<JobData[]> {
    const { keyword, pages, delay, debug } = options;
    const results: JobData[] = [];
    const encoded = encodeURIComponent(keyword);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    let totalPageLimit: number | null = null;

    for (let p = 1; p <= pages; p++) {
      // 推薦頁會自動呼叫 /jobs/search/api/jobs，可安全截攔
      const seedUrl = `https://www.104.com.tw/jobs/recommend/?jobsource=joblist_search&keyword=${encoded}&page=${p}&mode=s`;
      const apiUrl = `https://www.104.com.tw/jobs/search/api/jobs?keyword=${encoded}&page=${p}&mode=s&jobsource=joblist_search`;
      if (debug) console.log(`[DEBUG][104] 瀏覽第 ${p} 頁`);
      try {
        const captured: { body: string } | null = await new Promise(async (resolve) => {
          let done = false;
          const handler = async (r: any) => {
            if (!done && r.url().includes('/jobs/search/api/jobs')) {
              done = true;
              page.off('response', handler);
              const body = await r.text().catch(() => '');
              resolve({ body });
            }
          };
          page.on('response', handler);
          // 第一頁：瀏覽推薦頁（自然觸發 API）；後續頁：直接 goto API URL
          const gotoUrl = p === 1 ? seedUrl : apiUrl;
          await page.goto(gotoUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 8000));
          if (!done) { page.off('response', handler); resolve(null); }
        });

        if (!captured) {
          console.warn(`[WARN][104] 第 ${p} 頁未攔到 API 回應，停止`);
          break;
        }
        const json: any = JSON.parse(captured.body);
        if (totalPageLimit == null) {
          totalPageLimit = json?.metadata?.pagination?.lastPage ?? null;
          if (debug && totalPageLimit) console.log(`[DEBUG][104] 總頁數=${totalPageLimit}`);
        }
        const list: any[] = json?.data || [];
        if (!list.length) {
          if (debug) console.log(`[DEBUG][104] 第 ${p} 頁空，停止`);
          break;
        }
        const pageJobs: JobData[] = list.map(item => ({
          title: item.jobName || '',
          company: item.custName || '',
          location: item.jobAddrNoDesc || '',
          salary: item.salaryLow && item.salaryHigh
            ? `${item.salaryLow}-${item.salaryHigh}`
            : '',
          date: item.appearDate || '',
          url: item.link?.job || `https://www.104.com.tw/job/${item.jobNo}`,
          page: p,
          source: '104'
        }));
        if (debug) console.log(`[DEBUG][104] 第 ${p} 頁取回 ${pageJobs.length} 筆`);
        results.push(...pageJobs);
        if (totalPageLimit && p >= totalPageLimit) break;
        if (p < pages) await sleep(delay);
      } catch (e: any) {
        console.warn(`[WARN][104] 第 ${p} 頁例外: ${e?.message || e}`);
        break;
      }
    }
    return results;
  }
};
