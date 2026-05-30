# Data Model: Favorite API

**Feature**: 003-favorite-api  
**Phase**: 1 — 設計  
**Date**: 2026-04-06

---

## 實體定義

### `FavoriteEntry`

收藏清單中的單筆職缺快照，儲存新增收藏當下從 `jobs.json` 讀取的完整職缺資料。

| 欄位       | 型別     | 來源               | 說明                                   |
| ---------- | -------- | ------------------ | -------------------------------------- |
| `id`       | `string` | `BaseJob.id`       | SHA-256(url) 前 8 碼十六進位，唯一鍵   |
| `title`    | `string` | `BaseJob.title`    | 職缺名稱                               |
| `company`  | `string` | `BaseJob.company`  | 公司名稱                               |
| `location` | `string` | `BaseJob.location` | 工作地點                               |
| `salary`   | `string` | `BaseJob.salary`   | 薪資範圍（缺值為 `""`）                |
| `url`      | `string` | `BaseJob.url`      | 原始職缺連結                           |
| `source`   | `string` | `BaseJob.source`   | 來源平台（`104`、`yourator`、`1111`）  |
| `savedAt`  | `string` | 系統產生           | ISO 8601 時間戳記，收藏當下的 UTC 時間 |

**不變性**：`savedAt` 以外的所有欄位均為新增當下的快照，後續爬取不自動更新。

---

### `FavoriteStore`

持久化資料結構，用於磁碟存儲。

- **格式**：`FavoriteEntry[]`，純 JSON 陣列。
- **編碼**：UTF-8。
- **路徑**：由環境變數 `FAVORITES_OUTPUT` 決定，預設為 `/app/data/favorites.json`。
- **空狀態**：`[]`（空陣列），不為 `null` 或不存在的檔案。

---

### `GroupedFavorites`

`GET /favorites` 的回傳結構，以來源平台為鍵分群。

```typescript
type GroupedFavorites = Record<string, FavoriteEntry[]>;
// 範例：
// {
//   "104": [...],
//   "yourator": [...]
// }
```

- 若清單為空，回傳 `{}`。
- 鍵為 `FavoriteEntry.source` 的值，動態產生。
- 群內職缺依 `savedAt` 降冪排序（最新收藏在前）。

---

### `EnrichedJob`

`GET /last` 的回傳單筆結構，為 `BaseJob` 超集，僅存在於 API 回傳層。

```typescript
type EnrichedJob = BaseJob & { is_fav: boolean };
```

- `is_fav` 由即時比對 `favorites.json` 中的 `id` Set 計算。
- **不寫入** `jobs.json`，不持久化。

---

## 狀態轉移

### `FavoriteEntry` 生命週期

```
[不存在]
   │  POST /favorites/:id（id 存在於 jobs.json）
   ▼
[已收藏] ──────────────────────────────────────────┐
   │  DELETE /favorites/:id                         │
   ▼                                                 │
[不存在]                          重新爬取不影響狀態  │
   │  POST /favorites/:id（再次收藏）                │
   └─────────────────────────────────────────────────┘
```

### `is_fav` 計算規則

```
jobs.json 中的某筆職缺
   ├── id 在 favorites.json 中 → is_fav = true
   └── id 不在 favorites.json 中 → is_fav = false
```

---

## 驗證規則

| 欄位/操作                       | 規則                               | 失敗時   |
| ------------------------------- | ---------------------------------- | -------- |
| 路徑參數 `:id`                  | 符合 `/^[0-9a-f]{8}$/`             | HTTP 400 |
| `POST /favorites/:id` 的 `id`   | 必須存在於 `jobs.json`             | HTTP 404 |
| `POST /favorites/:id` 的 `id`   | 不得已存在於 `favorites.json`      | HTTP 409 |
| `DELETE /favorites/:id` 的 `id` | 格式合法即可（冪等，不存在也接受） | HTTP 200 |

---

## 資料關係

```
jobs.json (BaseJob[])
    ├── 提供職缺資料來源，供 POST /favorites/:id 查找
    └── GET /last 回傳時，與 favorites.json 的 id Set 合併計算 is_fav

favorites.json (FavoriteEntry[])
    ├── 收藏清單持久化
    └── 提供 id Set，供 GET /last 計算 is_fav 使用
```

---

## TypeScript 型別定義（規格層）

```typescript
// 繼承自 src/providers/types.ts 的 BaseJob
interface FavoriteEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  source: string;
  savedAt: string; // ISO 8601
}

type GroupedFavorites = Record<string, FavoriteEntry[]>;

type EnrichedJob = import("./providers/types").BaseJob & { is_fav: boolean };
```
