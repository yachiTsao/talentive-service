# Feature Specification: Dashboard Chart Aggregation API

**Feature Branch**: `004-chart-aggregation-api`  
**Created**: 2026-04-12  
**Status**: Draft  
**Target**: `src/` — new `GET /charts` endpoint + `src/utils/chartUtils.ts`

## Clarifications

### Session 2026-04-12

- Q: 技術標籤資料來源為何：查詢時從 `title` 關鍵字推導，還是爬蟲端直接產生 `tags[]` 欄位？ → A: 查詢時從 `title` 推導，chartUtils.ts 內部做關鍵字比對；不異動現有 providers 或 Job schema。
- Q: `locations` 陣列中（除「其他」外）其餘縣市的排列順序為何？ → A: 依計數遞減排序，職缺數量多的縣市排前面；「其他」固定末尾。
- Q: `GET /charts` 的資料來源為直接讀取 jobs.json，還是重用 `GET /last` 的資料讀取邏輯？ → A: 重用 `GET /last` 的內部讀檔函式，共用相同的讀取路徑、錯誤處理與 crash-safe 行為，不另起讀取路徑。
- Q: `GET /charts` 是否需要加入認證授權（auth）機制？ → A: 不需要，與現有所有端點保持一致，無 auth 要求。
- Q: `GET /charts` 回應是否需要附加資料新鮮度資訊（最後爬取時間）？ → A: 需要，在 `data` 中加入 `lastCrawledAt` 欄位（與 `GET /health` 的 `last.at` 來源相同）；若尚無爬取記錄則為 `null`。

## User Scenarios & Testing _(mandatory)_

### User Story 1 - 取得來源平台比例統計 (Priority: P1)

前端在呈現「來源平台比例」環形圖前，可呼叫聚合端點取得三個平台（104、1111、Yourator）各自的職缺計數。即使某平台當前計數為 0，回應中仍須保留該平台，順序固定為 104 → 1111 → Yourator，讓前端不需自行補零或重排。

**Why this priority**: 平台分佈是 Dashboard 最基礎的統計維度，也是確認資料聚合流程能正常運作的最小可驗證切片。

**Independent Test**: 在 jobs.json 中備妥跨平台測試資料後呼叫 `GET /charts`，確認 `platforms` 陣列固定包含三個元素且順序正確，某平台為 0 時仍出現於回應。

**Acceptance Scenarios**:

1. **Given** jobs.json 中有 104（5 筆）、1111（3 筆）、Yourator（0 筆）的職缺，**When** 呼叫 `GET /charts`，**Then** 回應中 `platforms` 陣列按 104 → 1111 → Yourator 順序返回，值分別為 5、3、0。
2. **Given** jobs.json 不存在或為空陣列，**When** 呼叫 `GET /charts`，**Then** 回應中 `platforms` 三個平台計數均為 0，不回傳錯誤。
3. **Given** jobs.json 為有效資料，**When** 呼叫 `GET /charts`，**Then** HTTP 狀態碼為 200，回應包含 `platforms`、`tags`、`locations`、`lastCrawledAt` 四個欄位。
4. **Given** 尚未執行過任何爬取，**When** 呼叫 `GET /charts`，**Then** 回應中 `lastCrawledAt` 為 `null`。

---

### User Story 2 - 取得前端技術標籤比例統計 (Priority: P2)

前端在呈現「前端技術比例」環形圖前，可從 `GET /charts` 回應中取得已計算好的 Top 3 技術標籤計數及其他合計，不需前端自行解析職缺標題。回應中標籤名稱已完成大小寫正規化，相同技術不會因大小寫不同而重複計算。

**Why this priority**: 技術分佈是第二重要的圖表，依賴 P1 同一端點，可與 P1 一起交付後即可獨立驗證。

**Independent Test**: 在 jobs.json 中備妥含有大小寫混用標籤（如 `vue`、`Vue`、`VUE`）的大量職缺標題，呼叫 `GET /charts` 後確認 `tags` 陣列正規化正確、Top 3 順序正確、其餘合入「其他」。

**Acceptance Scenarios**:

1. **Given** 職缺標題中 Vue 出現 10 次（大小寫混用）、React 出現 6 次、Angular 出現 4 次、TypeScript 出現 2 次，**When** 呼叫 `GET /charts`，**Then** `tags` 陣列包含 Vue（10）、React（6）、Angular（4）三筆及「其他」（2）；TypeScript 歸入「其他」。
2. **Given** 所有職缺標題均不含任何已知前端技術關鍵字，**When** 呼叫 `GET /charts`，**Then** `tags` 回傳單一「其他」項目，計數等於職缺總數，不回傳空陣列。
3. **Given** 職缺標題含 `vue`、`Vue`、`VUE`，**When** 計算標籤時，**Then** 三者正規化為同一鍵值（如 `Vue`）不重複計算。

---

### User Story 3 - 取得工作地點分佈統計 (Priority: P2)

前端在呈現「工作地點分佈」折線圖前，可從 `GET /charts` 回應中取得正規化後各縣市的職缺計數，所有縣市均呈現。含行政區的地點字串（如「台北市信義區」）已被截取為縣市（「台北市」），空字串地點已歸類為「其他」並排列於末尾。

**Why this priority**: 地點分佈是第三個圖表維度，與平台、技術統計同屬聚合端點的獨立欄位，可獨立驗收。

**Independent Test**: 在 jobs.json 中備妥含行政區地點、純縣市地點及空字串地點的職缺，呼叫 `GET /charts` 後確認含行政區正規化、空字串歸為「其他」且排末尾。

**Acceptance Scenarios**:

1. **Given** 職缺 location 含「台北市信義區」（3 筆）、「台北市中山區」（2 筆）、「高雄市」（4 筆），**When** 呼叫 `GET /charts`，**Then** `locations` 中「台北市」計數為 5、「高雄市」為 4，含行政區的兩筆已正規化合併。
2. **Given** 部分職缺 location 為空字串（2 筆），**When** 呼叫 `GET /charts`，**Then** `locations` 末尾出現「其他」計數為 2，其餘縣市排在前面。
3. **Given** 所有縣市資料均有計數，**When** 呼叫 `GET /charts`，**Then** `locations` 包含所有縣市，不做數量截斷（不限制只顯示前 N 筆）。

---

### Edge Cases

- jobs.json 不存在時，`GET /charts` 回傳 HTTP 200，三個欄位均返回空值（platforms 三平台為 0，tags 空陣列，locations 空陣列），不回傳 HTTP 錯誤。
- jobs.json 存在但內容為無效 JSON 時，`GET /charts` 回傳 HTTP 500 並附錯誤訊息，與 `GET /last` 的行為保持一致。
- 職缺標題同時含多個已知技術關鍵字（如「Vue + React 工程師」）時，每個匹配到的關鍵字各計一次，同一職缺可貢獻多個標籤計數。
- location 字串長度不足三個字元時（如「台北」），維持原值，不截斷也不補足。
- tags 正規化只處理大小寫（統一為固定鍵值），不做同義詞合併（例如「Vue.js」和「Vue」各自獨立計算，除非前端要求合併）。

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: 系統**必須**新增 `GET /charts` 端點，成功時回傳 `{ ok: true, data: ChartStats }`（HTTP 200）；讀取失敗時回傳 `{ ok: false, error: string }`（HTTP 500），與現有端點一致。
- **FR-002**: `platforms` 欄位**必須**固定包含 `"104"`、`"1111"`、`"yourator"` 三個平台的計數（值與 Job `source` 欄位一致，均為小寫），且依此固定順序排列，計數為 0 時仍保留不省略。
- **FR-003**: `tags` 欄位**必須**依匹配頻率遞減排序，僅回傳前三名技術標籤；其餘技術計數合計為「其他」，若無「其他」則省略。
- **FR-004**: 技術標籤比對時**必須**進行大小寫正規化（統一轉為首字大寫），相同技術的不同大小寫形式合併計算。
- **FR-005**: `locations` 欄位**必須**對含行政區的地點字串取前三個字元作為縣市鍵值，空字串地點歸為「其他」。
- **FR-006**: `locations` 中其餘縣市**必須**依計數遞減排序；「其他」項目**必須**固定排列於陣列末尾，不限制縣市顯示數量。
- **FR-007**: 所有聚合計算邏輯（平台分組、標籤統計與正規化、地點正規化）**必須**以無副作用的純函式實作，集中於 `src/utils/chartUtils.ts`。
- **FR-008**: `GET /charts` 端點**必須**重用 `GET /last` 的內部資料讀取函式取得職缺陣列，不自行實作讀檔邏輯，也不重新觸發爬蟲。
- **FR-009**: `src/utils/chartUtils.ts` 中的每個純函式**必須**有對應的單元測試覆蓋（含邊界情境：空陣列、大小寫混用、含行政區地點、空字串地點）。
- **FR-010**: `GET /charts` 回應的 `data` 欄位**必須**包含 `lastCrawledAt`（ISO 8601 UTC 字串），其值來源與 `GET /health` 的 `last.at` 相同；若尚無爬取記錄則為 `null`。

### Key Entities _(include if feature involves data)_

- **ChartStats**：`GET /charts` 的回應 data 欄位結構，包含四個欄位：
  - `platforms`: `Array<{ platform: "104" | "1111" | "yourator"; count: number }>` — 固定三筆，依 104 → 1111 → yourator 順序排列；`platform` 值與 Job `source` 欄位相同（小寫）
  - `tags`: `Array<{ tag: string; count: number }>` — 最多四筆（Top 3 + 「其他」），依計數遞減排序；`tags` 為空時回傳空陣列
  - `locations`: `Array<{ location: string; count: number }>` — 所有縣市依計數遞減排序，「其他」固定末尾
  - `lastCrawledAt`: `string | null` — 最後一次爬取完成的 ISO 8601 UTC 時間戳；與 `GET /health` 的 `last.at` 來源相同，尚無爬取記錄時為 `null`
- **回應 Envelope**：遵循現有 SD 慣例，成功時 `{ ok: true, data: ChartStats }`，錯誤時 `{ ok: false, error: string }`。
- **chartUtils 純函式**：接受 `BaseJob[]` 陣列作為輸入，各函式分別輸出 `platforms`、`tags`、`locations` 統計結果，無外部依賴。

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `GET /charts` 端點在 jobs.json 資料就緒時回應時間在 200ms 以內（與其他端點標準一致）。
- **SC-002**: `chartUtils.ts` 中所有純函式達到 100% 單元測試覆蓋率，涵蓋空陣列、大小寫混用、含行政區地點、空字串地點的邊界情境。
- **SC-003**: `GET /charts` 回應結構穩定，前端可依 `ChartStats` 型別定義直接消費，無需額外資料轉換。
- **SC-004**: `platforms` 固定包含三個平台且順序不可變，測試以三個獨立情境（含零值平台）驗證此行為。

## Assumptions

- 前端在呼叫 `GET /charts` 前自行先觸發 `POST /crawl`，本端點只負責讀取已存在的爬取結果，不在內部觸發爬蟲。
- **技術標籤來源（已釐清）**：現有 `BaseJob` 型別無 `tags` 欄位；技術標籤透過查詢時對每筆職缺的 `title` 欄位進行關鍵字比對來推導，不擴充爬蟲或 Job schema。關鍵字清單定義於 `chartUtils.ts` 內部，不由外部設定或注入。
- `source` 欄位的值與現有系統一致：`"104"`、`"1111"`、`"yourator"`（小寫），回應中 `platform` 顯示名稱由 chartUtils 負責映射為展示用格式。
- `GET /charts` 直接呼叫 `GET /last` 所使用的內部讀檔函式取得 `BaseJob[]`，繼承其讀取路徑（`JOBS_OUTPUT`）、錯誤語意與 crash-safe 行為，不引入新的環境變數或讀取路徑。
- 職缺筆數在合理範圍內（數百至數千筆）；同步讀檔計算不需要非同步串流處理。
- `GET /charts` 與 `GET /last` 的錯誤行為差異：jobs.json **不存在**時 `/charts` 回傳 HTTP 200 含空統計（空的 ChartStats），而非 404；因為「尚無爬取資料」在圖表情境下是合法的空狀態，而非缺少必要前提。
- 認證授權（auth）不在本功能範圍內；`GET /charts` 與現有所有端點一致，不加任何 api key 或 token 驗證。
