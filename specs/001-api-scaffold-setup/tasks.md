# Tasks: API 專案骨架初始化

**輸入**：設計文件來自 `specs/001-api-scaffold-setup/`
**前置條件**：plan.md ✅、spec.md ✅、research.md ✅、data-model.md ✅、contracts/ ✅
**測試**：N/A（本功能為骨架，plan.md 明確指定 `測試：N/A`）

## 格式：`[ID] [P?] [Story?] 描述`

- **[P]**：可平行執行（不同檔案，無對彼此的未完成依賴）
- **[Story]**：對應哪個使用者故事（US1、US2、US3）
- 每個任務皆含明確的檔案路徑

---

## Phase 1：Setup（安裝新依賴）

**目的**：把 plan.md 研究決策的兩個新套件加入專案，讓後續所有任務可使用其型別與 API

- [x] T001 在 `package.json` 新增 `better-sqlite3`、`cors`、`@types/better-sqlite3`、`@types/cors` 依賴，並執行 `npm install`

---

## Phase 2：Foundational（阻塞性前置）

**目的**：所有 User Story 開始前必須完成的基礎建設

**⚠️ 關卡**：此 Phase 完成後，Phase 3–5 可以開始

- [x] T002 建立 `data/.gitkeep`，確保 `data/` 目錄被版控追蹤（DB 檔與爬蟲輸出 JSON 的掛載點）

---

## Phase 3：User Story 1 — 開發者零阻力本地啟動（優先級：P1）🎯 MVP

**目標**：開發者執行 `npm install && npm run dev` 後伺服器即可啟動，migration 自動執行，無需外部服務

**獨立測試**：執行 `npm run dev`，觀察 `[INFO] migration: 001_create_favorites.sql applied` → `[INFO] server listening on :3000 (development)`；呼叫 `GET /health` 回傳 HTTP 200；重啟後 migration 不重複執行（SC-001、SC-005）

### US1 實作

- [x] T003 [P] [US1] 建立 `src/db/migrations/001_create_favorites.sql`，內容：`CREATE TABLE IF NOT EXISTS favorites (id INTEGER PRIMARY KEY);`
- [x] T004 [P] [US1] 建立 `src/db/migrate.ts`：輕量 migration runner（約 25 行），使用 `better-sqlite3` 同步 API；**（1）** 以 `new Database(dbPath)` 開啟連線——若拋出例外（路徑不可寫、權限不足），輸出 `[ERROR]` 並呼叫 `process.exit(1)`；**（2）** 建立 `_migrations` 追蹤資料表；**（3）** 依序讀取 `src/db/migrations/` 下的 `.sql` 檔並執行未執行的 migration；migration 成功時輸出 `[INFO]`，SQL 執行失敗時輸出 `[ERROR]` 並呼叫 `process.exit(1)`（FR-002、FR-008、spec.md 邊界情況、研究決策 3）
- [x] T005 [US1] 修改 `src/server.ts`：（1）讀取 `DB_PATH` 環境變數（預設 `'./data/talentive.db'`，FR-009）；（2）讀取 `NODE_ENV` 環境變數（預設 `'development'`，spec.md 邊界情況）；（3）在 `app.listen()` 之前呼叫 `runMigrations(dbPath)`；（4）將現有啟動 log `[API] listening...` 改為 `[INFO] server listening on :${port} (${nodeEnv})`（FR-005）；（5）`PORT` env var 邏輯維持現有 `Number(process.env.PORT || 3000)` 不變（FR-006，現有代碼已正確實作）

**關卡**：此時 `npm run dev` 應可完整啟動，migration 自動執行，US1 驗收情境 1–4 全部通過

---

## Phase 4：User Story 2 — 前端應用無 CORS 阻礙（優先級：P2）

**目標**：`localhost:5173` 的前端以 `fetch` 呼叫後端 API 不出現 CORS 錯誤

**獨立測試**：`curl -i -H "Origin: http://localhost:5173" http://localhost:3000/health` 回應標頭含 `Access-Control-Allow-Origin: http://localhost:5173`；其他 Origin 無此標頭（US2 驗收情境 1–3）

### US2 實作

- [x] T006 [US2] 修改 `src/server.ts`：import `cors`，在 `app.use(express.json(...))` 之前加入 `app.use(cors({ origin: 'http://localhost:5173' }))`（FR-003、研究決策 2）；驗證：`curl -i -H "Origin: http://evil.com" http://localhost:3000/health` 回應中應**無** `Access-Control-Allow-Origin` 標頭（US2 AC3）

**關卡**：瀏覽器 console 無 CORS 錯誤，SC-004 通過；第三方 Origin 無 CORS 允許標頭

---

## Phase 5：User Story 3 — 運維人員 / CI 健康檢查（優先級：P3）

**目標**：`GET /health` 確認格式符合 contract，回應時間 < 50ms

**獨立測試**：`curl http://localhost:3000/health` 回傳 `{"ok":true,"running":false,"last":null}`（或含上次爬取摘要）；回應時間 < 50ms（SC-002）

### US3 實作

- [x] T007 [US3] 修改 `src/server.ts`：在檔案頂部宣告 `interface HealthResponse { ok: true; running: boolean; last: { at: string; count: number } | null }` 介面（依照 `contracts/GET-health.ts` 規格，但宣告於 `src/` 內而非 import，符合憲法 VII 依賴最小化），並以 `res.json({ ok: true, running: isRunning, last: lastMeta } satisfies HealthResponse)` 標注回傳型別（FR-004）

**關卡**：US3 驗收情境 1–3 全部通過

---

## Phase 6：Polish（收尾與驗證）

**目的**：型別安全最終確認 + 完整執行 quickstart.md 端對端驗證

- [x] T008 [P] 執行 `npm run build`（`tsc --build`）確認零錯誤、零警告（SC-003、FR-007）
- [x] T009 依據 `specs/001-api-scaffold-setup/quickstart.md` 執行完整驗證流程，確認 SC-001~SC-005 全部通過（SC-001 以計時執行 `npm install && npm run dev` 的人工記錄方式驗證，屬非自動化測試項）

---

## 依賴關係

```
T001 (依賴安裝)
  └─→ T002 (data/.gitkeep) ──可平行──┐
  └─→ T003 (001_create_favorites.sql) ──平行─→ T005 (server.ts 整合 US1)
  └─→ T004 (migrate.ts) ─────────────┘
                                         └─→ T006 (cors middleware, US2)
                                         └─→ T007 (health contract, US3)
                                               └─→ T008 (tsc --build)
                                               └─→ T009 (quickstart 驗證)
```

### 每個 User Story 的平行執行範例

**US1 內部**（T003、T004 可同時執行）：

```
Agent A: T003 建立 001_create_favorites.sql
Agent B: T004 建立 migrate.ts
→ 完成後 → Agent A or B: T005 修改 server.ts
```

**US2、US3 可在 US1 完成後平行執行**：

```
Agent A: T006（cors middleware）
Agent B: T007（health contract 型別標注）
→ 兩者皆完成後 → T008 → T009
```

---

## 實作策略

**MVP 範疇**（Phase 3 = US1 完成）：伺服器可啟動、migration 執行、/health 回應 200——前端整合前的最小可驗證狀態。

**增量交付順序**：US1（啟動骨架）→ US2（CORS 解鎖前端）→ US3（型別對齊 contract）→ Polish（型別與 quickstart 驗證）

---

## 任務統計

| 指標                        | 數值                           |
| --------------------------- | ------------------------------ |
| 總任務數                    | 9                              |
| US1 任務數                  | 3（T003、T004、T005）          |
| US2 任務數                  | 1（T006）                      |
| US3 任務數                  | 1（T007）                      |
| Setup / Foundational 任務數 | 2（T001、T002）                |
| Polish 任務數               | 2（T008、T009）                |
| 平行執行機會                | T003∥T004（US1 內）；T006∥T007 |
| 建議 MVP 範疇               | Phase 3（US1）                 |
| 新增/修改的原始碼檔案       | 2 新增、1 修改（+ 1 .gitkeep） |
