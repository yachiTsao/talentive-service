# Tasks: 優化爬蟲流程並加入 id 欄位

**Input**: Design documents from `/specs/002-optimize-flow-add-id/`
**Prerequisites**: plan.md ✅、spec.md ✅、research.md ✅、data-model.md ✅、contracts/api.md ✅

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: 可與其他標示 [P] 的任務並行執行（操作不同檔案，無未完成依賴）
- **[Story]**: 對應 spec.md 的 User Story（US1/US2/US3）
- 每個任務包含精確檔案路徑

---

## Phase 1: Setup — 測試基礎建設

**目的**: 建立測試執行環境，使後續測試任務可被執行

- [x] T001 在 `package.json` 的 `scripts` 中新增 `"test"` 指令：`"node --require ts-node/register --test src/**/*.test.ts"`

**Checkpoint**: `npm test` 可執行（目前零測試，應輸出 pass 0 tests）

---

## Phase 2: Foundational — 核心型別與共用模組

**目的**: 建立所有 User Story 均依賴的型別定義與共用函式

⚠️ **CRITICAL**: 以下兩項 MUST 在 Phase 3 開始前完成

- [x] T002 更新 `src/providers/types.ts`：在 `BaseJob` 介面最前方新增 `id: string` 欄位（必填，不帶 `?`）
- [x] T003 建立 `src/utils/id.ts`：僅匯出函式簽章（stub），內容為 `throw new Error('not implemented')`，供後續測試先行編譯

**Checkpoint**: `tsc --noEmit` 可通過（所有 Provider 回傳型別需暫時加 `as any` 或調整為 `Omit<BaseJob, 'id'>` 以消除型別錯誤 — 由 T006 最終修正）

---

## Phase 3: User Story 1 — 每筆職缺具備唯一識別碼 (Priority: P1) 🎯 MVP

**Goal**: 每筆爬取職缺均含 `id` 欄位（SHA-256 前 8 碼），確定性、唯一、向後相容

**Independent Test**: `POST /crawl` 回傳資料中每筆含非空 `id`；相同 URL 兩次爬取 `id` 一致；`GET /last` 對舊版 JSON 回傳補齊後的 `id`

### Tests for User Story 1

> ⚠️ 先寫測試，確認測試**失敗**後再進行實作

- [x] T004 [P] [US1] 建立 `src/utils/id.test.ts`：寫 `generateId` 單元測試 — 相同 URL 回傳相同結果、長度為 8、僅含 `[0-9a-f]`、不同 URL 多數回傳不同結果
- [x] T005 [P] [US1] 在 `src/utils/id.test.ts` 補充 `assignIds` 單元測試 — 所有 jobs 均獲得 `id`、id 全部唯一、碰撞時後出現者被捨棄並觸發 `console.warn`

### Implementation for User Story 1

- [x] T006 [US1] 在 `src/utils/id.ts` 實作 `generateId(url: string): string`：使用 `crypto.createHash('sha256').update(url, 'utf8').digest('hex').slice(0, 8)`（Node.js 內建 `crypto`，零新依賴）
- [x] T007 [US1] 在 `src/crawler.ts` 實作 `assignIds(jobs: BaseJob[]): BaseJob[]`：以 id 為 key 的 Map 偵測碰撞，碰撞時以 `console.warn('[ID COLLISION] id=... url1=... url2=...')` 記錄並捨棄後出現者
- [x] T008 [US1] 在 `src/crawler.ts` 的 `scrapeOnce()` 中，於 `dedupeByUrl()` 之後串接 `assignIds()` 呼叫
- [x] T009 [US1] 更新 `src/server.ts` 的 `GET /last` handler：讀取 JSON 後偵測是否有缺少 `id` 的筆數；若有則以 `generateId()` 在記憶體補齊後 `res.json(patched)`，MUST NOT 寫回磁碟；缺少 `url` 的筆數 `id` 填入 `""` 並以 `console.warn` 記錄

**Checkpoint**: 此時 US1 可獨立驗證 — `POST /crawl` 回傳含 `id` 的職缺；`GET /last` 對舊版 JSON 補齊 `id`；`npm test` 通過 T004/T005 測試

---

## Phase 4: User Story 2 — 多平台並行爬取 (Priority: P2)

**Goal**: 各 provider 同時執行，總爬取時間 ≤ 最慢 provider 的 1.5 倍；每個 provider 有 120 秒獨立逾時

**Independent Test**: 指定 104、yourator、1111 三個平台爬取，觀察三個 `[PROVIDER]` 日誌幾乎同時出現（非逐一順序）；總耗時明顯短於三個平台串行的估算時間

### Tests for User Story 2

- [x] T010 [P] [US2] 在 `src/crawler.test.ts` 建立 `withTimeout` 單元測試：正常 Promise resolve 正確透傳、超時後 reject 含逾時訊息、`clearTimeout` 在 resolve 與 reject 路徑皮執行（無計時器洩漏）

### Implementation for User Story 2

- [x] T011 [US2] 在 `src/crawler.ts` 實作 `withTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T>` 輔助函式：以 `Promise.race` + `setTimeout` 實作，兩條路徑皮呼叫 `clearTimeout`
- [x] T012 [US2] 重構 `src/crawler.ts` 的 `scrapeOnce()`：將目前的 `for...of` 串行迭變改為 `const results = await Promise.allSettled(providers.map(...))` 並行執行，每個 provider 以 `withTimeout(..., 120_000, name)` 包裹；每個 provider 使用獨立建立的 `Page` 實例
- [x] T013 [US2] 確認 `src/crawler.ts` 的 `browser.close()` 在 `finally` 區塊中正確位置不變；並行化後所有 Page 在 browser 關閉時一併釋放

**Checkpoint**: 此時 US1 + US2 均可運作 — 並行日誌可見，`npm test` 通過 T010

---

## Phase 5: User Story 3 — 單一 provider 失敗不中斷整體爬取 (Priority: P3)

**Goal**: `Promise.allSettled` rejected 結果被正確處理；失敗日誌含結構化欄位；全部失敗時回傳空陣列而非 500

**Independent Test**: 模擬一個 provider 拋出例外，驗證其餘 provider 結果完整回傳，`POST /crawl` 回傳 HTTP 200

### Tests for User Story 3

- [x] T014 [US3] 在 `src/crawler.test.ts` 新增錯誤隔離整合測試：mock 一個 provider 擋出例外，mock 第二個正常回傳，驗證最終結果只含第二個 provider 的資料
- [x] T015 [US3] 在 `src/crawler.test.ts` 新增全部失敗情境測試：所有 provider 均擋出例外，驗證回傳空陣列且無 unhandled exception

### Implementation for User Story 3

- [x] T016 [US3] 在 `src/crawler.ts` 的 `scrapeOnce()` 中，對 `Promise.allSettled` 的 `rejected` 結果加入結構化日誌：`console.warn('[PROVIDER ERROR] name=${name} error=${e.message} elapsedMs=${elapsed}')`；`fulfilled` 結果則推入 `all` 陣列
- [x] T017 [US3] 確認 `src/server.ts` 的 `POST /crawl` handler：`runCrawler()` 在所有 provider 失敗時回傳空陣列（非擋出例外），確認 `res.json({ ok: true, ..., data: [] })` 路徑正確，non-error path 維持 HTTP 200

**Checkpoint**: 此時三個 User Story 均可獨立驗證；`npm test` 全部通過

---

## Final Phase: Polish & Cross-Cutting Concerns

**目的**: 型別一致性驗證、文件同步

- [x] T018 [P] 執行 `tsc --noEmit` 並修正所有 TypeScript 型別錯誤（主要為 Provider 回傳 `BaseJob` 缺少 `id` 欄位 — 可用 `Omit<BaseJob, 'id'>` 或在 Provider 回傳後由 `assignIds` 注入的方式定義內部型別）
- [x] T019 [P] 更新 `README.md` 的「資料格式 (BaseJob)」章節：在欄位表格中新增 `id` 欄位說明，並更新 JSON 範例

---

## Dependencies

```
T001 (test script setup)
  └─→ T004, T005, T010, T014, T015（測試任務可執行）

T002 (BaseJob + id field)
  └─→ T003 → T006 → T007 → T008（US1 實作鏈）
              T006 → T009（GET /last 補齊）

T011 (withTimeout)
  └─→ T012 (並行重構)
        └─→ T013 (browser cleanup 驗證)
              └─→ T016 (error logging)
                    └─→ T017 (HTTP 200 確認)

T008, T013, T017 (所有 Story 完成)
  └─→ T018 (tsc check)
  └─→ T019 (README)
```

**Story 完成順序**（最小依賴）：

1. US1（T002 → T006 → T007 → T008 → T009）
2. US2（T011 → T012 → T013，依賴 T007 已整合 assignIds）
3. US3（T016 → T017，依賴 T012 並行架構）

## Parallel Execution Examples

**US1 測試可並行**（操作不同檔案，無共同依賴）：

```
T004 [src/utils/id.test.ts - generateId 測試]
T005 [src/utils/id.test.ts - assignIds 測試]  ← 同一檔案，需 T004 先建立檔案後繼續
```

**跨 Phase 可並行（實作開始後）**：

```
T009 [server.ts GET /last]  ← 可與 T007/T008 並行（不同檔案）
T010 [crawler.test.ts withTimeout 測試]  ← 可與 T006-T009 並行（US2 測試先行）
T018 [tsc check]  ← 可與 T019 [README] 並行
```

## Implementation Strategy

**MVP Scope（僅 User Story 1）**：

- 完成 T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009
- 可獨立交付：`POST /crawl` 與 `GET /last` 均回傳含 `id` 的職缺，向後相容

**完整交付順序**：

1. Phase 1 + 2（T001–T003）：基礎建設，< 30 分鐘
2. Phase 3 US1（T004–T009）：最高優先，可獨立驗證
3. Phase 4 US2（T010–T013）：並行化，依賴 US1 完成
4. Phase 5 US3（T014–T017）：錯誤隔離，依賴 US2 架構
5. Final（T018–T019）：最後收尾

**Total**: 19 tasks | Phase 1: 1 | Phase 2: 2 | US1: 6 | US2: 4 | US3: 4 | Polish: 2
