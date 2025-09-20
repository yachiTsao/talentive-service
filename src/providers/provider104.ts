import { Page } from 'playwright';
import { BaseJob, JobProvider, ProviderOptions } from './types';

// 104 Provider：直接呼叫官方搜尋 API
export const Provider104: JobProvider = {
  name: '104',
  async fetch(page: Page, options: ProviderOptions): Promise<BaseJob[]> {
    const { keyword, pages, delay, debug } = options;
    const results: BaseJob[] = [];
    const encoded = encodeURIComponent(keyword);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    let totalPageLimit: number | null = null;

    for (let p = 1; p <= pages; p++) {
      const searchApi = `https://www.104.com.tw/jobs/search/list?keyword=${encoded}&page=${p}&mode=s&jobsource=2018indexpoc`;
      if (debug) console.log(`[DEBUG][104] 請求 ${searchApi}`);
      try {
        const resp = await page.request.get(searchApi, {
          headers: {
            'Referer': 'https://www.104.com.tw/jobs/search/?keyword=' + encoded,
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        });
        if (!resp.ok()) {
          console.warn(`[WARN][104] 第 ${p} 頁失敗: ${resp.status()} ${resp.statusText()}`);
          if (resp.status() === 404) break; else continue;
        }
        const json: any = await resp.json();
        if (totalPageLimit == null) {
          totalPageLimit = json?.data?.page?.totalPage ?? null;
          if (debug && totalPageLimit) console.log(`[DEBUG][104] 總頁數=${totalPageLimit}`);
        }
        const list: any[] = json?.data?.list || [];
        if (!list.length) {
          if (debug) console.log(`[DEBUG][104] 第 ${p} 頁空，停止`);
          break;
        }
        const pageJobs: BaseJob[] = list.map(item => ({
          title: item.jobName || '',
            company: item.custName || '',
            location: item.jobAddrNoDesc || '',
            salary: item.salaryDesc || item.appearSalary || '',
            date: item.appearDate || '',
            url: 'https://www.104.com.tw/job/' + item.jobNo,
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
