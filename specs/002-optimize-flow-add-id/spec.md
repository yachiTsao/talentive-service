# Feature Specification: 優化爬蟲流程並加入 id 欄位

**Feature Branch**: `002-optimize-flow-add-id`  
**Created**: 2026-04-05  
**Status**: Draft  
**Input**: User description: "優化目前的流程並加入 id 的欄位"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 每筆職缺具備唯一識別碼 (Priority: P1)

下游消費方（如前端應用、資料分析腳本）需要能夠穩定識別每一筆職缺，
而不僅僅依賴完整 URL 字串。
透過在每筆職缺資料中加入 `id` 欄位，消費方可以用簡短的識別碼追蹤、
收藏或比對不同次爬取之間的同一筆職缺。

**Why this priority**: 此為核心資料契約變更，影響所有下游使用方；
其他優化都能在此基礎上疊加，因此優先實作。

**Independent Test**: 執行一次爬取後，驗證輸出的每筆 `BaseJob` 都包含
非空的 `id` 字串；對相同來源 URL 執行兩次爬取，確認 `id` 值完全相同。

**Acceptance Scenarios**:

1. **Given** 系統對任一平台完成爬取，**When** 輸出 JSON，**Then** 每筆職缺包含 `id` 欄位且值不為空。
2. **Given** 相同 URL 的職缺被爬取兩次，**When** 比較兩次輸出，**Then** 兩筆資料的 `id` 值完全相同（具決定性）。
3. **Given** 同一次爬取結果中所有職缺，**When** 對 `id` 欄位進行唯一性驗證，**Then** 所有 `id` 互不重複。

---

### User Story 2 - 多平台並行爬取以縮短等待時間 (Priority: P2)

使用者（開發者或排程任務）在觸發爬取後，目前需等待每個平台逐一完成
才能取得結果。將平台改為並行執行後，總等待時間可顯著縮短。

**Why this priority**: 屬於流程優化，不影響資料契約，可在 `id` 欄位完成後獨立套用。

**Independent Test**: 同時指定 104、Yourator、1111 三個平台進行爬取，
觀察三個平台幾乎同時開始運作，總執行時間明顯短於三個平台串行所需時間之總和。

**Acceptance Scenarios**:

1. **Given** 使用者指定多個 provider，**When** 爬取開始，**Then** 各 provider 同時啟動，不等待前一個完成。
2. **Given** 某一個 provider 在執行中發生錯誤，**When** 其他 provider 仍在執行，**Then** 其他 provider 不受影響並正常回傳結果；錯誤 provider 記錄警告訊息。
3. **Given** 所有 provider 並行完成，**When** 聚合結果，**Then** 去重邏輯仍正常運作，輸出資料完整且無重複。

---

### User Story 3 - 單一 provider 失敗不中斷整體爬取 (Priority: P3)

目前若某平台爬取過程拋出例外，可能導致整批結果遺失。
加入 per-provider 錯誤隔離後，使用者至少能取得其他平台的正常資料。

**Why this priority**: 穩健性提升，依賴並行架構（P2）完成後實作最為自然。

**Independent Test**: 模擬某一 provider 拋出例外，驗證其餘 provider
的結果仍出現在最終輸出中，且整體爬取任務成功完成（回傳 HTTP 200）。

**Acceptance Scenarios**:

1. **Given** 其中一個 provider 在爬取過程中拋出例外，**When** 爬取結束，**Then** 系統回傳其餘 provider 的正常資料，並在日誌中記錄哪個 provider 失敗及失敗原因。
2. **Given** 所有 provider 都失敗，**When** 爬取結束，**Then** 系統回傳空陣列並記錄所有錯誤，不拋出未捕捉的例外。

---

### Edge Cases

- 若多個 provider 回傳相同 URL 的職缺，`id` 應與去重後保留的那筆一致（URL 決定 id）。
- 並行執行下，若某 provider 耗時超過 120 秒，系統 MUST 視為逾時失敗並繼續回傳其他已完成 provider 的結果。
- `id` 值中不得包含會破壞 JSON 結構或 URL 參數的特殊字元。
- `GET /last` 讀取舊版檔案（缺少 `id`）時，即時補齊不改寫磁碟；若某筆資料缺少 `url` 導致無法產生 `id`，MUST 以空字串 `""` 填入並記錄警告。
- 若不同 URL 產生相同 SHA-256 前 8 碼（雜湊碰撞），後出現的那筆資料被捨棄並記錄警告；此情況在單次爬取（< 10 萬筆）發生機率極低，不影響整體可用性。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 在 `BaseJob` 資料結構中加入 `id` 欄位（字串型別）。
- **FR-002**: `id` MUST 根據職缺的 `url` 以 SHA-256 演算法產生，取雜湊值的前 8 碼十六進位字元作為 `id`；實作 MUST 使用 Node.js 內建 `crypto` 模組，不引入額外依賴；相同 URL 永遠產生相同 `id`。
- **FR-003**: 同一次爬取結果中，所有職缺的 `id` MUST 互不重複；若發生雜湊碰撞（不同 URL 產生相同 `id`），MUST 捨棄後出現的那筆並以 `console.warn` 記錄碰撞的兩個 URL，不中斷流程。
- **FR-004**: 系統 MUST 將多個 provider 改為並行執行，而非逐一串行。
- **FR-005**: 單一 provider 執行失敗 MUST 不中斷其他 provider 的執行；失敗日誌 MUST 包含以下欄位：provider 名稱、錯誤訊息、已耗時（毫秒）；使用現有 `console.warn` 輸出，不引入額外 logging 框架。
- **FR-006**: 並行執行完成後，聚合與去重邏輯 MUST 與現有行為完全一致。
- **FR-007**: 現有的 `POST /crawl` 與 `GET /last` API 契約（回傳欄位結構）MUST 向後相容，僅新增 `id` 欄位不刪除或更名現有欄位。
- **FR-008**: 每個 provider 並行執行時 MUST 設定獨立逾時上限為 120 秒；逾時 MUST 視同執行失敗，依 FR-005 規則記錄日誌並不中斷其他 provider。
- **FR-009**: `GET /last` 讀取磁碟 JSON 檔時，若偵測到任一筆職缺缺少 `id` 欄位，MUST 即時以 SHA-256（FR-002 規則）補齊後回傳；補齊動作 MUST NOT 改寫磁碟檔案。

### Key Entities

- **BaseJob（更新後）**: 代表一筆標準化職缺資料；新增 `id`（決定性字串識別碼）欄位，其餘欄位（`title`、`company`、`location`、`salary`、`date`、`url`、`page`、`source`）維持不變。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 爬取輸出的每筆職缺均包含非空 `id` 欄位，覆蓋率 100%。
- **SC-002**: 對相同 URL 執行多次爬取，`id` 值一致性達 100%（可重現）。
- **SC-003**: 啟用多個 provider 時，總爬取時間不超過最慢 provider 所需時間的 1.5 倍（相對於串行執行時間之總和有明顯縮短）。
- **SC-004**: 單一 provider 失敗不導致整體爬取任務回傳錯誤；其餘 provider 資料完整回傳。
- **SC-005**: 現有前端與下游消費方無需修改即可繼續正常使用（向後相容）。
- **SC-006**: 單一 provider 逾時（超過 120 秒）後，`/crawl` 端點仍在該 provider 逾時後的合理時間內（≤ 5 秒）回傳其餘 provider 的完整結果。

## Clarifications

### Session 2026-04-05

- Q: `id` 欄位應使用哪種雜湊演算法？ → A: SHA-256 截取前 8 碼十六進位，使用 Node.js 內建 `crypto`
- Q: 並行執行時是否需要為每個 provider 設定逾時上限，以防單一 provider 卡住？ → A: 每個 provider 設定獨立逾時 120 秒，逾時視同失敗並記錄日誌
- Q: provider 失敗時日誌應包含哪些欄位？ → A: provider 名稱、錯誤訊息、已耗時（毫秒），使用 `console.warn`
- Q: `GET /last` 讀取舊版檔案（無 `id`）時應如何處理？ → A: 即時補齊 `id` 後回傳，不改寫磁碟
- Q: SHA-256 前 8 碼發生雜湊碰撞時如何處理？ → A: 捨棄後出現的那筆，`console.warn` 記錄兩個 URL，不中斷流程

## Assumptions

- `id` 的產生方式採用 URL 的 SHA-256 雜湊，截取前 8 碼十六進位字元；使用 Node.js 內建 `crypto` 模組，不引入額外依賴，不使用隨機 UUID，以確保跨次爬取的穩定性。
- 並行化僅在 provider 層級進行（各 provider 同時執行），同一 provider 內部（多頁）仍維持現有順序邏輯，不額外並行化以避免觸發平台風控。
- Playwright Browser 實例的建立策略維持不變（一次爬取一個 Browser），並行是透過多個 Page 並行運作，非多個 Browser。
- 每個 provider 的逾時上限為 120 秒，此值為固定常數，不開放 CLI 或 API 參數覆蓋（避免過度參數化）。
- 日誌輸出沿用現有 `console.warn` / `console.log` 風格，不引入 winston、pino 等 logging 框架；格式為結構化文字，包含 provider 名稱、錯誤訊息、已耗時。
- 向後相容性僅針對 JSON 輸出格式；TypeScript 型別定義（`BaseJob`）的變更屬於有意的 breaking change，需一起更新所有使用方。
- `GET /last` 的即時補齊邏輯與 FR-002 共用相同的 `id` 產生函式，確保補齊結果與重新爬取的結果一致。
- SHA-256 前 8 碼在單次爬取資料量（< 10 萬筆）下的碰撞機率極低（< 0.01%），不值得增加額外複雜度；碰撞處理以「捨棄後出現者 + 警告日誌」為唯一策略，不自動延伸雜湊長度。
- 本次範圍不包含 Provider 內部爬取邏輯的調整（如選擇器、滾動策略等）。
