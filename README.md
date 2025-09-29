# Talentive (Job Crawler)

以 TypeScript + Playwright 實作的「抓取多平台職缺」小型範例，便於快速批次蒐集 104、Yourator、1111 等站點職缺清單並輸出為 JSON。專案聚焦於：簡潔 CLI、可擴充 Provider 介面、低侵入抓取策略與基礎去重邏輯。

## ✨ 功能特色
- 多來源：目前支援 `104`、`yourator`、`1111` 三個平台，可透過 `--providers` 指定 (逗號分隔)。
- 非侵入式 Yourator 抓取：模擬使用者瀏覽與滾動，不直呼內部 API，降低被偵測風險。
- 104 使用官方公開搜尋 API，加快回應速度。
- 統一輸出格式 (`BaseJob`) 並以 URL 去重。
- 參數化：關鍵字 / 頁數 / 延遲 / 除錯模式 / 指定輸出檔名。
- Debug 輸出：在 `--debug` 模式下保存 HTML 快照以利問題分析。

## 📦 環境需求
- Node.js 18+ (建議 LTS)
- 會自動於 `postinstall` 安裝 Playwright Chromium 瀏覽器
- `npx playwright install-deps` 安裝個瀏覽器所需要的系統層原生依賴套件

## 🚀 安裝
```bash
npm install
```
安裝腳本會自動執行：`playwright install chromium`

## ▶️ 快速開始
最常見的抓取：
```bash
npm run dev -- --keyword=資料工程師 --pages=2 --providers=yourator,104,1111 --delay=700 --output=jobs.json
```
顯示詳細除錯並輸出 HTML：
```bash
npm run dev -- --keyword=資料工程師 --pages=1 --providers=yourator --debug
```

## 🔧 CLI 參數說明
| 參數 | 型態 | 預設 | 說明 |
|------|------|------|------|
| `--keyword` | string | `資料工程師` | 搜尋關鍵字 |
| `--pages` | number | `1` | 要抓取的頁數 (各 provider 會自行停止在實際可用最大頁) |
| `--providers` | string | `104,yourator` | 逗號分隔來源清單 (可用: `104,yourator,1111`) |
| `--delay` | number(ms) | `700` | 各頁之間延遲，避免過快觸發風控 |
| `--output` | string | `jobs.json` | 輸出檔案路徑 (JSON) |
| `--debug` | flag | (false) | 額外輸出 debug HTML（如空頁或錯誤頁） |

## 📁 專案結構
```
src/
  crawler.ts              # 主 CLI：載入選擇的 providers，整合去重並輸出
  providers/
    types.ts              # 型別定義：BaseJob / Provider 介面
    provider104.ts        # 104 實作：呼叫官方搜尋 API
    yourator.ts           # Yourator 實作：模擬瀏覽 + 滾動載入 + DOM 擷取
    provider1111.ts       # 1111 實作：載入搜尋結果頁 + DOM 擷取
```

## 🧠 抓取流程概述
1. 解析 CLI 參數 (關鍵字、頁數、來源、延遲、debug、輸出檔名)。
2. 依來源動態建立 Playwright Page。
3. Provider 執行 `fetch(page, options)` 回傳 `BaseJob[]`：
   - 104：組合搜尋 API URL -> 解析 JSON -> 映射欄位。
   - Yourator：進入首頁（嘗試輸入關鍵字）或直接導向 `jobs?term=...` -> 滾動觸發 lazy load -> 以 anchor DOM 解析文字。
   - 1111：導向搜尋結果頁 -> 滾動 -> DOM 擷取。
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
    "title": "資料工程師",
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

### 現有 providers 策略摘要
| 名稱 | 抓取方式 | 備註 |
|------|----------|------|
| 104 | 官方搜尋 JSON API | 速度快，可得日期、薪資等欄位 |
| yourator | 瀏覽器 DOM + 滾動 | 避免直接打私有 API，使用 anchor 解析 |
| 1111 | 瀏覽器 DOM | 解析 `.job-card`，抽取標題/公司/地點/薪資/日期 |

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

## 🔍 1111 抓取策略 (新增)
1. 直接導向 `https://www.1111.com.tw/search/job?ks=<關鍵字>&page=N`。
2. 等待 `.job-card` 元素載入，向下滾動數次確保懶加載完成。
3. 解析：
  - 連結/標題：`a[href^="/job/"] h2`
  - 公司：`a[href^="/corp/"] h2`
  - 地點：第一個 `.job-card-condition__text`
  - 薪資：條件文字中包含 `月薪/年薪/元/面議`
  - 日期：`job-summary` 或行動版第一個 `<p>` 的 `MM/DD`
4. 日期為原始字串 (不含年份)；可後續再行補全。
5. 無額外 API 呼叫，降低被偵測風險。

## 🛠️ NPM Scripts
| 指令 | 說明 |
|------|------|
| `npm run dev` | 使用 ts-node 直接執行 `src/crawler.ts` |
| `npm run build` | 編譯 TypeScript -> `dist/` |
| `npm start` | 以編譯後 JS 執行 (需先 build) |

## 🐳 使用 Docker
本專案已提供多階段 `Dockerfile`，基於官方 `mcr.microsoft.com/playwright` 映像。

### 建置映像
```bash
docker build -t talentive:latest .
```

### 執行 (輸出 jobs.json 到本機 ./data)
```bash
mkdir -p data
 docker run --rm -v "$(pwd)/data:/app/data" \
  -e KEYWORD=資料工程師 \
  -e PAGES=2 \
  -e PROVIDERS=104,yourator,1111 \
  -e DELAY=700 \
  -e OUTPUT=/app/data/jobs.json \
  talentive:latest
```
結果會出現在 `./data/jobs.json`。

### 除錯模式
```bash
docker run --rm -e KEYWORD=前端工程師 -e DEBUG=true talentive:latest
```
會額外輸出 `debug-*.html` (存在容器工作目錄，可再掛載 volume 取得)。

### 直接覆寫 CLI 參數
`ENTRYPOINT` 會先把環境變數轉成參數，你也可追加參數：
```bash
docker run --rm talentive:latest --pages=1 --providers=104
```

## ☁️ 在 Zeabur 部署
### 1. 建立專案並連接 Repo
- 登入 Zeabur -> New Project -> 連接 GitHub 選擇此倉庫。
- Zeabur 若偵測到 Dockerfile 會自動使用 Docker 部署。

### 2. Build 設定
若使用 Dockerfile：保持預設即可 (Zeabur 會執行 `docker build`).

### 3. 環境變數設定
| 變數 | 說明 | 範例 |
|------|------|------|
| `KEYWORD` | 搜尋關鍵字 | `資料工程師` |
| `PAGES` | 抓取頁數 | `2` |
| `PROVIDERS` | 來源列表 | `104,yourator,1111` |
| `DELAY` | 每頁延遲(ms) | `700` |
| `OUTPUT` | 輸出檔案路徑 | `/app/data/jobs.json` |
| `DEBUG` | 是否除錯 | `false` |

### 4. 持久化輸出 (可選)
目前映像內設定的 `VOLUME /app/data` 會是 ephemeral。若要長期保存：
- Zeabur Volume (若方案支援) 掛載到 `/app/data`
- 或改成將結果上傳到 S3 / GCS / GitHub (需自行加程式)

### 5. 排程 (Cron)
此服務是一次性抓取腳本，適合以 Zeabur 的 Cron Job 執行：
1. 新增一個 Job (非長駐 Web Service) / 或使用 Zeabur 的 Scheduled Task。
2. Cron 表達式範例：
   - 每天 09:10：`10 9 * * *`
   - 每小時：`0 * * * *`
3. Job 指向同一映像 (Zeabur 會重複啟動容器執行後結束)。

### 6. 日誌
- 透過 Zeabur Log 介面可看到 `[INFO]` / `[PROVIDER]` / `[SUMMARY]` 等輸出。
- 錯誤時 exit code != 0，Zeabur 會標示失敗。

### 7. 最佳化建議
- 調整 `PAGES` 與 `DELAY` 避免目標站封鎖
- 若需多組不同關鍵字：建立多個 Cron Job，各自覆寫 `KEYWORD` 與 `OUTPUT`
- 若輸出需要集中：後續可新增將 JSON 上傳物件儲存的程式碼

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
- [x] Docker 化
- [ ] 增加更多平台 (CakeResume, LinkedIn, Indeed...)
- [ ] 結果自動上傳外部儲存 (S3 / GCS)

## 🤝 貢獻
歡迎 PR：
1. Fork & 建立分支
2. 依照上述 Provider 介面新增或優化
3. 描述變更與測試方式

## 📄 授權
未標示授權，視為保留所有權利。若需引用或再發佈，請先洽詢作者。

---
若你覺得這份 README 有幫助，歡迎 Star ⭐️ 支持！
