# 研究報告：API 專案骨架初始化

**分支**：`001-api-scaffold-setup` | **日期**：2026-04-05

---

## 決策 1：SQLite Node.js 驅動選擇

**決定**：`better-sqlite3`

**理由**：

- 同步 API：migration runner 可寫成純同步函式，不需 Promise 包裝或 async/await，啟動流程可線性執行
- 效能：比 `sqlite3`（非同步回呼）快 2–10 倍（官方 benchmark）
- 簡單性：API 直接，無 connection pool 概念，符合單檔 SQLite 使用情境
- TypeScript 支援：`@types/better-sqlite3` 官方型別定義完整，無 `any` 需求

**考慮的替代方案**：

- `sqlite3`：非同步但基於回呼，需要 `promisify` 包裝，徒增複雜度；不推薦
- `Prisma`：ORM 過重，違反憲法「依賴最小化」原則（VII），且 schema migration 由 Prisma 管理與手寫 SQL migration 框架衝突

---

## 決策 2：CORS 中介層選擇

**決定**：`cors` npm 套件

**理由**：

- 輕量：2KB 無次要依賴，符合依賴最小化原則
- 完整支援：origin 可為字串、陣列或 function，未來若需多 origin 支援無需重構
- 標準作法：Express 生態的實際標準，有 TypeScript 型別（含於套件中）
- 現有 `server.ts` 已有 Express，加一行 `app.use(cors({ origin: '...' }))` 即完成

**考慮的替代方案**：

- 手動設定 headers：每個 route 需個別設定，維護負擔高且容易遺漏；不推薦

---

## 決策 3：Migration Runner 策略

**決定**：自製輕量 migration runner（~25 行 TypeScript）

**理由**：

- 依賴最小化：不引入 `db-migrate`、`knex` 等外部套件
- 需求簡單：每個功能帶一個 `.sql` migration 檔，按序號執行，以 `migrations` 資料表記錄已執行項目，冪等
- 本功能只有 1 個 migration（`favorites` 初始佔位），`002-job-favorites` 再新增欄位 migration
- 完全可控：fail-fast 行為（憲法邊界情況要求）可直接在 runner 中實作

**自製 runner 核心邏輯**（偽程式碼）：

```
db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY, run_at TEXT)`)
for each file in migrations/ (ordered by filename):
  if file.id not in _migrations:
    db.exec(file.sql)          // 若失敗 → 拋出錯誤 → 呼叫端 catch → [ERROR] log + process.exit(1)
    db.run(`INSERT INTO _migrations ...`)
```

**考慮的替代方案**：

- `knex` migrations：功能完整但重量級，引入整個 query builder 只為跑 migration，違反 YAGNI（憲法 VII）
- `db-migrate`：較輕量但仍有設定檔複雜度，對本專案過重

---

## 決策 4：現有 server.ts 的整合策略

**決定**：在現有 `src/server.ts` 基礎上擴充，不建立新檔案

**理由**：

- 現有 `server.ts` 已有 Express、`/health`、`/crawl`、`/last` 端點與 `isRunning` mutex
- 本功能目標是「補齊缺失的骨架元件」：CORS、SQLite migration、`[INFO]` log、`DB_PATH` env var
- 遵循 YAGNI：不重寫已運作的程式碼

**需要新增的檔案**：

- `src/db/migrate.ts`：migration runner
- `src/db/migrations/001_create_favorites.sql`：初始佔位 migration
- `data/`：目錄（含 `.gitkeep`，資料庫檔案加入 `.gitignore`）

**需要修改的檔案**：

- `src/server.ts`：加入 `cors`、啟動時呼叫 migration runner、`[INFO]` log、`DB_PATH`
- `package.json`：新增 `better-sqlite3`、`cors`、`@types/better-sqlite3` 依賴
- `tsconfig.json`：確認 `strict: true` 已設定
