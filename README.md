

# Talentive (Job Crawler)

以 TypeScript + Playwright 實作的「多平台職缺抓取」小型範例，便於快速批次蒐集 104、Yourator 等站點職缺清單並輸出為 JSON。專案聚焦於：簡潔 CLI、可擴充 Provider 介面、低侵入抓取策略與基礎去重邏輯。

## ✨ 功能特色
- 多來源：目前支援 `104`、`yourator` 兩個平台，可透過 `--providers` 指定 (逗號分隔)。
- 非侵入式 Yourator 抓取：模擬使用者瀏覽與滾動，不直呼內部 API，降低被偵測風險。
- 104 使用官方公開搜尋 API，加快回應速度。
- 統一輸出格式 (`BaseJob`) 並以 URL 去重。
- 參數化：關鍵字 / 頁數 / 延遲 / 除錯模式 / 指定輸出檔名。
- Debug 輸出：在 `--debug` 模式下保存 HTML 快照以利問題分析。

## 📦 環境需求
- Node.js 18+ (建議 LTS)
- 會自動於 `postinstall` 安裝 Playwright Chromium 瀏覽器

## 🚀 安裝
```bash
npm install
```
安裝腳本會自動執行：`playwright install chromium`

## ▶️ 快速開始
最常見的抓取：
```bash
npm run dev -- --keyword=前端工程師 --pages=2 --providers=yourator,104 --delay=700 --output=jobs.json
```
顯示詳細除錯並輸出 HTML：
```bash
npm run dev -- --keyword=資料工程師 --pages=1 --providers=yourator --debug
```

## 🔧 CLI 參數說明
| 參數 | 型態 | 預設 | 說明 |
|------|------|------|------|
| `--keyword` | string | `前端工程師` | 搜尋關鍵字 |
| `--pages` | number | `1` | 要抓取的頁數 (各 provider 會自行停止在實際可用最大頁) |
| `--providers` | string | `104,yourator` | 逗號分隔來源清單 |
| `--delay` | number(ms) | `700` | 各頁之間延遲，避免過快觸發風控 |
| `--output` | string | `jobs.json` | 輸出檔案路徑 (JSON) |
| `--debug` | flag | (false) | 額外輸出 debug HTML（如空頁或錯誤頁） |

## 📁 專案結構
```
src/
  crawler.ts              # 主 CLI：載入選擇的 providers，整合去重並輸出
  yourator-crawler.ts     # 單獨實驗 / 範例版 Yourator 爬取腳本
  providers/
    types.ts              # 型別定義：BaseJob / Provider 介面
    provider104.ts        # 104 實作：呼叫官方搜尋 API
    yourator.ts           # Yourator 實作：模擬瀏覽 + 滾動載入 + DOM 擷取
```

## 🧠 抓取流程概述
1. 解析 CLI 參數 (關鍵字、頁數、來源、延遲、debug、輸出檔名)。
2. 依來源動態建立 Playwright Page。
3. Provider 執行 `fetch(page, options)` 回傳 `BaseJob[]`：
   - 104：組合搜尋 API URL -> 解析 JSON -> 映射欄位。
   - Yourator：進入首頁（嘗試輸入關鍵字）或直接導向 `jobs?term=...` -> 滾動觸發 lazy load -> 以 anchor DOM 解析文字。
4. 聚合所有來源資料 -> 以 URL 去重 -> 輸出 JSON。
5. Debug 模式下將異常或空結果頁寫入 `debug-*.html`。

## 🗃️ 資料格式 (BaseJob)
```ts
interface BaseJob {
  title: string;      // 職稱
  company: string;    // 公司名稱 (簡單抽取，可能需再清洗)
  location: string;   // 地點 (關鍵字匹配估測)
  salary: string;     // 薪資 (原字串，未進行數值正規化)
  date?: string;      // 日期 (104 有, Yourator 目前空)
  url: string;        // 原始職缺連結
  page: number;       // 來源頁碼
  source: string;     // provider 名稱
}
```

範例輸出：
```jsonc
[
  {
    "title": "前端工程師",
    "company": "範例公司",
    "location": "台北市",
    "salary": "面議",
    "date": "2025/09/18",
    "url": "https://www.104.com.tw/job/xxxxxxxx",
    "page": 1,
    "source": "104"
  }
]
```

## 🧩 擴充新 Provider
1. 建立檔案：`src/providers/foo.ts`
2. 匯入型別：`import { JobProvider, BaseJob, ProviderOptions } from './types';`
3. 實作：
   ```ts
   export const ProviderFoo: JobProvider = {
     name: 'foo',
     async fetch(page, opts) {
       // 1. 導航或呼叫 API
       // 2. 解析 -> 組成 BaseJob 陣列
       return [] as BaseJob[];
     }
   };
   ```
4. 於 `crawler.ts` 的 `registry` 加入：`'foo': ProviderFoo`
5. 執行：`npm run dev -- --providers=foo --keyword=...`

建議：
- 盡量使用站點提供的公開 API；若無，採 Page DOM 擷取並保持節奏。
- 避免同時大量開分頁；目前策略為一 provider 一個 page（較保守）。

## 🔍 Yourator 抓取策略重要改動 (2025-09)
新版改為「不直接呼叫內部 `/api/v4/jobs`」，改以：
1. 進入首頁嘗試搜尋；失敗則直接導向結果頁。
2. 使用 `?term=關鍵字&page=N` 逐頁。
3. 監測 `#normal-jobs`、`#scroll-monitored-jobs` 中的 anchor。
4. 模擬滾動以觸發 lazy load，直到職缺數不再增加或達內部迴圈上限。
5. 文字解析策略以關鍵字 heuristics 抽取 title/company/location/salary。

## 🛠️ NPM Scripts
| 指令 | 說明 |
|------|------|
| `npm run dev` | 使用 ts-node 直接執行 `src/crawler.ts` |
| `npm run build` | 編譯 TypeScript -> `dist/` |
| `npm start` | 以編譯後 JS 執行 (需先 build) |

## ⚠️ 法律與使用注意
- 僅供學術 / 技術研究示範，請遵守各網站服務條款與 robots 規範。
- 不建議高頻或大規模併發抓取。
- 如需商業使用，請評估風險並取得授權。

## 🧪 待改進 / Roadmap
- [ ] 公司 / 地點 / 薪資文字正規化與欄位清洗 (正則 + NLP)
- [ ] 加入重試 / 失敗自動跳頁策略
- [ ] Proxy / Header Pool 支援
- [ ] 更完整的日誌與結構化輸出 (e.g. NDJSON)
- [ ] 測試框架 (unit + provider mock) 與 CI
- [ ] Docker 化
- [ ] 增加更多平台 (CakeResume, LinkedIn, Indeed...)

## 🤝 貢獻
歡迎 PR：
1. Fork & 建立分支
2. 依照上述 Provider 介面新增或優化
3. 描述變更與測試方式

## 📄 授權
未標示授權，視為保留所有權利。若需引用或再發佈，請先洽詢作者。

---
若你覺得這份 README 有幫助，歡迎 Star ⭐️ 支持！
