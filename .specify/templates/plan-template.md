# 實作計畫：[功能名稱]

**分支**：`[###-feature-name]` | **日期**：[DATE] | **規格**：[link]
**輸入**：功能規格來自 `/specs/[###-feature-name]/spec.md`

**說明**：本模板由 `/speckit.plan` 指令填寫。執行工作流程請參閱 `.specify/templates/plan-template.md`。

## 摘要

[從功能規格中擷取：主要需求 + 研究階段的技術方案]

## 技術背景

<!--
  待辦事項：請將本區塊的內容替換為本專案的實際技術細節。
  以下結構僅供指引，非強制格式。
-->

**語言／版本**：Node.js 18+ LTS、TypeScript 5.x
**主要依賴**：Playwright、Express
**儲存**：SQLite（favorites）+ JSON 檔案（輸出至 `/app/data/`）
**測試**：[如有，請填寫；否則填 N/A]
**目標平台**：Linux 容器（Docker）/ 本機 Node.js
**專案類型**：CLI + HTTP 服務（web-service）
**效能目標**：Favorites API ≤ 50ms；爬蟲延遲依 delay 參數
**限制**：<256kb 請求 body；單次瀏覽器並發；零外部服務依賴
**規模／範疇**：[依功能而定]

## 憲法審查

_關卡：Phase 0 研究前必須通過。Phase 1 設計後需重新確認。_

### 設計哲學關卡（P1–P6）

| 編號 | 審查關卡                                                             | 狀態 |
| ---- | -------------------------------------------------------------------- | ---- |
| P1   | 此功能對使用者搜尋職缺的體驗是否有直接幫助？                         | ☐    |
| P2   | 爬蟲失敗時是否回傳 partial result 並標示來源錯誤，而非空陣列或 500？ | ☐    |
| P3   | 是否引入了新的外部服務依賴？若有，是否有充分理由違反零依賴原則？     | ☐    |
| P4   | 新的爬取邏輯是否有對應的 TTL 快取設計，以減少對目標平台的請求頻率？  | ☐    |
| P5   | 新 Provider 是否為獨立模組，解析邏輯不與其他 Provider 共用？         | ☐    |
| P6   | 新回傳型別是否已更新 `types.ts`，且無 `any` 逃逸至 route handler？   | ☐    |

### 技術實作關卡（I–VII）

| 編號 | 審查關卡                                                                                                          | 狀態 |
| ---- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| I    | 新 Provider 是否實作 `JobProvider` 介面（`name` + `fetch(page, options)`）並已在 `registry` 映射中註冊            | ☐    |
| II   | Provider 是否遵守分頁間的 `delay` 參數（≥500ms）；未濫用私有／內部 API；`BaseJob` 欄位外無 PII 被記錄             | ☐    |
| III  | 新設定參數是否已一致地透過 CLI 參數、環境變數以及 HTTP request body 這三個管道公開                                | ☐    |
| IV   | `BaseJob` Schema 變更是否為純新增（可選欄位），**或**已附上遷移說明的 MAJOR 版本升級                              | ☐    |
| V    | Provider `fetch()` 後是否關閉 `Page`；`Browser` 是否在外層 `finally` 中關閉；並發爬取是否回傳 HTTP 409            | ☐    |
| VI   | 所有重要事件是否使用結構化 log 前綴（`[INFO]` `[WARN]` `[ERROR]` `[DEBUG]`）；debug 快照只在 `debug: true` 時寫入 | ☐    |
| VII  | `tsc --strict` 是否通過且無未說明的 `any`；未引入推測性的 YAGNI 程式碼                                            | ☐    |

> 各關卡的完整理由請參閱 `.specify/memory/constitution.md`。

## 專案結構

### 文件（本功能）

```text
specs/[###-feature]/
├── plan.md              # 本檔案（/speckit.plan 指令輸出）
├── research.md          # Phase 0 輸出（/speckit.plan 指令）
├── data-model.md        # Phase 1 輸出（/speckit.plan 指令）
├── quickstart.md        # Phase 1 輸出（/speckit.plan 指令）
├── contracts/           # Phase 1 輸出（/speckit.plan 指令）
└── tasks.md             # Phase 2 輸出（/speckit.tasks 指令——非 /speckit.plan 建立）
```

### 原始碼（版本庫根目錄）

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
