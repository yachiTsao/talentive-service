# 實作計畫：建立 talentive-api 專案骨架

**分支**：`001-api-scaffold-setup` | **日期**：2026-04-05 | **規格**：[spec.md](./spec.md)
**輸入**：功能規格來自 `/specs/001-api-scaffold-setup/spec.md`

**說明**：本模板由 `/speckit.plan` 指令填寫。執行工作流程請參閱 `.specify/templates/plan-template.md`。

## 摘要

在現有的 `src/server.ts` Express 服務基礎上，新增三項骨架能力：

1. **CORS 中介層**：允許 `http://localhost:5173` 發出跨域請求，解除前端開發阻塞。
2. **SQLite migration 框架**：使用 `better-sqlite3`，伺服器啟動時自動執行 `src/db/migrations/` 內的 SQL 腳本；建立 `favorites (id INTEGER PRIMARY KEY)` 初始資料表。
3. **`DB_PATH` 環境變數**：指定 SQLite 資料庫路徑（預設 `./data/talentive.db`）；資料目錄由 `data/.gitkeep` 確保存在。

## 技術背景

**語言／版本**：Node.js 18+ LTS、TypeScript 5.x（`strict: true`）
**主要依賴**：Playwright 1.55.0、Express 4.x、`better-sqlite3`（新增）、`cors`（新增）
**儲存**：SQLite via `better-sqlite3`（favorites）+ JSON 檔案輸出（`/app/data/jobs.json`）
**測試**：N/A（本功能為骨架，測試由後續功能補足）
**目標平台**：Linux 容器（`mcr.microsoft.com/playwright:v1.55.0-jammy`）/ 本機 Node.js（Windows / macOS / Linux）
**專案類型**：CLI + HTTP 服務（web-service）
**效能目標**：`/health` ≤ 10ms（設計目標；驗收標準見 SC-002: < 50ms）；migration 僅在啟動時執行一次
**限制**：`<256kb` 請求 body；單次瀏覽器並發；零外部服務依賴
**規模／範疇**：新增 2 個原始碼檔案、1 個 SQL migration、修改 1 個現有檔案

## 憲法審查

_關卡：Phase 0 研究前必須通過。Phase 1 設計後需重新確認。_

### 設計哲學關卡（P1–P6）

| 編號 | 審查關卡                                                             | 狀態                                                                                      |
| ---- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P1   | 此功能對使用者搜尋職缺的體驗是否有直接幫助？                         | ✅ 骨架直接支撐前端呼叫 API（US1: 零阻力啟動、US2: CORS-free）                            |
| P2   | 爬蟲失敗時是否回傳 partial result 並標示來源錯誤，而非空陣列或 500？ | N/A（本功能不涉及爬蟲回傳邏輯，migration 失敗採 fail-fast，符合 P2 精神）                 |
| P3   | 是否引入了新的外部服務依賴？若有，是否有充分理由違反零依賴原則？     | ✅ `better-sqlite3` 為本機嵌入式 DB（無網路依賴）；`cors` 為 2KB 零子依賴套件             |
| P4   | 新的爬取邏輯是否有對應的 TTL 快取設計，以減少對目標平台的請求頻率？  | N/A（本功能不含爬取邏輯）                                                                 |
| P5   | 新 Provider 是否為獨立模組，解析邏輯不與其他 Provider 共用？         | N/A（本功能不含新 Provider）                                                              |
| P6   | 新回傳型別是否已更新 `types.ts`，且無 `any` 逃逸至 route handler？   | N/A（`/health` 回傳型別為內聯 `{ok:true,running:boolean,last:...}`，不需更新 `types.ts`） |

### 技術實作關卡（I–VII）

| 編號 | 審查關卡                                                                                                          | 狀態                                                                            |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| I    | 新 Provider 是否實作 `JobProvider` 介面（`name` + `fetch(page, options)`）並已在 `registry` 映射中註冊            | N/A（本功能不含新 Provider）                                                    |
| II   | Provider 是否遵守分頁間的 `delay` 參數（≥500ms）；未濫用私有／內部 API；`BaseJob` 欄位外無 PII 被記錄             | N/A（本功能不含新 Provider）                                                    |
| III  | 新設定參數是否已一致地透過 CLI 參數、環境變數以及 HTTP request body 這三個管道公開                                | ✅ `DB_PATH` 透過環境變數公開；為全域 DB 路徑設定，無需 CLI 參數或 request body |
| IV   | `BaseJob` Schema 變更是否為純新增（可選欄位），**或**已附上遷移說明的 MAJOR 版本升級                              | N/A（本功能不修改 `BaseJob` / `types.ts`）                                      |
| V    | Provider `fetch()` 後是否關閉 `Page`；`Browser` 是否在外層 `finally` 中關閉；並發爬取是否回傳 HTTP 409            | N/A（本功能不含新 Provider 或爬蟲邏輯）                                         |
| VI   | 所有重要事件是否使用結構化 log 前綴（`[INFO]` `[WARN]` `[ERROR]` `[DEBUG]`）；debug 快照只在 `debug: true` 時寫入 | ✅ migration 成功 → `[INFO]`；失敗 → `[ERROR]`；伺服器啟動 → `[INFO]`           |
| VII  | `tsc --strict` 是否通過且無未說明的 `any`；未引入推測性的 YAGNI 程式碼                                            | ✅ `better-sqlite3` 提供完整型別；`cors` 透過 `@types/cors`；無 `any`           |

> 各關卡的完整理由請參閱 `.specify/memory/constitution.md`。

## 專案結構

### 文件（本功能）

```text
specs/001-api-scaffold-setup/
├── plan.md              # 本檔案（/speckit.plan 指令輸出）
├── research.md          # Phase 0 輸出（/speckit.plan 指令）
├── data-model.md        # Phase 1 輸出（/speckit.plan 指令）
├── quickstart.md        # Phase 1 輸出（/speckit.plan 指令）
├── contracts/
│   └── GET-health.ts    # Phase 1 輸出（/speckit.plan 指令）
└── tasks.md             # Phase 2 輸出（/speckit.tasks 指令——非 /speckit.plan 建立）
```

### 原始碼（版本庫根目錄）

```text
src/
├── server.ts              # 修改：新增 CORS、migration 初始化、[INFO] 啟動 log
├── db/
│   ├── migrate.ts         # 新增：輕量 migration runner（~25 行）
│   └── migrations/
│       └── 001_create_favorites.sql  # 新增：初始 migration
├── crawler.ts             # 不修改
└── providers/             # 不修改
    ├── types.ts
    ├── provider104.ts
    ├── yourator.ts
    └── provider1111.ts

data/
└── .gitkeep               # 新增：確保 data/ 目錄被版控追蹤
```

**Structure Decision**：本功能採單一 `src/` 專案結構（Option 1）。`src/db/` 子目錄存放資料庫相關程式碼，與爬蟲邏輯分離。不建立新的頂層目錄，維持現有架構。

## Complexity Tracking

> 本功能通過所有憲法關卡，無需額外說明。
