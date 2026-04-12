# 任務清單：Dashboard 圖表聚合 API

**功能分支**：`004-chart-aggregation-api`  
**輸入文件**：`/specs/004-chart-aggregation-api/` 設計文件  
**前提文件**：plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/api.md ✅ quickstart.md ✅

## 格式：`[ID] [P?] [Story] 描述`

- **[P]**：可平行執行（不同檔案，且不依賴未完成的任務）
- **[Story]**：所屬使用者故事（US1、US2、US3）
- 每一任務描述均含確切檔案路徑

---

## 階段一：初始化（共用基礎建設）

**目的**：建立 `chartUtils.ts` / `chartUtils.test.ts` 兩個新檔案的骨架，所有使用者故事均依賴此基礎。

- [x] T001 建立 `src/utils/chartUtils.ts`，匯出型別（PlatformStat、TagStat、LocationStat、ChartStats）與 TECH_KEYWORDS 常數；以回傳 `[]` 的方式佔位三個函式簽章
- [x] T002 [P] 建立 `src/utils/chartUtils.test.ts`，包含 import 區塊與 `job()` 工廠輔助函式（Partial\<BaseJob\> 覆寫）

**Checkpoint**: 兩個新檔案存在且可通過 TypeScript 編譯（`npx tsc --noEmit`）

---

## 階段二：基礎建設（封鎖性前提）

**目的**：提取 `readJobs()` 私有輔助函式到 `src/server.ts`，此為 `/last` 重構與新 `/charts` 路由的共同前提。

**⚠️ 重要**：`/charts` 路由與 `/last` 重構均依賴此函式，US1–US3 的路由整合需等此階段完成。

- [x] T003 在 `src/server.ts` 的 `let isRunning` 上方新增 `readJobs(): BaseJob[]` 私有輔助函式 — 讀取 `process.env.OUTPUT`，檔案不存在時回傳 `[]`，JSON 無效時拋出例外

**Checkpoint**: `readJobs()` 已定義，`GET /last` 與後續 `/charts` 均可呼叫

---

## 階段三：使用者故事 1 — 來源平台比例統計（優先級：P1）🎯 MVP

**目標**：實作 `groupByPlatform` 並使 `GET /charts` 能正確回傳 `platforms` 欄位，三平台固定順序、零值保留。

**獨立驗收測試**：執行 `npx ts-node --test src/utils/chartUtils.test.ts`，確認 `groupByPlatform` 的 2 個測試全數通過；接著對執行中的 server 呼叫 `GET /charts`，確認回應中 `platforms` 固定含三筆且順序為 104 → 1111 → yourator。

### 使用者故事 1 的測試（依 FR-009 要求）

> **注意：先撰寫測試，確認測試在實作前為失敗狀態（T004）**

- [x] T004 [US1] 在 `src/utils/chartUtils.test.ts` 新增 2 個 `groupByPlatform` 測試：(1) 空陣列 → 三平台皆為 0，(2) 混合 source 職缺 → 計數正確且順序固定（104→1111→yourator）

### 使用者故事 1 的實作

- [x] T005 [US1] 在 `src/utils/chartUtils.ts` 實作 `groupByPlatform(jobs: BaseJob[]): PlatformStat[]` — 固定計數 Map + 固定輸出順序，遵循 FR-002

**Checkpoint**: `groupByPlatform` 的所有測試通過

---

## 階段四：使用者故事 2 — 前端技術標籤比例統計（優先級：P2）

**目標**：實作 `extractTechTags`，支援大小寫正規化、前三名截取、「其他」合計，使 `GET /charts` 回傳正確 `tags` 欄位。

**獨立驗收測試**：執行 `npx ts-node --test src/utils/chartUtils.test.ts`，確認 `extractTechTags` 的 5 個測試全數通過；在 jobs.json 含大小寫混用職缺時呼叫 `GET /charts`，確認 `tags` 最多 4 筆（前三名 + 其他）且不因大小寫重複計算。

### 使用者故事 2 的測試（依 FR-009 要求）

> **注意：先撰寫測試，確認測試在實作前為失敗狀態（T006）**

- [x] T006 [P] [US2] 在 `src/utils/chartUtils.test.ts` 新增 5 個 `extractTechTags` 測試：(1) 空陣列 → `[]`，(2) vue/Vue/VUE 正規化為同一鍵，(3) 無任何已知關鍵字 → 單一「其他」等於職缺總數，(4) Vue×10/React×6/Angular×4/TypeScript×2 → 前三名 + 其他=2，(5) 恰好三種技術無殘餘 → 「其他」省略（CHK014）

### 使用者故事 2 的實作

- [x] T007 [US2] 在 `src/utils/chartUtils.ts` 實作 `extractTechTags(jobs: BaseJob[]): TagStat[]` — TECH_KEYWORDS Map、不分大小寫比對、其他計數器、前三名截取 + restCount，遵循 FR-003/FR-004

**Checkpoint**: `extractTechTags` 的所有測試通過

---

## 階段五：使用者故事 3 — 工作地點分佈統計（優先級：P2）

**目標**：實作 `groupByLocation`，全部縣市依計數遞減排序、含行政區正規化、空字串歸「不明」並固定末尾。

**獨立驗收測試**：執行 `npx ts-node --test src/utils/chartUtils.test.ts`，確認 `groupByLocation` 的 6 個測試全數通過；在 jobs.json 含行政區及空字串地點時呼叫 `GET /charts`，確認 `locations` 正規化正確且「不明」排末尾。

### 使用者故事 3 的測試（依 FR-009 要求）

> **注意：先撰寫測試，確認測試在實作前為失敗狀態（T008）**

- [x] T008 [P] [US3] 在 `src/utils/chartUtils.test.ts` 新增 6 個 `groupByLocation` 測試：(1) 空陣列 → `[]`，(2) 含行政區「台北市信義區」正規化為「台北市」，(3) 空字串 → 「不明」固定末尾，(4) 短地點（<3 字元）維持原值，(5) 「不明」計數最大時仍置末尾，(6) 全部 location 均為空字串 → 僅「不明」一筆（CHK015）

### 使用者故事 3 的實作

- [x] T009 [US3] 在 `src/utils/chartUtils.ts` 實作 `groupByLocation(jobs: BaseJob[]): LocationStat[]` — slice(0,3) 正規化、「不明」鍵獨立處理後強制附加末尾，遵循 FR-005/FR-006

**Checkpoint**: `groupByLocation` 的所有測試通過；`src/utils/chartUtils.ts` 三個純函式全部完整

---

## 階段六：收尾與橫切關注點

**目的**：整合純函式至 Express 路由、重構現有 `/last` 使用共用 `readJobs()`、最終端對端驗證。

- [x] T010 在 `src/server.ts` 新增 chartUtils 匯入：從 `./utils/chartUtils` 匯入 `groupByPlatform`、`extractTechTags`、`groupByLocation`、`type ChartStats`；若尚未匯入則從 `./providers/types` 補上 `import type { BaseJob }`
- [x] T011 重構 `src/server.ts` 的 `GET /last` 路由，改呼叫 `readJobs()` 取代內聯的 `fs.readFileSync`（移除重複讀取邏輯；檔案不存在的 404 防護仍保留在 `/last` 側，遵循 research.md 決策五）
- [x] T012 在 `src/server.ts` 新增 `GET /charts` 路由 — 位於 `GET /last` 之後、`app.use('/favorites', ...)` 之前；使用三個純函式 + `lastMeta?.at ?? null` 組裝 `ChartStats`，遵循 data-model.md 狀態管理章節
- [x] T013 執行 `npm test`，確認 `src/utils/chartUtils.test.ts` 中全部 13 個單元測試零失敗通過
- [x] T014 手動冒煙測試：啟動 server，`curl GET /charts`（預期 `ok:true`、`lastCrawledAt:null`、三個欄位均為空）；接著 `POST /crawl`，再次 `curl GET /charts`（預期統計資料已填充且 `lastCrawledAt` 非 null）

**Checkpoint**: `GET /charts` 完整可用；全部測試通過；`GET /last` 行為與重構前一致

---

## 依賴關係（故事完成順序）

```
T001 → T002 → T003 → [T004 → T005] → [T006 → T007] → [T008 → T009] → T010 → T011 → T012 → T013 → T014
                 ↑
        T010–T012 的封鎖性前提
```

- **US1（T004–T005）** 依賴：T001（型別）、T002（測試骨架）
- **US2（T006–T007）** 依賴：T001（型別）、T002（測試骨架）；可於 T005 後開始或平行進行（同檔案不同函式 — 建議循序執行）
- **US3（T008–T009）** 依賴：T001（型別）、T002（測試骨架）；同 US2 說明
- **T010–T012** 依賴：T003（readJobs 輔助函式）、T005（groupByPlatform）、T007（extractTechTags）、T009（groupByLocation）
- **T013** 依賴：T012（路由完成）
- **T014** 依賴：T012（路由完成）

---

## 平行執行範例

### 階段一～二完成後（T001–T003 循序執行）

| 執行者 A（US1）             | 執行者 B（US2）             | 執行者 C（US3）             |
| --------------------------- | --------------------------- | --------------------------- |
| T004 — groupByPlatform 測試 | T006 — extractTechTags 測試 | T008 — groupByLocation 測試 |
| T005 — groupByPlatform 實作 | T007 — extractTechTags 實作 | T009 — groupByLocation 實作 |

> ⚠️ 三個純函式共用 `chartUtils.ts` 與 `chartUtils.test.ts`，平行執行時須協調檔案編輯以避免衝突 — 最安全的方式為循序執行（US1 → US2 → US3）。

### 最終整合（T010–T012 循序，T013–T014 可平行）

| 執行者 A               | 執行者 B            |
| ---------------------- | ------------------- |
| T013 — 執行 `npm test` | T014 — 手動冒煙測試 |

---

## 實作策略

**MVP 範圍**：階段一 + 階段二 + 階段三（T001–T005）即可產出可運作的 `GET /charts`（含 `platforms` 資料），足以驗證 jobs.json → 純函式 → HTTP 回應的完整流程。

**漸進式交付**：

1. **MVP**（T001–T005 + T010–T012 部分完成）：平台環形圖資料可用
2. **加入 US2**（T006–T007）：技術標籤環形圖資料可用
3. **加入 US3**（T008–T009 + T012 完成）：地點折線圖資料可用
4. **收尾**（T010–T014）：`/last` 重構 + 完整測試驗證

**任務總數**：14  
**各故事任務數**：US1 = 2 個（T004–T005）、US2 = 2 個（T006–T007）、US3 = 2 個（T008–T009）  
**初始化／基礎建設**：3 個（T001–T003）  
**收尾／整合**：5 個（T010–T014）

**格式驗證**：全部 14 個任務均遵循必要的清單格式 — `- [ ] T### [P?] [US?] 含檔案路徑的描述`。
