# 功能規格：API 專案骨架初始化

**功能分支**：`001-api-scaffold-setup`
**建立日期**：2026-04-05
**狀態**：草稿
**輸入**：開始 Phase 1，建立 talentive-api 專案骨架，包含 Express + TypeScript 初始化、SQLite migration、CORS 設定（origin: localhost:5173）、以及 GET /health 健康檢查 endpoint

## 使用者情境與測試 _（必填）_

### 使用者故事 1 — 開發者零阻力本地啟動（優先級：P1）

開發者 clone 此版本庫後，不需要安裝或啟動任何外部服務（資料庫、佇列、雲端 API），
只需執行 `npm install` 與 `npm run dev` 兩個指令，伺服器即可在本機正常運行。

**為何此優先級**：這是整個後端服務的基礎。若本地啟動流程複雜或有外部依賴，
後續所有功能開發都會受阻。零依賴部署是本專案的核心設計原則（憲法 P3）。

**獨立測試方法**：在乾淨環境執行 `npm install && npm run dev`，成功看到伺服器啟動日誌，
且呼叫 `GET /health` 回傳 200 即為通過。

**驗收情境**：

1. **Given** 開發者剛 clone 版本庫（無 `node_modules`），**When** 執行 `npm install && npm run dev`，**Then** 伺服器在 3 秒內啟動並輸出啟動成功日誌，無任何外部連線錯誤
2. **Given** 伺服器已啟動，**When** 呼叫 `GET http://localhost:3000/health`，**Then** 回傳 `{ ok: true, running: boolean, last: { at, count } | null }` 且 HTTP status 為 200
3. **Given** SQLite 資料庫檔案不存在，**When** 伺服器啟動，**Then** migration 自動建立所需 schema，無需手動操作
4. **Given** 伺服器首次啟動，**When** migration 執行，**Then** 所有 migration 冪等地完成（重啟不重複執行已完成的 migration）

---

### 使用者故事 2 — 前端應用能無障礙呼叫 API（優先級：P2）

在 `localhost:5173` 運行的前端應用（talentive-web）能向 API 伺服器發出請求，
瀏覽器不因 CORS 政策而封鎖回應。

**為何此優先級**：CORS 設定不正確時，前端完全無法與後端通訊，
但此問題只影響前端整合，後端服務本身仍可運作，因此優先級低於服務啟動。

**獨立測試方法**：開啟 `localhost:5173`，從瀏覽器以 `fetch` 呼叫
`GET http://localhost:3000/health`，確認回應成功且無 CORS 錯誤。

**驗收情境**：

1. **Given** 前端在 `localhost:5173` 發送 `GET /health`，**When** 伺服器收到請求，**Then** 回應標頭包含 `Access-Control-Allow-Origin: http://localhost:5173`
2. **Given** 前端發送 preflight（`OPTIONS`）請求，**When** 伺服器收到，**Then** 回傳允許的 methods 與 headers，HTTP status 204 或 200
3. **Given** 非 `localhost:5173` 的 origin（例如惡意第三方網站）發送請求，**When** 伺服器收到，**Then** 不回傳 CORS 允許標頭（預設安全策略）

---

### 使用者故事 3 — 運維人員 / CI 可確認服務就緒狀態（優先級：P3）

CI pipeline 或監控系統可透過 `GET /health` 端點確認服務是否正常運行，
並能從回應內容中了解服務的基本狀態。

**為何此優先級**：健康檢查是服務可觀測性的基礎需求，但不影響業務功能，
因此優先級相對較低。

**獨立測試方法**：傳送 `GET /health`，檢查回應格式與 status code 是否符合預期，
不需要其他 API 端點存在。

**驗收情境**：

1. **Given** 伺服器運行中，**When** `GET /health`，**Then** 固定回傳 `{ ok: true, running: boolean, last: { at, count } | null }` 與 HTTP 200
2. **Given** 伺服器剛啟動（DB migration 完成），**When** `GET /health`，**Then** 回應時間 < 50ms
3. **Given** 爬蟲任務正在執行中，**When** 呼叫 `/health`，**Then** 回傳 `{ ok: true, running: true }` 且不回傳 500（健康端點不受爬蟲狀態影響）

---

### 邊界情況

- 當 SQLite 檔案因權限問題無法建立時，伺服器應在啟動時明確輸出 `[ERROR]` log 並以非零 exit code 結束程序（不靜默啟動帶損毀狀態）
- **當 migration SQL 執行本身失敗時**（如 SQL 語法錯誤、資料庫損毀、磁碟寫入失敗），系統必須輸出 `[ERROR]` log 並以非零 exit code 結束程序（fail-fast，對應憲法 P2 誠實回應）
- 當 `PORT` 環境變數未設定時，預設使用 `3000`
- Migration 腳本重複執行時不應失敗（冪等性）
- 若 `NODE_ENV` 未設定，視為 `development`

## 需求 _（必填）_

<!--
  憲法說明（原則 IV — 輸出 Schema 穩定性）：
  本功能為骨架初始化，不新增或修改 BaseJob 欄位，無 Schema 版本升級需求。
-->

### 功能需求

- **FR-001**：系統**必須**在 `npm install && npm run dev` 執行後於本地啟動，不依賴任何外部服務
- **FR-002**：系統**必須**在啟動時自動執行 SQLite migration，建立 `favorites` 資料表，僅含 `id INTEGER PRIMARY KEY` 一個欄位；其餘業務欄位全部保留給 `002-job-favorites` 功能定義
- **FR-003**：系統**必須**將 CORS 允許的 origin 限制為 `http://localhost:5173`，拒絕其他來源的跨域請求
- **FR-004**：系統**必須**實作 `GET /health` 端點，回傳 `{ ok: true, running: boolean, last: { at: string; count: number } | null }` 與 HTTP 200（完整形狀定義見 `contracts/GET-health.ts`）
- **FR-005**：系統**必須**在啟動日誌中輸出 `[INFO]` 前綴的啟動訊息，包含監聽的 port 與 `NODE_ENV`（未設定時預設顯示 `development`），格式為 `[INFO] server listening on :<PORT> (<NODE_ENV>)`（對應憲法原則 VI）
- **FR-006**：`PORT` 環境變數**必須**可設定伺服器監聽的 port，預設值為 `3000`
- **FR-009**：`DB_PATH` 環境變數**必須**可指定 SQLite 資料庫檔案路徑，預設值為 `./data/talentive.db`
- **FR-007**：所有原始碼**必須**通過 `npm run build`（`tsc --build`）編譯，零錯誤、零警告，且無未說明的 `any` 型別逸脹（對應憲法原則 VII）
- **FR-008**：Migration runner **必須**使用 `CREATE TABLE IF NOT EXISTS` 語句，並透過 `_migrations` 資料表追蹤已執行項目，確保重複執行不產生錯誤或重複的 schema 變更（冪等性，idempotency）

### 關鍵實體 _（本功能涉及初始資料模型）_

- **favorites 資料表**：初始 schema 僅含 `id INTEGER PRIMARY KEY`，不包含任何業務欄位（如 `job_url`）。完整欄位由 `002-job-favorites` 的 migration 新增。本功能只驗證 migration 執行框架可正常運作，不預先佔用業務欄位定義（避免與後續 migration 產生衝突）。

## 成功標準 _（必填）_

### 可量測的成果

- **SC-001**：開發者在乾淨環境從 clone 到伺服器啟動完成，整體耗時不超過 3 分鐘（不含網路下載時間）
- **SC-002**：`GET /health` 端點回應時間 < 50ms（本地環境）
- **SC-003**：`tsc --build` 零錯誤、零警告
- **SC-004**：在 `localhost:5173` 的前端以 `fetch` 呼叫 API，瀏覽器 console 無 CORS 錯誤
- **SC-005**：Migration 在同一資料庫上執行 10 次，不產生任何錯誤或重複資料

## 假設前提

- 開發環境已預先安裝 Node.js 18+ LTS（不在本功能範疇內）
- 前端應用固定在 `http://localhost:5173` 運行（由 Vite 預設 port 決定）；生產環境的 CORS 設定為後續功能
- SQLite 資料庫檔案存放於專案根目錄的 `data/` 子目錄，路徑可透過 `DB_PATH` 環境變數覆寫（例：`DB_PATH=./data/talentive.db`）
- 不在本功能實作使用者驗證（ADR-004：MVP 階段為單人本地工具）
- `favorites` 資料表的完整欄位 schema 由後續功能定義，本功能只建立 migration 執行框架與初始佔位 migration（僅含 `id INTEGER PRIMARY KEY`）

## 釐清記錄

### Session 2026-04-05

- Q: 初始 migration 應建立多少內容？ → A: 僅建立 `favorites` 資料表含 `id INTEGER PRIMARY KEY`，其餘欄位全留給 `002-job-favorites`
- Q: SQLite 路徑的環境變數名稱為何？ → A: `DB_PATH`（例：`DB_PATH=./data/talentive.db`）
- Q: Migration SQL 執行失敗（非權限問題）時應如何處理？ → A: 輸出 `[ERROR]` log 並以非零 exit code 結束程序（fail-fast）
