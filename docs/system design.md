# Talentive Service — System Design

本文件依照 `talentive-service` 各模組的程式邏輯，描述主要 HTTP 端點的呼叫序列。

---

## API Request / Response 一覽

### POST /crawl

**Request**

```http
POST /crawl
Content-Type: application/json

{
  "keyword":   "前端工程師",   // 搜尋關鍵字，預設 "前端工程師"
  "pages":     1,              // 各 provider 抓取頁數，預設 1
  "providers": ["104","yourator","1111"], // 平台清單，可用逗號字串或陣列
  "delay":     700,            // 頁面間延遲毫秒，預設 700
  "debug":     false,          // 是否輸出 HTML debug 快照
  "output":    "/app/data/jobs.json" // 輸出路徑，空字串 = 不寫檔
}
```

**Response**

| Status                      | Body                                                           |
| --------------------------- | -------------------------------------------------------------- |
| `200 OK`                    | `{ ok: true, durationMs: number, count: number, data: Job[] }` |
| `409 Conflict`              | `{ ok: false, message: "Crawler 正在執行中" }`                 |
| `500 Internal Server Error` | `{ ok: false, error: string }`                                 |

Job 物件：

```jsonc
{
  "id": "a3f9c021", // SHA-256(url) 前 8 碼
  "title": "前端工程師",
  "company": "範例公司",
  "location": "台北市",
  "salary": "60,000–90,000",
  "date": "2026/04/01",
  "url": "https://www.104.com.tw/job/xxxxxxxx",
  "page": 1,
  "source": "104", // "104" | "yourator" | "1111"
}
```

---

### GET /last

**Request**

```http
GET /last
```

**Response**

| Status                      | Body                                   |
| --------------------------- | -------------------------------------- |
| `200 OK`                    | `Job[]`（每筆附加 `is_fav: boolean`）  |
| `404 Not Found`             | `{ ok: false, message: "檔案不存在" }` |
| `500 Internal Server Error` | `{ ok: false, error: string }`         |

```jsonc
// 每筆 Job 額外包含：
{
  "is_fav": true, // 該職缺是否已被收藏
}
```

---

### GET /health

**Request**

```http
GET /health
```

**Response**

| Status   | Body                                                                          |
| -------- | ----------------------------------------------------------------------------- |
| `200 OK` | `{ ok: true, running: boolean, last: { at: string, count: number } \| null }` |

```jsonc
{
  "ok": true,
  "running": false,
  "last": {
    "at": "2026-04-12T08:00:00.000Z",
    "count": 42,
  },
}
```

---

### GET /charts

**Request**

```http
GET /charts
```

**Response**

| Status                      | Body                             |
| --------------------------- | -------------------------------- |
| `200 OK`                    | `{ ok: true, data: ChartStats }` |
| `500 Internal Server Error` | `{ ok: false, error: string }`   |

> jobs.json **不存在**時仍回傳 `200`，三個統計欄位均為空（platforms 三平台計數為 0，tags/locations 為空陣列）。

ChartStats 物件：

```jsonc
{
  "platforms": [
    { "platform": "104", "count": 42 },
    { "platform": "1111", "count": 15 },
    { "platform": "yourator", "count": 28 },
  ],
  "tags": [
    { "tag": "Vue", "count": 30 },
    { "tag": "React", "count": 20 },
    { "tag": "Angular", "count": 10 },
    { "tag": "其他", "count": 25 }, // Top 3 以外統計
  ],
  "locations": [
    { "location": "台北市", "count": 60 },
    { "location": "新北市", "count": 15 },
    { "location": "不明", "count": 10 }, // 空字串地點；固定末尾
  ],
  "lastCrawledAt": "2026-04-12T08:00:00.000Z", // null 若服務啟動後未爬取
}
```

---

### POST /favorites/:id

**Request**

```http
POST /favorites/:id
```

| Parameter | In   | Type   | 說明                                    |
| --------- | ---- | ------ | --------------------------------------- |
| `id`      | path | string | 8 碼十六進位職缺 ID，格式 `[0-9a-f]{8}` |

**Response**

| Status                      | Body                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `201 Created`               | `{ ok: true, data: FavoriteEntry }`                                                      |
| `400 Bad Request`           | `{ ok: false, error: "id 格式不合法，須為 8 碼十六進位字串（[0-9a-f]{8}）" }`            |
| `404 Not Found`             | `{ ok: false, error: "職缺 id 不存在於最近一次爬取結果" }` 或 `"最近一次爬取結果不存在"` |
| `409 Conflict`              | `{ ok: false, error: "職缺已在收藏清單中" }`                                             |
| `500 Internal Server Error` | `{ ok: false, error: "伺服器錯誤" }`                                                     |

FavoriteEntry 物件：

```jsonc
{
  "id": "a3f9c021",
  "title": "前端工程師",
  "company": "範例公司",
  "location": "台北市",
  "salary": "60,000–90,000",
  "url": "https://www.104.com.tw/job/xxxxxxxx",
  "source": "104",
  "savedAt": "2026-04-12T08:00:00.000Z", // ISO 8601 UTC
}
```

---

### DELETE /favorites/:id

**Request**

```http
DELETE /favorites/:id
```

| Parameter | In   | Type   | 說明                                    |
| --------- | ---- | ------ | --------------------------------------- |
| `id`      | path | string | 8 碼十六進位職缺 ID，格式 `[0-9a-f]{8}` |

**Response**

| Status                      | Body                                                                          |
| --------------------------- | ----------------------------------------------------------------------------- |
| `200 OK`                    | `{ ok: true }` （冪等：id 不存在時也回傳 200）                                |
| `400 Bad Request`           | `{ ok: false, error: "id 格式不合法，須為 8 碼十六進位字串（[0-9a-f]{8}）" }` |
| `500 Internal Server Error` | `{ ok: false, error: "伺服器錯誤" }`                                          |

---

### GET /favorites

**Request**

```http
GET /favorites
```

**Response**

| Status                      | Body                                   |
| --------------------------- | -------------------------------------- |
| `200 OK`                    | `{ ok: true, data: GroupedFavorites }` |
| `500 Internal Server Error` | `{ ok: false, error: "伺服器錯誤" }`   |

GroupedFavorites 結構（依 `source` 分群，每群依 `savedAt` 降序）：

```jsonc
{
  "ok": true,
  "data": {
    "104": [
      /* FavoriteEntry[] */
    ],
    "yourator": [
      /* FavoriteEntry[] */
    ],
    "1111": [
      /* FavoriteEntry[] */
    ],
  },
}
```

---

### GET /docs

**Request**

```http
GET /docs
GET /docs/openapi.json
```

**Response**

| Status                              | Body                    |
| ----------------------------------- | ----------------------- |
| `GET /docs` → `200 OK`              | Swagger UI HTML 頁面    |
| `GET /docs/openapi.json` → `200 OK` | OpenAPI 3.0.3 JSON spec |

---

## 目錄

1. [POST /crawl — 觸發爬蟲](#1-post-crawl--觸發爬蟲)
2. [GET /last — 取得上次爬取結果](#2-get-last--取得上次爬取結果)
3. [GET /health — 健康狀態](#3-get-health--健康狀態)
4. [GET /charts — 圖表統計資料](#4-get-charts--圖表統計資料)
5. [POST /favorites/:id — 新增收藏](#5-post-favoritesid--新增收藏)
6. [DELETE /favorites/:id — 移除收藏](#6-delete-favoritesid--移除收藏)
7. [GET /favorites — 取得分群收藏清單](#7-get-favorites--取得分群收藏清單)
8. [GET /docs — API 文件頁面](#8-get-docs--api-文件頁面)

---

## 關鍵設計備註

| 機制                | 說明                                                                                               |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| **並行爬取**        | `crawler.ts` 使用 `Promise.allSettled` 同時啟動所有 Provider，各使用獨立 Playwright Page           |
| **逾時保護**        | `withTimeout(promise, 120_000, name)` 限制每個 Provider 最多 120 秒                                |
| **URL 去重**        | `dedupeByUrl()` 在 ID 注入前先過濾相同 URL 的重複職缺                                              |
| **ID 生成**         | `generateId(url)` = `SHA-256(url)` 取前 8 碼十六進位；碰撞時捨棄後者並記錄警告                     |
| **Mutex 寫鎖**      | `withWriteLock` 以 Promise Chain 實作序列化寫入，防止 concurrent POST/DELETE 破壞 `favorites.json` |
| **Crash-safe 寫檔** | 先寫 `.tmp` 再 `rename`，避免寫到一半造成資料損毀                                                  |
| **is_fav 標記**     | `GET /last` 即時讀取 `favorites.json` 取得 id Set，回傳時附加 `is_fav` 欄位（不改寫 `jobs.json`）  |
| **舊資料相容**      | `GET /last` 檢查缺少 `id` 的舊版資料，即時補齊後回傳，不改寫磁碟                                   |
| **爬蟲互斥**        | `isRunning` flag 防止同時觸發多次爬蟲，重複請求回傳 `409`                                          |
