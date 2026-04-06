# Feature Specification: Favorite API

**Feature Branch**: `003-favorite-api`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: 需要新增關於 favorite 的 API：1. 列出 favorite 清單，依據平台分群 2. 新增某個 id 的職缺至 favorite 清單 3. 將某個 id 的職缺移除 favorite 清單

## Clarifications

### Session 2026-04-06

- Q: 三個收藏端點的路徑設計為何？ → A: `POST /favorites/:id`（新增）、`DELETE /favorites/:id`（移除）、`GET /favorites`（列出）
- Q: 新增收藏時，職缺完整欄位（title、company 等）從何取得？ → A: Server 自行從 `jobs.json` 查找對應 `id` 的完整資料後存入收藏，前端僅需傳路徑 `id`
- Q: 收藏清單並發寫入保護策略為何？ → A: in-process mutex（記憶體內排他鎖），同時只允許一個寫入操作，與現有 `isRunning` flag 做法一致
- Q: `GET /last` 加入 `is_fav` 計算後的加載效能目標為何？ → A: 200ms（與其他端點一致）
- Q: 收藏清單中的職缺資料是否隨後續爬取自動更新？ → A: 儲存新增當下的快照（靜態副本），不隨後續爬取自動同步
- Q: `favorites.json` 存在但內容為無效 JSON（損毀）時，服務應如何處理？ → A: 自動重置為 `[]`（空陣列），繼續正常服務，不回傳錯誤
- Q: US2 `GET /favorites` 是否需要驗收場景明確驗證群內排序（`savedAt` 降冪）？ → A: 是，新增場景：同平台先後加入 2 筆，回傳順序較新者在前

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 新增職缺至收藏清單 (Priority: P1)

前端使用者在瀏覽職缺列表時，可對某筆職缺按下「收藏」，服務端以該職缺的 `id` 為識別鍵將其加入收藏清單；若該職缺已在清單中，系統以「已存在」的狀態回應而不重複新增。

**Why this priority**: 收藏的前提是「能加入」，此功能未完成其餘兩則故事均無意義，是整個 favorite 功能的基礎。

**Independent Test**: 可呼叫新增 API 並觀察回傳狀態碼與內容，驗證職缺被成功記錄。

**Acceptance Scenarios**:

1. **Given** 收藏清單中不存在 `id="a3f9c021"` 的職缺，**When** 呼叫「新增收藏」並帶入 `id="a3f9c021"`，**Then** 系統回傳 HTTP 201，且該職缺出現在收藏清單中。
2. **Given** 收藏清單中已存在 `id="a3f9c021"` 的職缺，**When** 再次呼叫「新增收藏」並帶入相同 `id`，**Then** 系統回傳 HTTP 409，清單內容不變。
3. **Given** 任何收藏狀態，**When** 以不存在於爬取結果中的 `id` 呼叫「新增收藏」，**Then** 系統回傳 HTTP 404。

---

### User Story 2 - 取得依平台分群的收藏清單 (Priority: P2)

前端使用者希望查看目前所有已收藏的職缺，且需依照來源平台（`source` 欄位，如 `104`、`yourator`、`1111`）分組顯示，方便比較不同平台的職缺。

**Why this priority**: 列表查詢是「使用收藏」的主要入口，P1 寫入完成後即可獨立驗證此功能。

**Independent Test**: 預先加入數筆跨平台職缺後，呼叫列表 API 並確認回傳依平台分群的結構。

**Acceptance Scenarios**:

1. **Given** 收藏清單中有來自 `104` 的 2 筆與 `yourator` 的 1 筆職缺，**When** 呼叫「列出收藏」，**Then** 系統回傳包含 `104` 與 `yourator` 兩個分群的物件，各群內職缺數量一致。
2. **Given** 收藏清單為空，**When** 呼叫「列出收藏」，**Then** 系統回傳空物件 `{}` 且 HTTP 200。
3. **Given** 收藏清單有資料，**When** 呼叫「列出收藏」，**Then** 每筆職缺資料包含 `id`、`title`、`company`、`url`、`source`、`salary`、`location` 等欄位。
4. **Given** 同一平台（如 `104`）依序加入 2 筆職缺（先加入者 `savedAt` = T1、後加入者 `savedAt` = T2，T2 > T1），**When** 呼叫「列出收藏」，**Then** `104` 群內第一筆的 `savedAt` 等於 T2（較新者在前），第二筆等於 T1。

---

### User Story 3 - 移除收藏中的職缺 (Priority: P3)

前端使用者可對已收藏的職缺按下「取消收藏」，系統以 `id` 為鍵將其從清單中移除；若指定 `id` 本不在清單中，系統仍回傳成功（冪等行為）。

**Why this priority**: 移除功能為清單管理的完整性補完，可基於 P1/P2 獨立交付。

**Independent Test**: 先加入職缺再呼叫移除，確認後續列表中該職缺消失。

**Acceptance Scenarios**:

1. **Given** 收藏清單含 `id="a3f9c021"` 的職缺，**When** 呼叫「移除收藏」並帶入 `id="a3f9c021"`，**Then** 系統回傳 HTTP 200，後續列表中不再出現該職缺。
2. **Given** 收藏清單不含 `id="xxxxxxxx"` 的職缺，**When** 呼叫「移除收藏」並帶入 `id="xxxxxxxx"`，**Then** 系統回傳 HTTP 200（冪等），清單內容不變。

---

### User Story 4 - 職缺列表附帶收藏狀態標記 (Priority: P2)

前端呼叫「取得上次爬取結果」（`GET /last`）時，每筆職缺資料應包含 `is_fav` 欄位，標示該職缺目前是否在收藏清單中。`is_fav` 的值由即時比對收藏清單中的 `id` 集合決定：若職缺 `id` 存在於收藏清單則為 `true`，否則為 `false`。即使重新執行爬取，只要收藏清單中仍有該 `id`，`is_fav` 就維持 `true`；唯有呼叫「移除收藏」API 才能將其改為 `false`。

**Why this priority**: 前端需要 `is_fav` 才能正確渲染「已收藏 / 未收藏」的 UI 狀態，與 US1–US3 同步完成才能提供完整的收藏體驗。

**Independent Test**: 可先加入某職缺至收藏，再呼叫 `/last` 確認該職缺的 `is_fav` 為 `true`，其餘職缺為 `false`；執行新爬取後再呼叫 `/last`，確認已收藏的職缺 `is_fav` 仍為 `true`，新出現且未收藏的職缺為 `false`。

**Acceptance Scenarios**:

1. **Given** 職缺 `id="a3f9c021"` 已在收藏清單中，**When** 呼叫 `GET /last`，**Then** 該職缺的 `is_fav` 為 `true`，其他未收藏職缺的 `is_fav` 均為 `false`。
2. **Given** 職缺 `id="a3f9c021"` 已在收藏清單中，且執行了一次新的爬取（`POST /crawl` 成功），新結果中仍包含 `id="a3f9c021"` 的職缺，**When** 呼叫 `GET /last`，**Then** `id="a3f9c021"` 的 `is_fav` 仍為 `true`；新爬取結果中 `id` 不在收藏清單的職缺，`is_fav` 為 `false`。
3. **Given** 職缺 `id="a3f9c021"` 已在收藏清單中，**When** 呼叫「移除收藏」後再呼叫 `GET /last`，**Then** `id="a3f9c021"` 的 `is_fav` 為 `false`。
4. **Given** 收藏清單為空，**When** 呼叫 `GET /last`，**Then** 所有職缺的 `is_fav` 均為 `false`。

---

### Edge Cases

- 服務重啟後收藏清單應持續存在（資料不隨程序重啟而遺失）。
- 當 `id` 格式不合法（非 8 碼十六進位字串）時，系統應回傳 HTTP 400 並說明格式要求。
- 收藏清單的寫入操作（新增、移除）MUST 透過 in-process mutex 序列化執行，同一時間只允許一個寫入操作進行，防止並發請求造成資料損毀；讀取操作（列出、`GET /last` 計算 `is_fav`）無需加鎖。
- 重新爬取不會清空收藏清單，亦不會重置 `is_fav`；若新爬取結果中的某筆職缺 `id` 仍在收藏清單中，其 `is_fav` 仍為 `true`。只有呼叫「移除收藏」API 才能讓已收藏職缺的 `is_fav` 變為 `false`。
- `favorites.json` 存在但內容無效（損毀或 JSON 格式錯誤）時，系統 MUST 自動重置為空陣列 `[]` 並繼續正常運作，所有端點均不回傳錯誤；重置後的空清單視同全新初始狀態。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統 MUST 提供 `POST /favorites/:id` 端點；Server 自行從 `jobs.json` 中查找對應 `id` 的完整職缺資料（包含 `title`、`company`、`location`、`salary`、`url`、`source` 等欄位），並將其寫入收藏清單，前端請求僅需包含路徑 `id`，無需傳遞 request body。
- **FR-002**: 系統 MUST 在新增時以職缺 `id` 作為唯一鍵；重複新增相同 `id` 時回傳 HTTP 409 而不修改清單。
- **FR-003**: 系統 MUST 在新增收藏前先查找 `jobs.json`；若 `id` 不存在於爬取結果中則回傳 HTTP 404，反之以查得的職缺資料（含所有欄位）寫入收藏清單。
- **FR-004**: 系統 MUST 提供 `DELETE /favorites/:id` 端點，以冪等方式將路徑中的 `id` 從清單移除（無論是否存在皆回傳 HTTP 200）。
- **FR-005**: 系統 MUST 提供 `GET /favorites` 端點，以來源平台（`source` 欄位）為鍵，回傳各平台職缺陣列的分群物件；每個分群內的職缺 MUST 依 `savedAt` 降冪排序（最新收藏在前）。
- **FR-006**: 系統 MUST 在輸入 `id` 格式不合法（非 8 碼十六進位）時回傳 HTTP 400。
- **FR-007**: 收藏清單 MUST 持久化存儲，服務重啟後資料不遺失。
- **FR-008**: 所有端點回傳結構 MUST 遵循現有慣例 `{ ok: boolean, ... }`。例外：`GET /last` 繼承既有頂層陣列格式（見 plan.md Complexity Tracking），不納入本原則範疇。
- **FR-009**: `GET /last` MUST 在每筆職缺資料上附加 `is_fav: boolean` 欄位，其值由即時比對收藏清單（`favorites.json`）中的 `id` 集合動態計算，不寫入 `jobs.json`。
- **FR-011**: 收藏清單的寫入操作 MUST 透過 in-process mutex 序列化，確保並發請求下資料一致性；讀取操作無需加鎖。
- **FR-010**: `is_fav` 的值 MUST 完全由收藏清單中是否存在對應 `id` 決定：`id` 在清單中 → `true`，否則 → `false`。重新爬取不得改變收藏清單內容，亦不得重置任何職缺的 `is_fav`。唯有呼叫「移除收藏」API 才能將 `is_fav` 由 `true` 改為 `false`；新出現在爬取結果中、且 `id` 不在收藏清單的職缺，`is_fav` 自然為 `false`。
- **FR-012**: 系統在讀取 `favorites.json` 時，若檔案內容為無效 JSON，MUST 自動重置為空陣列 `[]` 並繼續處理請求，不得回傳任何錯誤回應；此自我修復行為適用於所有端點（`GET /favorites`、`POST /favorites/:id`、`DELETE /favorites/:id`、`GET /last`）。

### Key Entities

- **FavoriteEntry**：表示一筆被收藏的職缺快照。包含新增收藏當下從 `jobs.json` 讀取的完整欄位（`id`、`title`、`company`、`location`、`salary`、`url`、`source`），並附加收藏時間戳記（`savedAt`）。後續爬取不會自動更新此快照內容，欄位值永久反映收藏當時的資料。
- **FavoriteStore**：收藏清單的持久化資料結構。以陣列形式存儲所有 `FavoriteEntry`，作為純 JSON 持久化。
- **GroupedFavorites**：列表 API 的回傳結構。以 `source` 為鍵、`FavoriteEntry[]` 為值的物件（`Record<string, FavoriteEntry[]>`）。
- **EnrichedJob**：`GET /last` 的回傳單筆結構。為 `BaseJob` 的超集，額外附加 `is_fav: boolean` 欄位；此欄位僅存在於 API 回傳中，不寫回 `jobs.json`。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 新增、移除收藏操作可在 200 毫秒內完成回應（正常負載下）。
- **SC-002**: `GET /favorites` 列出收藏操作可在 200 毫秒內回傳完整分群結果。
- **SC-003**: 服務非預期重啟後，收藏清單資料完整保留，無遺失。
- **SC-004**: 所有端點在輸入合法格式時，系統正確率（狀態碼與結果符合預期）達 100%。
- **SC-005**: 重複新增或移除不存在的項目均可被測試腳本以冪等特性驗證，無需人工介入。
- **SC-006**: `GET /last` 的 `is_fav` 欄位可在收藏狀態變更後（新增或移除）立即於下次查詢中反映正確值，無需重新爬取，且回應時間在 200 毫秒以內。

## Assumptions

- 收藏功能為單一使用者（無多用戶會話區隔），無需身份驗證。
- 持久化採用本地 JSON 檔案（與 `jobs.json` 同機制），路徑可透過環境變數設定，預設為 `/app/data/favorites.json`。
- 職缺 `id` 的唯一性與格式（SHA-256 前 8 碼十六進位）已由 `generateId()` 工具函式保證，本功能沿用而不重新定義。`generateId()` 提供 16^8 ≈ 43 億種組合；在百筆職缺規模下，任意兩筆碰撞機率低於 0.000002%，風險可忽略，無需額外碰撞處理。
- 「最近一次爬取結果」定義為磁碟上現有的 `jobs.json` 檔案內容；若檔案不存在，則新增收藏時一律回傳 HTTP 404。
- 收藏清單儲存的是新增當下的職缺欄位快照；後續爬取若同一 `id` 的職缺內容有變動（如薪資更新），收藏清單不自動同步，`GET /favorites` 永遠回傳收藏當時的資料。
- 本次規格聚焦於 API 層，前端 UI 整合不在此範疇。
