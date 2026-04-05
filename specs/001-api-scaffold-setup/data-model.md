# 資料模型：API 專案骨架初始化

**分支**：`001-api-scaffold-setup` | **日期**：2026-04-05
**來源**：釐清記錄 Q1（2026-04-05）

---

## SQLite 資料庫結構

### 資料庫檔案

| 屬性     | 值                               |
| -------- | -------------------------------- |
| 預設路徑 | `./data/talentive.db`            |
| 環境變數 | `DB_PATH`（覆寫路徑）            |
| 建立時機 | 伺服器啟動時，若不存在則自動建立 |

---

## 資料表

### `_migrations`（Migration 追蹤表）

由 migration runner 自動建立，**不由業務邏輯直接存取**。

| 欄位     | 型別               | 說明                                         |
| -------- | ------------------ | -------------------------------------------- |
| `id`     | `TEXT PRIMARY KEY` | Migration 檔名（例：`001_create_favorites`） |
| `run_at` | `TEXT NOT NULL`    | 執行時間（ISO 8601 字串）                    |

---

### `favorites`（初始佔位）

**本功能只建立最小結構。** 完整業務欄位由 `002-job-favorites` 的 migration 新增。

| 欄位 | 型別                  | 說明                                |
| ---- | --------------------- | ----------------------------------- |
| `id` | `INTEGER PRIMARY KEY` | 自動遞增主鍵（SQLite `ROWID` 別名） |

**建立 SQL**：

```sql
CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY
);
```

> ⚠️ 刻意不包含 `job_url`、`created_at` 等欄位，避免與 `002-job-favorites` migration 產生欄位衝突。
> `002-job-favorites` 將使用 `ALTER TABLE` 或新 migration 新增業務欄位。

---

## Migration 檔案清單（本功能範疇）

| 序號 | 檔案                                         | 內容                                      | 建立功能 |
| ---- | -------------------------------------------- | ----------------------------------------- | -------- |
| 001  | `src/db/migrations/001_create_favorites.sql` | 建立 `favorites (id INTEGER PRIMARY KEY)` | 本功能   |

> `002-job-favorites` 將新增 `002_add_favorites_columns.sql`。

---

## TypeScript 介面（僅新增與本功能相關的型別）

本功能不新增 `BaseJob` 欄位，不觸發 Schema 版本升級（憲法原則 IV ✅）。

唯一新增的內部型別（`src/db/migrate.ts` 中使用，不對外匯出）：

```ts
// 僅供 migration runner 內部使用
interface MigrationRecord {
  id: string;
  run_at: string;
}
```
