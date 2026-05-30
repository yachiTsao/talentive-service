# Pure Functions Checklist: Dashboard Chart Aggregation API

**Purpose**: Plan review — 驗證 `chartUtils.ts` 三個純函式規格的品質，確認在進入 `/speckit.tasks` 實作前，各函式的輸入輸出、排序規則、正規化邏輯與邊界情境已足夠清晰可測試。
**Created**: 2026-04-12
**Feature**: [spec.md](../spec.md) | [data-model.md](../data-model.md)
**Timing**: Plan review（進入 `/speckit.tasks` 前）
**Depth**: Quick sanity check（~18 題）

---

## Requirement Completeness — 函式規格是否完整

- [x] CHK001 — `groupByPlatform` 的規格是否明確定義「未知 source（非 104/1111/yourator）」的處理方式（計入哪個分類或直接忽略）？ [Completeness, data-model.md §groupByPlatform] ✓ data-model.md §groupByPlatform「未知 source 不計入任何平台」
- [x] CHK002 — `extractTechTags` 的規格是否定義「恰好前三名計數相同（並列第三）」時的決勝規則？ [Completeness, Ambiguity, data-model.md §extractTechTags] ✓ data-model.md「並列時依 TECH_KEYWORDS 定義順序穩定排序」
- [x] CHK003 — `extractTechTags` 的「其他」定義是否同時涵蓋：排名第四以後的已知技術 **與** 不匹配任何關鍵字的職缺兩種來源？ [Completeness, data-model.md §extractTechTags] ✓ data-model.md 計算流程（已補充）`restCount = 排名4+已知技術合計 + others`
- [x] CHK004 — `groupByLocation` 的規格是否定義「恰好三字但不符合台灣縣市格式（如英文地點 'Tai'）」的處理方式？ [Completeness, Gap] ✓ 規則為通用 `.slice(0,3)`，任何字串均等一視同仁；英文三字母 → 維持原值，與台灣縣市行為一致
- [x] CHK005 — `ChartStats` 型別中 `lastCrawledAt` 的來源（由 `server.ts` 注入，非 `chartUtils.ts` 計算）是否在 data-model.md 中已明確標示，避免實作者誤將其加入純函式？ [Completeness, data-model.md §狀態管理] ✓ data-model.md §狀態管理 + 型別註釋均已標示「由 server.ts 注入，非 chartUtils 計算」

---

## Requirement Clarity — 規格是否足夠清晰可測試

- [x] CHK006 — `extractTechTags` 中「大小寫正規化」的輸出格式是否無歧義？規格說「Title Case」，但 `Next.js`、`Node.js` 含點號，是否列入範例說明？ [Clarity, Ambiguity, data-model.md §extractTechTags] ✓ TECH_KEYWORDS 常數本身即為規範性顯示名稱（`"Next.js"`、`"Node.js"` 已列入清單），輸出等於關鍵字清單中的原始字串
- [x] CHK007 — `extractTechTags` 中「單一職缺匹配多個關鍵字時各自計入」—— 「計入」的對象是**每個關鍵字各自的計數**，還是整體職缺總計？規格是否可被直接轉為測試情境？ [Clarity, data-model.md §extractTechTags] ✓ quickstart 程式碼 `counts.set(kw, (counts.get(kw) ?? 0) + 1)` 對每個 keyword 獨立累加，語意清晰
- [x] CHK008 — `groupByLocation` 的「前三字」規則是否定義以 **Unicode 字元**（而非 byte）為單位？對中文三字（3 個 Unicode codepoint）與英文三字母（3 bytes）的處理是否一致？ [Clarity, Gap] ✓ 已補充至 data-model.md：JS `String.slice` 以 UTF-16 字元為單位，中英文行為一致
- [x] CHK009 — `extractTechTags` 空輸入（`[]`）時回傳 `[]`（無「其他」），這與「無已知技術時回傳單一『其他』= 職缺總數」的規則是否存在矛盾？規格書是否明確區分這兩種情境？ [Clarity, Consistency, data-model.md §extractTechTags] ✓ quickstart 有兩個各自獨立的測試案例（空陣列 vs 有職缺但無匹配）清楚區分；空陣列 → others=0 → 不產生「其他」，邏輯一致

---

## Requirement Consistency — 規格內部是否一致

- [x] CHK010 — `groupByPlatform` 規格說「未知 source 不計入任何平台」，而 `extractTechTags` 說「不匹配者計入『其他』」—— 兩種不同的剩餘項處理方式是否為刻意設計，且已在 spec 或 data-model 中說明原因？ [Consistency, Spec §FR-002, FR-003] ✓ 已補充設計備註至 data-model.md：平台清單封閉（未知=無效資料）vs 技術標籤開放（不識別=尚未分類），刻意不同
- [x] CHK011 — `extractTechTags` 的排序規則有兩個維度（計數遞減 + TECH_KEYWORDS 定義順序穩定排序），而 `groupByLocation` 只有一個（計數遞減）。兩者的並列處理策略不一致，是否為預期行為且已記錄？ [Consistency, data-model.md §extractTechTags, §groupByLocation] ✓ 已補充至 data-model.md §groupByLocation：並列時使用 JS 穩定排序預設行為（即無額外決勝規則），此為刻意設計

---

## Acceptance Criteria Quality — 成功標準是否可量測

- [x] CHK012 — 測試涵蓋矩陣（data-model.md 末節）中的每一項，是否都能獨立對應到一個可編寫的 `node:test` 測試案例（有明確輸入與預期輸出）？ [Measurability, data-model.md §測試涵蓋矩陣] ✓ quickstart.md 已提供所有矩陣項目的完整測試程式碼（輸入 + `assert` 預期值）
- [x] CHK013 — `groupByPlatform` 的「三平台順序不可變」測試，是否有具體的 `assert.deepEqual` 預期值（包含順序）而非只驗證長度？ [Measurability, data-model.md §groupByPlatform] ✓ quickstart.md `assert.deepEqual(result, [{ platform: '104', count: 0 }, ...])`（包含完整順序）

---

## Scenario Coverage — 邊界情境是否涵蓋

- [x] CHK014 — 恰好有三種已知技術（剛好等於 Top 3 上限）時，「其他」應被省略——此情境是否有明確的測試情境或範例？ [Coverage, Edge Case, data-model.md §extractTechTags] ✓ 已補充至 data-model.md 測試涵蓋矩陣；data-model.md 規則「若前三名已涵蓋所有計數（無殘餘），不加入『其他』」已明確定義，quickstart 程式碼 `if (restCount > 0)` 實作一致
- [x] CHK015 — `groupByLocation` 中若所有職缺地點均為空字串（全部為「其他」），輸出應為僅含「其他」一筆——此情境是否已定義？ [Coverage, Edge Case, Gap] ✓ 已補充至 data-model.md §groupByLocation 表格（「全部空字串」規格列）與測試涵蓋矩陣
- [x] CHK016 — `extractTechTags` 中 TECH_KEYWORDS 若未來擴充（如加入 `Astro`），現有規格是否確保舊測試不需修改（函式行為對清單異動是否穩定）？ [Coverage, Assumption] ✓ 已補充擴充備註至 data-model.md：新增項目不影響現有測試；若在並列項之間插入則需同步檢視並列測試

---

## Dependencies & Assumptions — 依賴與假設是否記錄

- [x] CHK017 — `readJobs()` 回傳 `BaseJob[]` 的假設（所有 `source` 均為字串、`location` 不為 null/undefined）是否在 data-model.md 或 spec.md 中明確標注，以便 chartUtils 純函式不需自行防禦？ [Assumption, Gap] ✓ 憲法保證「缺值用空字串 `""`，非 null 或 undefined」，chartUtils 純函式無需額外防禦
- [x] CHK018 — `lastCrawledAt` 由 `server.ts` 的 `lastMeta` 注入，意味著**服務重啟後**即使 jobs.json 存在也會回傳 `null`——此行為限制是否已記錄在 spec 或 data-model 中，讓前端開發者知情？ [Assumption, data-model.md §狀態管理] ✓ contracts/api.md §lastCrawledAt「服務重啟後若未再爬取則為 null」已明確記載

---

## Notes

- 所有 18 項已全部通過（`[x]`）。
- 12 項在既有文件中直接確認；6 項（CHK008、CHK010、CHK011、CHK014、CHK015、CHK016）透過補充 data-model.md 最小說明後確認。
- **data-model.md 異動摘要**：
  - §groupByLocation 新增「Unicode 字元」說明（CHK008）、「全部空字串」規格行（CHK015）、「並列時使用 JS 穩定排序」備註（CHK011）
  - §extractTechTags 計算流程 Step 4 更新「其他」涵蓋雙來源（CHK003），新增設計備註說明兩函式不同剩餘項處理策略（CHK010）
  - 測試涵蓋矩陣新增「恰好三種技術、其他省略」與「全部空字串地點」兩行（CHK014、CHK015），以及 TECH_KEYWORDS 擴充備註（CHK016）
- plan.md **未作任何修改**。
