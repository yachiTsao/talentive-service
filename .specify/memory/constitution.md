<!--
同步影響報告
============
版本變更：1.0.0 → 1.1.0
升版理由：MINOR — 新增設計哲學原則（P1–P6）、架構哲學（3.1–3.4）、
          架構決策紀錄（ADR-001~006）、已知限制與待決策問題
修改原則：無（原有 I–VII 未異動）
新增區塊：
  - 文件目的
  - 設計哲學優先原則（P1–P6）
  - 架構哲學（層次邊界、倫理邊界、樂觀更新契約、錯誤處理哲學）
  - 架構決策紀錄（ADR）
  - 已知限制與待決策問題
  - 修訂紀錄
移除區塊：無
模板更新：
  ✅ .specify/templates/plan-template.md — 憲法審查關卡已補充 P2/P3/P4/P5/P6
延遲待辦：無
-->

# Talentive Service 憲法

## 文件目的

本憲法同時扮演兩個角色：

- **技術規範**：規定 Provider 介面契約、Schema 穩定性、資源管理等不可妥協的工程紀律。
- **設計哲學**：回答「為什麼這樣設計」，而非「怎麼設計」。SDD 描述 _what_ 與 _how_，憲法描述 _why_ 與 _trade-off_。

每當開發者面臨取捨，或對某個設計感到困惑時，**應先查閱本文件**。
若找不到答案，代表需要新增一條原則或 ADR。

---

## 設計哲學優先原則

以下六條原則依優先順序排列。當兩條原則衝突時，序號較小者優先。

| 編號 | 原則                     | 說明                                                                                                                         |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| P1   | **使用者優先**           | 任何設計決策的最終衡量標準是「對使用者搜尋職缺的體驗有沒有幫助」。技術上的優雅不能以犧牲使用者體驗為代價。                   |
| P2   | **誠實回應勝於假裝成功** | 爬蟲失敗時，應回傳 partial result 並標示來源錯誤，不回傳空陣列也不拋 500。使用者有權知道「1111 目前無法取得資料」。          |
| P3   | **本地優先，零依賴部署** | 後端應在 clone 後執行兩個指令即可啟動，不依賴外部 DB 服務、訊息佇列或雲端 API。SQLite 是這個原則的體現。                     |
| P4   | **快取是禮貌，不是作弊** | 對目標平台的每次請求都有成本（被封鎖的風險、伺服器負擔）。TTL 快取是對目標平台的尊重，不是為了效能優化。                     |
| P5   | **爬蟲邏輯隔離**         | 每個平台的爬蟲是獨立模組，不共用解析邏輯。一個平台改版**只能**影響一個 scraper 檔案，不得波及其他平台或 API 層。             |
| P6   | **型別即文件**           | TypeScript interface 是最準確的 API 合約文件。回傳型別的修改**必須**同步更新 `types.ts`，不允許 `any` 逃逸到 route handler。 |

---

## 技術實作原則

以下七條原則為工程層面的強制規範，所有功能計畫**必須**逐一通過。

### I. Provider 介面契約（不可違反）

所有職缺資料來源**必須（MUST）**實作定義於 `src/providers/types.ts` 的 `JobProvider` 介面：

```ts
interface JobProvider {
  name: string;
  fetch(page: Page, options: ProviderOptions): Promise<BaseJob[]>;
}
```

- Provider **必須**在使用前於 `crawler.ts` 的 `registry` 映射中完成註冊。
- Provider **必須**保持無狀態（stateless）——不同呼叫之間不得存在共用可變狀態。
- Provider **不得**與其他 Provider 共用同一個 `Page` 實例；每個 Provider 必須獲得獨立的頁面。
- `BaseJob` 輸出 Schema（`title`、`company`、`location`、`salary`、`date?`、`url`、`page`、`source`）
  為標準資料契約，所有 Provider **必須**完整回傳；`url` **必須**非空字串。

**設計理由**：Registry 模式讓新增 Provider 不需修改呼叫端邏輯，零摩擦擴充。
強制頁面隔離可防止某 Provider 的狀態污染其他 Provider 的抓取結果。（對應 P5）

### II. 非侵入式爬蟲

- Provider **必須**遵守 `delay` 參數（毫秒）作為分頁請求之間的等待時間，
  避免觸發平台的速率限制或反爬蟲機制。請求間隔不得低於 500ms；高峰期應加入 jitter 至 1500ms。
- 當目標網站未公開文件化的 API 時，Provider **必須**模擬真實使用者行為
  （例如：滾動觸發懶加載、設定 `accept-language`、`User-Agent` 請求標頭）。
- 若目標平台提供公開且有文件的 API（例如 104 搜尋端點），Provider **可以（MAY）**
  直接呼叫以降低風險並加速回應。
- Provider **不得**儲存、記錄或再傳送超出 `BaseJob` 欄位模型的個人資料。
- Debug HTML 快照**只能**在 `debug: true` 明確設定時才可寫入；**不得**提交至版本庫。

**設計理由**：本專案的核心價值在於以低偵測率持續存取職缺資料。（對應 P4）

### III. 雙介面：CLI + HTTP API

- 爬蟲**必須**同時可作為獨立 CLI（`crawler.ts` 的 `require.main === module` 路徑）
  及 HTTP 服務（`server.ts`）使用。
- 設定值解析**必須**遵循以下優先順序（高 → 低）：
  1. 呼叫時明確傳入的參數 / HTTP 請求 body 欄位
  2. 環境變數（`KEYWORD`、`PAGES`、`DELAY`、`PROVIDERS`、`OUTPUT`、`DEBUG`）
  3. `mergeOptions` 中的硬式預設值
- 當呼叫端僅需要記憶體內結果時（例如 HTTP `/crawl` 端點直接回傳 `data`），
  `output` 路徑**可以（MAY）**省略（`undefined`）。
- 新增的設定參數**必須**在 CLI 與 HTTP 兩個介面上保持一致地公開。

**設計理由**：Docker 部署透過環境變數設定；本地開發使用 CLI 旗標；
HTTP 層則開放給前端整合。三個通道**必須**保持同步。（對應 P3）

### IV. 輸出 Schema 穩定性

- `BaseJob` 的欄位名稱與型別是**有版本控制的公開契約**。
- 新增可選欄位屬於 MINOR 版本升級；欄位**必須**宣告為可選（`field?: type`）
  以維持向下相容。
- 移除或重新命名欄位屬於 MAJOR 版本升級，**必須**在 `CHANGELOG` 中附上遷移說明，
  並更新下游使用者（`talentive-web`）。
- 以 URL 為基礎的去重邏輯（`dedupeByUrl`）為標準作法——
  相同 `url` 的重複職缺**必須**靜默丟棄，保留第一筆。

**設計理由**：`talentive-web` 及未來的使用者依賴穩定的 Schema 來渲染職缺卡片。
靜默的欄位重新命名會造成靜默的渲染錯誤，難以追蹤。（對應 P6）

### V. 並發安全與資源釋放

- HTTP API **必須**透過 `isRunning` 互斥鎖，以 HTTP `409 Conflict` 拒絕
  並發的爬取請求。每個 server 程序同一時間**必須**只有一個活躍的 Playwright 瀏覽器。
- 瀏覽器資源（`Browser`、`Page`）**必須**在 `finally` 區塊中釋放，
  確保即使 Provider 層拋出例外，資源仍可被清理。
- Provider **必須**在 `fetch()` 完成後關閉其 `Page`；`crawler.ts` **必須**
  在外層 `finally` 中關閉 `Browser`。
- 伺服器端錯誤回應**不得**將內部錯誤堆疊追蹤洩漏給客戶端——僅允許回傳 `e.message`。

**設計理由**：Playwright Chromium 實例記憶體佔用量大。在容器化環境中洩漏的瀏覽器會耗盡記憶體，導致 OOM 強制終止。

### VI. 可觀測性

- 所有重要的執行期事件**必須**使用結構化的 console-log 前綴：
  `[INFO]`、`[WARN]`、`[ERROR]`、`[PROVIDER]`、`[SUMMARY]`、`[OUTPUT]`、`[DEBUG]`。
- Debug 模式（`debug: true`）對於任何空結果或錯誤頁面，**必須**輸出命名為
  `debug-<provider>-<tag>.html` 的 HTML 快照檔案。
- `/health` GET 端點**必須**始終以 JSON 物件回應，
  至少包含 `{ ok: boolean, running: boolean, last: { at, count } | null }`。
- `/last` GET 端點**必須**回傳最後寫入的職缺 JSON，
  或在檔案不存在時回傳 `404`——**不得**拋出未處理的錯誤。

**設計理由**：無介面的瀏覽器爬蟲在許多邊界情況下（selector 漂移、網路逾時、版面變更）
會靜默失敗。結構化日誌與 Debug 快照是生產環境中最主要的診斷工具。（對應 P2）

### VII. 型別安全與簡潔

- 所有原始碼**必須**在 `strict: true` 下通過 `tsc` 編譯（不得對專案自身程式碼
  使用 `--skipLibCheck` 規避）。
- 明確的 `any` 型別轉換**只允許**出現在兩處：
  Provider registry 查找（`(registry as any)[name]`）以及瀏覽器執行的 DOM 回呼
  （`page.$$eval` 閉包，此處 TypeScript 無法推斷 DOM 型別）。
- **不得**出於推測而新增功能。遵循 YAGNI 原則：若新 Provider、欄位或路由
  不在當前功能規格中，則**不得**引入。
- 依賴**必須**維持最小化：runtime 僅 `playwright` + `express`；
  開發用僅 `typescript` + `ts-node` + `@types/*`。

**設計理由**：精簡且型別安全的程式碼能降低 selector 漂移、Provider 需更新時的維護負擔。
推測性程式碼只會增加無謂的技術債。（對應 P6）

---

## 架構哲學

### 3.1 層次職責邊界

後端分為三層，每層**只做自己的事**：

- **Route 層**：只做 HTTP 的事——解析 query params、驗證輸入格式、選擇 HTTP status code。
  **不含業務邏輯**。
- **Service / Scraper 層**：執行業務邏輯——協調爬蟲、注入 `isFavorite`、合併結果。
  **不直接操作 HTTP 物件**（`req` / `res`）。
- **DB 層**：只做 SQLite 的事——CRUD favorites。**不含任何業務判斷**。

> 違規範例：在 route handler 裡直接 `new Playwright page`，或在 scraper 裡判斷 HTTP
> status code，都屬於跨層越界。

### 3.2 爬蟲的倫理邊界

本專案的爬蟲遵守以下邊界，超出此範圍的功能需求應**拒絕實作**：

- 只爬取公開可見的職缺列表與詳細頁，不嘗試繞過登入牆。
- 遵守目標網站 robots.txt 中未明確封鎖的路徑。
- 請求間隔不低於 500ms，高峰期加入 jitter 至 1500ms（對應技術原則 II）。
- 不儲存任何使用者個資或履歷資料。
- User-Agent 不偽裝成特定瀏覽器版本，使用通用 headless 標識。

### 3.3 樂觀更新的契約

前端 FavoriteStore 採用樂觀更新策略，這對後端有以下隱含要求：

- **`POST /api/favorites/:jobId`**：**必須**是冪等操作。重複收藏同一職缺不應回傳錯誤，
  應回傳 `201` 或 `200`。
- **`DELETE /api/favorites/:jobId`**：刪除不存在的收藏應回傳 `200`，不應回傳 `404`
  （因為樂觀更新可能已先刪除本地狀態）。
- **回應時間**：Favorites API **必須**在 50ms 內回應（SQLite 同步讀寫），
  不得因爬蟲慢而拖慢收藏操作。

### 3.4 錯誤處理哲學

錯誤分為兩類，處理方式不同（對應設計原則 P2）：

- **可預期錯誤（Expected）**：目標網站暫時無法存取、selector 找不到元素、rate limit。
  這類錯誤**應被捕捉**，回傳 partial result 並記錄 `[WARN]` log。
- **不可預期錯誤（Unexpected）**：程式碼 bug、型別錯誤、DB 損毀。
  這類錯誤**應拋出**並由 Express 全域錯誤 middleware 捕捉，回傳 `500`。

> 原則：寧可回傳不完整的資料，也不要讓整個 API 回傳 500。
> 使用者看到「Yourator 暫時無法取得」比看到空白頁面好。

---

## 架構決策紀錄（ADR）

| ADR-ID  | 決策                                 | 理由 / 取捨                                                                                                           | 狀態      |
| ------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------- |
| ADR-001 | 使用 SQLite 而非 PostgreSQL          | 本地開發零依賴（P3）。favorites 寫入頻率低，不需要關聯式 DB 的並發能力。未來若需多使用者支援可遷移至 PostgreSQL。     | ✅ 已採用 |
| ADR-002 | Playwright 而非 Puppeteer 或 Cheerio | Playwright 支援多 browser context 共用 browser instance，pool 管理更自然。Cheerio 無法處理 SPA（1111 需要 JS 渲染）。 | ✅ 已採用 |
| ADR-003 | In-memory Map 快取而非 Redis         | Redis 違反 P3（零依賴部署）。快取需求簡單（TTL key-value），Map 足夠。缺點：重啟後快取清空，可接受。                  | ✅ 已採用 |
| ADR-004 | 不實作使用者驗證                     | MVP 階段為單人本地工具，驗證帶來複雜度但無實際安全效益。若未來需要多人協作再追加（見待決策 Q2）。                     | ✅ 已採用 |
| ADR-005 | `isFavorite` 在 API 層注入而非爬蟲層 | 爬蟲不應知道 DB 的存在（層次隔離，見 3.1）。API 層在合併爬蟲結果後統一查 DB 注入，一次 query 取全部 favoriteIds。     | ✅ 已採用 |
| ADR-006 | 不採用定時爬蟲（cron job）           | 預排程爬取可降低延遲，但關鍵字組合無限，無法預先知道使用者要搜什麼。維持使用者觸發的即時爬取。                        | ❌ 已棄用 |

---

## 技術與部署限制

- **執行環境**：Node.js 18+ LTS。
- **瀏覽器引擎**：僅 Playwright Chromium（透過 `mcr.microsoft.com/playwright` 基礎映像固定版本）。
- **建置**：`tsc` 輸出至 `dist/`；生產容器執行 `node dist/server.js`。
- **容器輸出 Volume**：職缺 JSON 檔案透過 Docker Volume 持久化至 `/app/data/`；
  預設輸出路徑為 `/app/data/jobs.json`。
- **連接埠**：HTTP API 預設為 `PORT=3000`；**必須**可透過環境變數設定。
- **安全性**：`/crawl` 端點的 JSON body 大小上限為 `256kb`
  （`express.json({ limit: "256kb" })`）。在未附上明確理由與 DoS 風險評估前，
  **不得**調高此限制。
- **無驗證層**：本服務設計為僅供內部或受信任網路部署（ADR-004）。
  在無驗證代理的情況下對公開介面暴露此服務，明確超出本專案範疇。

---

## 已知限制與待決策問題

### 已知限制

- Playwright browser 冷啟動約 2–3 秒，第一次搜尋回應較慢；後續請求因 browser pool 複用而快。
- SQLite 單檔不適合多程序同時讀寫；若未來需要 cluster 模式，需改用 WAL mode 或換 DB（ADR-001）。
- 快取 key 為 `${platform}:${keyword}:${page}`，未考慮大小寫與全半形差異，可能造成不必要的重複爬取。
- 1111 的 DOM scraper 較脆弱，網站改版後需人工更新 selector。

### 待決策問題

| 問題 | 描述                                                                     | 狀態      |
| ---- | ------------------------------------------------------------------------ | --------- |
| Q1   | `GET /api/jobs` 無關鍵字時，回傳空陣列還是爬熱門職缺？（尚未與前端確認） | 🔲 待決策 |
| Q2   | 快取失效策略：目前純 TTL，是否需要支援手動清除快取的 admin endpoint？    | 🔲 待決策 |
| Q3   | 爬蟲被封鎖後的 retry 次數上限與 backoff 策略尚未定義                     | 🔲 待決策 |

---

## 開發工作流程

- **分支命名**：`<流水號>-<slug>`（例如 `003-add-cakeresume-provider`）。
- **功能生命週期**：spec.md → plan.md → data-model.md → contracts/ → tasks.md → 實作。
- **憲法審查關卡**（每個功能計畫核准前必須通過）：

  **設計哲學關卡（P1–P6）**
  1. 此功能對使用者搜尋職缺的體驗是否有直接幫助？（P1）
  2. 爬蟲失敗時是否回傳 partial result 並標示來源錯誤，而非空陣列或 500？（P2）
  3. 是否引入了新的外部服務依賴？若有，是否有充分理由違反零依賴原則？（P3）
  4. 新的爬取邏輯是否有對應的 TTL 快取設計？（P4）
  5. 新 Provider 是否為獨立模組，不與其他 Provider 共用解析邏輯？（P5）
  6. 新回傳型別是否已更新 `types.ts`，且無 `any` 逃逸至 route handler？（P6）

  **技術實作關卡（I–VII）** 7. 新 Provider 是否實作了 `JobProvider` 介面？（原則 I）8. 是否遵守 `delay` 參數且未濫用內部 API？（原則 II）9. 新設定參數是否已同時在 CLI 與 HTTP body 中公開？（原則 III）10. `BaseJob` Schema 是否向下相容，或已記錄 MAJOR 版本升級說明？（原則 IV）11. 瀏覽器資源是否在 `finally` 區塊中釋放？（原則 V）12. 所有重要事件是否使用結構化 log 前綴？（原則 VI）13. 是否維持 `strict: true` 且未引入推測性程式碼？（原則 VII）

- **破壞性 Schema 異動**需同步更新 `talentive-web` 職缺卡片元件並升級 MAJOR 版本號。
- **Debug HTML 檔案**（`debug-*.html`）**必須**加入 `.gitignore`。

---

## 治理規範

本憲法是 `talentive-service` 的最高權威文件，
凌駕於 README 慣例、口頭協議與過往 commit 模式之上。

- **修訂**需包含：（1）書面理由、（2）受影響原則與模板的識別、
  （3）依下列政策升級版本號，以及（4）將變更傳播至所有引用該原則的
  `.specify/templates/*.md` 檔案。
- **版本升級政策**：
  - MAJOR：移除或重新定義現有原則；移除 `BaseJob` 的必要欄位。
  - MINOR：新增原則或設計哲學條目；新增必要區塊；實質性擴展現有原則的適用範圍。
  - PATCH：澄清說明、措辭改善、錯字修正、非語意性調整。
- **ADR 新增條件**：當一個架構決策的取捨不明顯，或未來可能被重新評估時，
  **必須**新增對應的 ADR 條目，狀態標示為「✅ 已採用」或「❌ 已棄用」。
- **合規審查**：所有功能計畫**必須**包含「憲法審查」區塊，
  通過全部十三個關卡後方可開始實作。
- **執行期指引**：快速啟動指令請參閱 `README.md`，
  容器啟動行為請參閱 `docker-entrypoint.sh`。

---

## 修訂紀錄

| 版本   | 日期       | 修訂摘要                                                                           |
| ------ | ---------- | ---------------------------------------------------------------------------------- |
| v1.0.0 | 2026-04-04 | 初版建立，涵蓋技術實作原則 I–VII、技術與部署限制、開發工作流程、治理規範           |
| v1.1.0 | 2026-04-04 | 新增設計哲學優先原則 P1–P6、架構哲學（3.1–3.4）、ADR-001~006、已知限制與待決策問題 |

**版本**：1.1.0 | **批准日期**：2026-04-04 | **最後修訂**：2026-04-04

# Talentive Service 憲法

## 核心原則

### I. Provider 介面契約（不可違反）

所有職缺資料來源**必須（MUST）**實作定義於 `src/providers/types.ts` 的 `JobProvider` 介面：

```ts
interface JobProvider {
  name: string;
  fetch(page: Page, options: ProviderOptions): Promise<BaseJob[]>;
}
```

- Provider **必須**在使用前於 `crawler.ts` 的 `registry` 映射中完成註冊。
- Provider **必須**保持無狀態（stateless）——不同呼叫之間不得存在共用可變狀態。
- Provider **不得**與其他 Provider 共用同一個 `Page` 實例；每個 Provider 必須獲得獨立的頁面。
- `BaseJob` 輸出 Schema（`title`、`company`、`location`、`salary`、`date?`、`url`、`page`、`source`）
  為標準資料契約，所有 Provider **必須**完整回傳；`url` **必須**非空字串。

**設計理由**：Registry 模式讓新增 Provider 不需修改呼叫端邏輯，零摩擦擴充。
強制頁面隔離可防止某 Provider 的狀態污染其他 Provider 的抓取結果。

### II. 非侵入式爬蟲

- Provider **必須**遵守 `delay` 參數（毫秒）作為分頁請求之間的等待時間，
  避免觸發平台的速率限制或反爬蟲機制。
- 當目標網站未公開文件化的 API 時，Provider **必須**模擬真實使用者行為
  （例如：滾動觸發懶加載、設定 `accept-language`、`User-Agent` 請求標頭）。
- 若目標平台提供公開且有文件的 API（例如 104 搜尋端點），Provider **可以（MAY）**
  直接呼叫以降低風險並加速回應。
- Provider **不得**儲存、記錄或再傳送超出 `BaseJob` 欄位模型的個人資料。
- Debug HTML 快照**只能**在 `debug: true` 明確設定時才可寫入；**不得**提交至版本庫。

**設計理由**：本專案的核心價值在於以低偵測率持續存取職缺資料。
過於激進或非標準的請求模式容易導致 IP 封鎖，使整體服務失效。

### III. 雙介面：CLI + HTTP API

- 爬蟲**必須**同時可作為獨立 CLI（`crawler.ts` 的 `require.main === module` 路徑）
  及 HTTP 服務（`server.ts`）使用。
- 設定值解析**必須**遵循以下優先順序（高 → 低）：
  1. 呼叫時明確傳入的參數 / HTTP 請求 body 欄位
  2. 環境變數（`KEYWORD`、`PAGES`、`DELAY`、`PROVIDERS`、`OUTPUT`、`DEBUG`）
  3. `mergeOptions` 中的硬式預設值
- 當呼叫端僅需要記憶體內結果時（例如 HTTP `/crawl` 端點直接回傳 `data`），
  `output` 路徑**可以（MAY）**省略（`undefined`）。
- 新增的設定參數**必須**在 CLI 與 HTTP 兩個介面上保持一致地公開。

**設計理由**：Docker 部署透過環境變數設定；本地開發使用 CLI 旗標；
HTTP 層則開放給前端整合。三個通道**必須**保持同步。

### IV. 輸出 Schema 穩定性

- `BaseJob` 的欄位名稱與型別是**有版本控制的公開契約**。
- 新增可選欄位屬於 MINOR 版本升級；欄位**必須**宣告為可選（`field?: type`）
  以維持向下相容。
- 移除或重新命名欄位屬於 MAJOR 版本升級，**必須**在 `CHANGELOG` 中附上遷移說明，
  並更新下游使用者（`talentive-web`）。
- 以 URL 為基礎的去重邏輯（`dedupeByUrl`）為標準作法——
  相同 `url` 的重複職缺**必須**靜默丟棄，保留第一筆。

**設計理由**：`talentive-web` 及未來的使用者依賴穩定的 Schema 來渲染職缺卡片。
靜默的欄位重新命名會造成靜默的渲染錯誤，難以追蹤。

### V. 並發安全與資源釋放

- HTTP API **必須**透過 `isRunning` 互斥鎖，以 HTTP `409 Conflict` 拒絕
  並發的爬取請求。每個 server 程序同一時間**必須**只有一個活躍的 Playwright 瀏覽器。
- 瀏覽器資源（`Browser`、`Page`）**必須**在 `finally` 區塊中釋放，
  確保即使 Provider 層拋出例外，資源仍可被清理。
- Provider **必須**在 `fetch()` 完成後關閉其 `Page`；`crawler.ts` **必須**
  在外層 `finally` 中關閉 `Browser`。
- 伺服器端錯誤回應**不得**將內部錯誤堆疊追蹤洩漏給客戶端——僅允許回傳 `e.message`。

**設計理由**：Playwright Chromium 實例記憶體佔用量大。
在容器化環境中洩漏的瀏覽器會耗盡記憶體，導致 OOM 強制終止。

### VI. 可觀測性

- 所有重要的執行期事件**必須**使用結構化的 console-log 前綴：
  `[INFO]`、`[WARN]`、`[ERROR]`、`[PROVIDER]`、`[SUMMARY]`、`[OUTPUT]`、`[DEBUG]`。
- Debug 模式（`debug: true`）對於任何空結果或錯誤頁面，**必須**輸出命名為
  `debug-<provider>-<tag>.html` 的 HTML 快照檔案。
- `/health` GET 端點**必須**始終以 JSON 物件回應，
  至少包含 `{ ok: boolean, running: boolean, last: { at, count } | null }`。
- `/last` GET 端點**必須**回傳最後寫入的職缺 JSON，
  或在檔案不存在時回傳 `404`——**不得**拋出未處理的錯誤。

**設計理由**：無介面的瀏覽器爬蟲在許多邊界情況下（selector 漂移、網路逾時、版面變更）
會靜默失敗。結構化日誌與 Debug 快照是生產環境中最主要的診斷工具。

### VII. 型別安全與簡潔

- 所有原始碼**必須**在 `strict: true` 下通過 `tsc` 編譯（不得對專案自身程式碼
  使用 `--skipLibCheck` 規避）。
- 明確的 `any` 型別轉換**只允許**出現在兩處：
  Provider registry 查找（`(registry as any)[name]`）以及瀏覽器執行的 DOM 回呼
  （`page.$$eval` 閉包，此處 TypeScript 無法推斷 DOM 型別）。
- **不得**出於推測而新增功能。遵循 YAGNI 原則：若新 Provider、欄位或路由
  不在當前功能規格中，則**不得**引入。
- 依賴**必須**維持最小化：runtime 僅 `playwright` + `express`；
  開發用僅 `typescript` + `ts-node` + `@types/*`。

**設計理由**：精簡且型別安全的程式碼能降低 selector 漂移、Provider 需更新時的維護負擔。
推測性程式碼只會增加無謂的技術債。

## 技術與部署限制

- **執行環境**：Node.js 18+ LTS。
- **瀏覽器引擎**：僅 Playwright Chromium（透過 `mcr.microsoft.com/playwright` 基礎映像固定版本）。
- **建置**：`tsc` 輸出至 `dist/`；生產容器執行 `node dist/server.js`。
- **容器輸出 Volume**：職缺 JSON 檔案透過 Docker Volume 持久化至 `/app/data/`；
  預設輸出路徑為 `/app/data/jobs.json`。
- **連接埠**：HTTP API 預設為 `PORT=3000`；**必須**可透過環境變數設定。
- **安全性**：`/crawl` 端點的 JSON body 大小上限為 `256kb`
  （`express.json({ limit: "256kb" })`）。在未附上明確理由與 DoS 風險評估前，
  **不得**調高此限制。
- **無驗證層**：本服務設計為僅供內部或受信任網路部署。
  在無驗證代理的情況下對公開介面暴露此服務，明確超出本專案範疇。

## 開發工作流程

- **分支命名**：`<流水號>-<slug>`（例如 `003-add-cakeresume-provider`）。
- **功能生命週期**：spec.md → plan.md → data-model.md → contracts/ → tasks.md → 實作。
- **憲法審查關卡**（每個功能計畫核准前必須通過）：
  1. 新 Provider 是否實作了 `JobProvider` 介面？（原則 I）
  2. 是否遵守 `delay` 參數且未濫用內部 API？（原則 II）
  3. 新設定參數是否已同時在 CLI 與 HTTP body 中公開？（原則 III）
  4. `BaseJob` Schema 是否向下相容，或已記錄 MAJOR 版本升級說明？（原則 IV）
  5. 瀏覽器資源是否在 `finally` 區塊中釋放？（原則 V）
  6. 所有重要事件是否使用結構化 log 前綴？（原則 VI）
  7. 是否維持 `strict: true` 且未引入推測性程式碼？（原則 VII）
- **破壞性 Schema 異動**需同步更新 `talentive-web` 職缺卡片元件並升級 MAJOR 版本號。
- **Debug HTML 檔案**（`debug-*.html`）**必須**加入 `.gitignore`。

## 治理規範

本憲法是 `talentive-service` 的最高權威文件，
凌駕於 README 慣例、口頭協議與過往 commit 模式之上。

- **修訂**需包含：（1）書面理由、（2）受影響原則與模板的識別、
  （3）依下列政策升級版本號，以及（4）將變更傳播至所有引用該原則的
  `.specify/templates/*.md` 檔案。
- **版本升級政策**：
  - MAJOR：移除或重新定義現有原則；移除 `BaseJob` 的必要欄位。
  - MINOR：新增原則；新增必要區塊；實質性擴展現有原則的適用範圍。
  - PATCH：澄清說明、措辭改善、錯字修正、非語意性調整。
- **合規審查**：所有功能計畫**必須**包含「憲法審查」區塊，
  通過全部七個關卡後方可開始實作。
- **執行期指引**：快速啟動指令請參閱 `README.md`，
  容器啟動行為請參閱 `docker-entrypoint.sh`。

**版本**：1.0.0 | **批准日期**：2026-04-04 | **最後修訂**：2026-04-04
