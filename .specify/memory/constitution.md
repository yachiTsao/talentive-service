<!--
同步影響報告
- 版本變更：1.0.0 → 1.1.0
- 原則異動：
  - 新增「測試與驗證」章節（參考 ref.md 補齊缺失的測試治理原則）
  - 更新 PR 審查流程，加入測試覆蓋要求
- 新增章節：測試與驗證
- 移除章節：無
- 需更新的模板：
  ✅ updated .specify/templates/plan-template.md（Constitution Check 加入測試閘門）
  ✅ updated .specify/memory/constitution.md
  ⚠ pending .specify/templates/spec-template.md（無需變更）
  ⚠ pending .specify/templates/tasks-template.md（無需變更）
  ⚠ pending .specify/templates/checklist-template.md（無需變更）
- 待辦：無
-->

# talentive-service 開發憲法

## 核心原則

### 核心架構與 Provider 模式

- 架構 MUST 遵循單一職責分層：
  `server.ts`（HTTP 入口）→ `crawler.ts`（協調邏輯）→ `providers/*.ts`（平台實作）。
- 每個 Provider MUST 實作 `JobProvider` 介面（`name` + `fetch()`），
  不得在 Provider 外部直接操作瀏覽器頁面。
- `crawler.ts` MUST 只負責協調：建立 Browser/Page、呼叫 Provider、去重、輸出；
  商業邏輯（欄位解析、資料清洗）MUST 封裝於對應 Provider 內部。
- 新增平台 MUST 以新增檔案方式擴充，不得修改既有 Provider。
- Provider registry MUST 集中定義於 `crawler.ts`，統一管理可用來源清單。
  **理由**：確保可擴充性，新增平台不影響既有邏輯，降低耦合。

### API 規範與一致性

- Express 端點 MUST 統一回傳結構：`{ ok: boolean, ... }`，
  錯誤時 MUST 包含 `error` 欄位，成功時 MUST 包含業務資料欄位。
- `POST /crawl` MUST 實作防併發保護（`isRunning` flag），
  重複請求回傳 HTTP 409。
- 所有非同步路由 handler MUST 使用 `try/catch` 包覆，
  並回傳 HTTP 500 + JSON 錯誤訊息，嚴禁輸出原始 stack trace。
- `GET /health` MUST 永遠可達，回傳服務狀態；
  `GET /last` 若檔案不存在 MUST 回傳 HTTP 404。
  **理由**：確保 API 合約一致、可預期，便於前端與監控整合。

### 爬蟲穩健性與反偵測

- 各 Provider 之間及頁面之間 MUST 使用可設定的延遲（`delay` 參數），
  預設不低於 700ms，避免觸發平台風控。
- Playwright 操作 MUST 模擬真實使用者行為（滾動、等待載入），
  不得直接呼叫平台未公開的內部 API（Yourator、1111）。
- `--debug` 模式下 MUST 將異常或空結果頁存為 `debug-*.html` 快照，
  方便問題追查，正常模式下不得輸出多餘檔案。
- Browser 資源（`browser.close()`）MUST 在 `finally` 區塊中釋放，
  確保例外情況下不洩漏進程。
  **理由**：降低被封鎖風險，並確保長期可用性與資源不洩漏。

### 資料品質與輸出格式

- 所有來源輸出 MUST 映射至統一的 `BaseJob` 介面，
  欄位不得自行擴充或省略（缺值用空字串 `""`，非 `null` 或 `undefined`）。
- 去重邏輯 MUST 以 URL 為唯一鍵，相同 URL 的後出現者捨棄。
- 輸出 JSON MUST 為 UTF-8 編碼的陣列，結構符合 `BaseJob[]`。
- `source` 欄位 MUST 使用 Provider 的 `name` 屬性值，保持可追溯性。
  **理由**：確保下游消費方（前端、分析）可依賴穩定的資料契約。

### 測試與驗證

- 測試執行器 MUST 使用 Node.js 內建 test runner（`node --test`）搭配 `ts-node`，
  無需額外測試框架。
- 核心非瀏覽器邏輯 MUST 撰寫單元測試，涵蓋：
  Provider 輸出欄位格式、URL 去重邏輯、ID 生成工具函式。
- 測試檔案 MUST 與實作檔案同層放置，命名規則為 `*.test.ts`。
- Provider 的 `fetch()` 因依賴真實瀏覽器，歸類為整合測試（可選）；
  但其輸出格式映射邏輯（欄位轉換）MUST 可獨立提取並進行單元測試。
- 任何新增的工具函式（`utils/`）在合入前 MUST 有對應的 `*.test.ts` 覆蓋。
  **理由**：確保核心合約穩定，降低重構風險，並使 CI 可在無瀏覽器環境下通過。

### 效能與資源管理

- 所有非同步操作 MUST 使用 `async/await`；
  禁止使用 `.then()` 鏈式嵌套超過一層，禁止同步阻塞呼叫。
- 每次爬蟲執行結束後 MUST 關閉 Playwright browser 實例；
  禁止在 Server 模式下保持常駐瀏覽器（每次請求獨立建立與關閉）。
- 環境變數（`KEYWORD`、`PAGES`、`PROVIDERS`、`DELAY`、`OUTPUT`）
  MUST 作為預設值來源，CLI 參數可覆蓋，方便 Docker 環境設定。
- 敏感設定（如未來可能的 API Key）MUST 來自環境變數，
  嚴禁硬編碼於原始碼中。
  **理由**：避免資源洩漏、保持無狀態設計，方便容器化部署。

### Git 與環境管理

- Commit 訊息 MUST 使用類別前綴（例如：`feat:`、`fix:`、`refactor:`、`docs:`）。
- `.gitignore` MUST 排除：`node_modules/`、`dist/`、`*.html`（debug 快照）、
  `*.json`（爬蟲輸出，除設定檔外）。
- `Dockerfile` 與 `docker-entrypoint.sh` MUST 保持可獨立執行，
  環境變數為唯一外部設定介面。
  **理由**：維持乾淨歷史、避免輸出檔污染版本控制。

### 文件語言一致性

- 專案內所有 `.md` 檔案（README、文件、規格、憲法）MUST 使用正體中文。
- 程式碼內的型別名稱、介面名稱、函式名稱 MUST 使用英文命名。
- 程式碼內的行內註釋與文件註釋建議使用正體中文，方便團隊閱讀。
  **理由**：確保文件一致性與團隊溝通效率，同時維持程式碼國際可讀性。

## 適用範圍

本憲法適用於 `talentive-service` 專案內所有 TypeScript 爬蟲程式碼、
Express API 實作、Provider 擴充，以及相關容器化與部署設定。
任何偏離 MUST 於實作計畫中記錄並說明理由。

## 遵循與審查流程

- 每份實作計畫 MUST 包含「憲法檢查」並對應到上述原則。
- 每個 PR MUST 確認：
  - Provider 實作 `JobProvider` 介面
  - 輸出符合 `BaseJob[]` 格式與去重邏輯
  - API 回傳結構統一（`{ ok, ... }`）
  - 無資源洩漏（browser 確實關閉）
  - 全程 `async/await`，無硬編碼機密
  - 新增工具函式已有對應 `*.test.ts` 覆蓋，且 `node --test` 通過
  - 文件為正體中文
- 任何例外 MUST 明確記錄並取得批准。

## 治理

- 本憲法優先於其他專案慣例。
- 修訂 MUST 附理由、調整版本號並更新日期。
- 版本規則：移除或重大不相容調整為 MAJOR；新增或擴充為 MINOR；
  文字釐清為 PATCH。
- 所有審查 MUST 檢查遵循性；任何合理違反 MUST 記錄於
  Implementation Plan 的 Complexity Tracking。

**Version**: 1.1.0 | **Ratified**: 2026-04-05 | **Last Amended**: 2026-04-06
