# API Requirements Quality Checklist: Favorite API

**Purpose**: 作者自審（PR 提交前）— 驗證四個端點的需求品質：完整性、清晰度、一致性、可量測性與場景覆蓋度
**Created**: 2026-04-06
**Feature**: [spec.md](../spec.md) | [contracts/api.md](../contracts/api.md) | [data-model.md](../data-model.md)

---

## Requirement Completeness（需求完整性）

- [x] CHK001 - 四個端點（`POST /favorites/:id`、`DELETE /favorites/:id`、`GET /favorites`、`GET /last`）是否都有對應的 FR 編號覆蓋？ [Completeness, Spec §FR-001–FR-011] → FR-001/FR-002/FR-003（POST）、FR-004（DELETE）、FR-005（GET /favorites）、FR-009/FR-010（GET /last）
- [x] CHK002 - `POST /favorites/:id` 的回應欄位（`data` 物件完整結構）是否在合約中明確列出？ [Completeness, contracts/api.md] → contracts/api.md §201 Created 列出所有 FavoriteEntry 欄位
- [x] CHK003 - `GET /favorites` 群內職缺的排序規則（`savedAt` 降冪）是否在 spec 或 data-model 中有對應的需求描述？ [Completeness, data-model.md §GroupedFavorites] → data-model.md §GroupedFavorites：「群內職缺依 `savedAt` 降冪排序」
- [x] CHK004 - `GET /last` 修改完整的回應結構是否有說明哪些欄位「原樣保留」、哪些為新增？ [Completeness, contracts/api.md §GET /last] → contracts/api.md §GET /last：「原有回應欄位完全保留，僅新增 `is_fav`」
- [x] CHK005 - 所有端點的 HTTP 5xx 錯誤情境（I/O 失敗、JSON 解析失敗）是否都有對應的需求描述？ [Completeness, Gap] → contracts/api.md 為全部四端點定義 500 回應；plan.md 憲法檢查確認 try/catch 覆蓋
- [x] CHK006 - `favorites.json` 不存在時（首次啟動，尚無任何收藏）的行為是否有明確需求？`GET /favorites` 應回傳 `{}` 還是建立空檔案？ [Completeness, Gap] → data-model.md §FavoriteStore 空狀態為 `[]`（file 不存在等同空清單）；spec §US2 情境 2 確認回傳 `{}`
- [x] CHK007 - `jobs.json` 不存在（尚未爬取）時，`POST /favorites/:id` 應回傳 404 的需求是否在 spec 中明確記錄？ [Completeness, Spec §Assumptions] → spec §Assumptions：「若檔案不存在，則新增收藏時一律回傳 HTTP 404」

---

## Requirement Clarity（需求清晰度）

- [x] CHK008 - FR-009 中「即時比對」是否明確說明比對的時間點（每次 `GET /last` 請求時動態計算，而非快取）？ [Clarity, Spec §FR-009] → FR-009：「動態計算」；research.md §研究問題4 確認每次請求即時載入 Set
- [x] CHK009 - FR-010 的「重新爬取不得改變收藏清單內容」是否足夠具體，或可能被誤解為爬取完成後需特別清除某狀態？ [Clarity, Spec §FR-010] → FR-010 明確：「不得改變收藏清單內容，亦不得重置任何職缺的 `is_fav`」，唯移除 API 可改變
- [x] CHK010 - data-model 中 `FavoriteEntry` 的「不變性」描述是否清楚說明快照語意（收藏後若職缺薪資更新，清單內資料不同步）？ [Clarity, data-model.md §FavoriteEntry] → data-model.md §FavoriteEntry 不變性 + spec §Assumptions 均以薪資更新為例明確說明
- [x] CHK011 - FR-006 「id 格式不合法」是否明確指定正則表示式 `/^[0-9a-f]{8}$/`，使驗收測試可直接根據規格撰寫？ [Clarity, Spec §FR-006] → data-model.md §驗證規則 + research.md §研究問題5 均明確指定 `/^[0-9a-f]{8}$/`
- [x] CHK012 - `DELETE /favorites/:id` 的冪等行為（不存在時仍回傳 200）是否與同類 HTTP DELETE 慣例一致，且已在 spec 中說明理由？ [Clarity, Spec §FR-004] → FR-004 + US3 情境 2 明確定義冪等行為；HTTP DELETE 冪等為 RFC 7231 標準慣例
- [x] CHK013 - `savedAt` 欄位的格式（ISO 8601 UTC）是否在需求或合約中明確定義，避免時區歧義？ [Clarity, data-model.md §FavoriteEntry] → data-model.md：「ISO 8601 時間戳記，收藏當下的 UTC 時間」；contracts/api.md 範例以 `Z` 結尾確認 UTC

---

## Requirement Consistency（需求一致性）

- [x] CHK014 - spec §FR-001、contracts/api.md 中 `POST /favorites/:id` 的描述是否一致（均為「路徑 id，無 body」）？ [Consistency, Spec §FR-001 vs contracts/api.md] → FR-001：「無需傳遞 request body」；contracts: Body = 無 ✅
- [x] CHK015 - spec §FR-010 中「is_fav 由收藏清單決定」與 data-model.md §is_fav 計算規則是否使用相同語意，無矛盾？ [Consistency, Spec §FR-010 vs data-model.md] → 兩者均為「id 在 favorites.json → true，否則 → false」，語意一致 ✅
- [x] CHK016 - `GET /last` 回傳陣列（非 `{ ok, data }` 包裝）的格式是否與憲法「`{ ok: boolean, ... }` 統一結構」原則有衝突？若有，是否已在 Complexity Tracking 中記錄例外？ [Consistency, Spec §FR-008 vs plan.md §Complexity Tracking] → 已記錄於 plan.md §Complexity Tracking：「繼承性例外，前端依賴現有陣列格式，破壞性變更不在本功能範疇」
- [x] CHK017 - spec §Edge Case（mutex 保護讀取不加鎖）與 FR-011（mutex 保護寫入操作）是否一致，且範疇界定（讀取免鎖）有明確說明？ [Consistency, Spec §FR-011 vs Edge Cases] → FR-011：「讀取操作無需加鎖」；Edge Case 同步描述「讀取操作...無需加鎖」，完全一致 ✅
- [x] CHK018 - data-model 中 `GroupedFavorites` 定義的鍵（`source` 值）是否與 spec §US2 驗收情境中的平台名稱範例（`104`、`yourator`）一致？ [Consistency, data-model.md vs Spec §US2] → GroupedFavorites 鍵為「`FavoriteEntry.source` 的值，動態產生」；US2 範例使用 `104`、`yourator`，與 `source` 欄位值一致 ✅

---

## Acceptance Criteria Quality（驗收標準品質）

- [x] CHK019 - SC-001（200ms 新增/移除）是否可量測？是否定義了量測基準（如「單次請求、本地環境」）？ [Measurability, Spec §SC-001] → SC-001：「正常負載下」；plan.md Technical Context：「本地 JSON 讀寫」；量測基準充分
- [x] CHK020 - SC-004「系統正確率達 100%」是否有明確的測試範圍邊界，避免解讀為「所有可能輸入均正確」？ [Measurability, Spec §SC-004] → SC-004：「輸入合法格式時」為明確邊界，避免解讀過廣 ✅
- [x] CHK021 - US1 的驗收情境 1 是否指定了新增成功後「出現在收藏清單中」的具體驗證方式（呼叫 `GET /favorites` 確認）？ [Acceptance Criteria, Spec §US1] → 規格層說明「出現在收藏清單中」為目標狀態；具體驗證方式（`GET /favorites`）屬測試實作細節，不需規格指定 ✅
- [x] CHK022 - US4 的驗收情境 2（爬取後 `is_fav` 維持 `true`）是否明確說明測試前提（新爬取結果中仍包含相同 id）？ [Acceptance Criteria, Spec §US4] → US4 情境 2：「新結果中仍包含 `id="a3f9c021"` 的職缺」，前提已明確說明 ✅

---

## Scenario Coverage（場景覆蓋度）

- [x] CHK023 - `POST /favorites/:id` 是否有覆蓋「`jobs.json` 存在且 id 合法但 `favorites.json` 不存在」的首次新增情境？ [Coverage, Gap] → data-model.md §FavoriteStore：空狀態 `[]`（file 不存在等同空清單）；loadFavorites 設計為 file 不存在時回傳 `[]`，首次新增自然可行 ✅
- [x] CHK024 - `GET /favorites` 是否覆蓋「所有收藏均來自同一平台」的情境（GroupedFavorites 僅有單一鍵）？ [Coverage, Gap] → GroupedFavorites 定義為 `Record<string, FavoriteEntry[]>`，單一鍵為合法的輸出格式；行為由資料模型清晰定義 ✅
- [x] CHK025 - 並發請求情境（兩個同時 `POST /favorites/:id` 相同 id）是否有對應的需求描述，說明其中一個應得到 409？ [Coverage, Spec §Edge Cases] → FR-002（重複 id → 409）+ FR-011（mutex 序列化寫入）合併確保：第二個請求排隊後執行時必得 409 ✅
- [x] CHK026 - `GET /last` 在 `favorites.json` 不存在時的 `is_fav` 計算行為是否有明確需求（應全為 `false`）？ [Coverage, Gap] → FR-009/FR-010：is_fav 完全由 favorites.json id Set 決定；Set 為空（file 不存在）→ 全為 `false`；US4 情境 4 也明確測試空清單時全為 `false` ✅
- [x] CHK027 - 收藏某職缺後，爬取結果更新導致該 id 不再出現於 `jobs.json`，但 `is_fav` 計算仍參照 `favorites.json` 的情境是否有說明？ [Coverage, Gap] → FR-009：「即時比對 `favorites.json` 中的 id 集合」；FR-010：「is_fav 完全由收藏清單決定」，明確不依賴 jobs.json ✅

---

## Non-Functional Requirements（非功能需求）

- [x] CHK028 - 持久化需求（FR-007）是否明確說明服務重啟後的保留行為，以及 Docker volume 掛載作為實現前提的假設？ [NFR: Durability, Spec §FR-007] → spec §Assumptions 說明路徑可設定；quickstart.md Docker 段落明確示範 volume 掛載 ✅
- [x] CHK029 - in-process mutex（FR-011）的適用範圍是否清楚：僅 `favorites.json` 的寫入操作，不影響 `jobs.json` 讀取？ [NFR: Concurrency, Spec §FR-011] → FR-011：「收藏清單的寫入操作 MUST 透過 in-process mutex；讀取操作無需加鎖」，範疇明確 ✅
- [x] CHK030 - 是否有記錄「單用戶、無 auth」的範疇邊界，說明若未來需要多用戶支援，此設計需重新評估？ [NFR: Scalability, Spec §Assumptions] → spec §Assumptions：「單一使用者（無多用戶會話區隔），無需身份驗證」，邊界已記錄 ✅

---

## Dependencies & Assumptions（相依性與假設）

- [x] CHK031 - 「從 `jobs.json` 查找職缺完整資料」的前提（FR-003）是否說明若 `jobs.json` 格式損毀或缺少欄位時的回退行為？ [Dependency, Spec §FR-003] → try/catch（憲法原則，plan.md 憲法檢查確認）確保 JSON 解析失敗時回傳 HTTP 500；contracts/api.md 為所有端點定義 500 回應 ✅
- [x] CHK032 - `generateId()` 函式的唯一性假設（SHA-256 前 8 碼供收藏 id 識別）是否與實際碰撞機率做過評估，並在假設中記錄風險？ [Assumption, Spec §Assumptions] → spec §Assumptions 已補充：16^8 ≈ 43 億組合；百筆職缺規模碰撞機率 < 0.000002%，風險可忽略，明確記錄不需額外碰撞處理 ✅
- [x] CHK033 - `FAVORITES_OUTPUT` 環境變數的預設值路徑（`/app/data/favorites.json`）是否與 Docker 掛載設定（quickstart.md）一致？ [Dependency, quickstart.md vs Spec §Assumptions] → spec §Assumptions、plan.md §Storage、quickstart.md Docker 段落三者均一致使用 `/app/data/favorites.json` ✅

---

## Ambiguities & Conflicts（待釐清項目）

- [x] CHK034 - `GET /last` 回傳格式為頂層陣列（`[...{is_fav}]`），與憲法「`{ ok: boolean, ... }` 統一結構」之間的歧異是否已明確決策並記錄？ [Ambiguity, Spec §FR-008] → 已記錄於 plan.md §Complexity Tracking：繼承性例外，前端依賴現有格式，破壞變更不在範疇
- [x] CHK035 - `DELETE /favorites/:id` 的回應 body 僅為 `{ ok: true }`（無 `data` 欄位），是否與其他端點的回應結構一致，或已說明此差異為設計選擇？ [Ambiguity, contracts/api.md §DELETE] → `{ ok: true }` 符合「`{ ok: boolean, ... }` 統一結構」慣例；DELETE 操作無業務資料需回傳，不含 `data` 欄位為合理設計選擇 ✅

## Notes

- 深度等級：Standard（作者自審用，涵蓋所有場景類別）
- 受眾時機：PR 提交前，由實作者逐項確認
- 閘門機制：無（所有項目同等重要）
- **35/35 項目已確認覆蓋** ✅
