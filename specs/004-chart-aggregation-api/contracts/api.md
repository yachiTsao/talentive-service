# API Contract: GET /charts

**Feature**: `004-chart-aggregation-api`  
**Endpoint**: `GET /charts`  
**Date**: 2026-04-12

---

## 端點規格

### Request

```http
GET /charts
```

無請求參數、無 Request Body、無認證需求。

---

### Response — 成功（HTTP 200）

```jsonc
{
  "ok": true,
  "data": {
    "platforms": [
      { "platform": "104", "count": 5 },
      { "platform": "1111", "count": 3 },
      { "platform": "yourator", "count": 0 },
    ],
    "tags": [
      { "tag": "Vue", "count": 10 },
      { "tag": "React", "count": 6 },
      { "tag": "Angular", "count": 4 },
      { "tag": "其他", "count": 2 }, // 僅在 Top3 之外有計數時出現
    ],
    "locations": [
      { "location": "台北市", "count": 12 },
      { "location": "新北市", "count": 5 },
      { "location": "不明", "count": 2 }, // 空字串地點；固定末尾
    ],
    "lastCrawledAt": "2026-04-12T08:00:00.000Z", // ISO 8601 UTC；尚無爬取記錄時為 null
  },
}
```

---

### Response — jobs.json 不存在（HTTP 200，空統計）

```jsonc
{
  "ok": true,
  "data": {
    "platforms": [
      { "platform": "104", "count": 0 },
      { "platform": "1111", "count": 0 },
      { "platform": "yourator", "count": 0 },
    ],
    "tags": [],
    "locations": [],
    "lastCrawledAt": null,
  },
}
```

---

### Response — 伺服器錯誤（HTTP 500）

```jsonc
{
  "ok": false,
  "error": "Unexpected token ...", // 當 jobs.json 存在但內容為無效 JSON 時
}
```

---

## 欄位規格

### `platforms` 陣列

| 欄位       | 型別                            | 說明                                   |
| ---------- | ------------------------------- | -------------------------------------- |
| `platform` | `"104" \| "1111" \| "yourator"` | 平台識別碼（小寫，與 Job.source 一致） |
| `count`    | `number`                        | 該平台的職缺計數（≥ 0）                |

- 固定包含三筆，順序不可變：`104` → `1111` → `yourator`
- 計數為 0 時仍保留，不省略

### `tags` 陣列

| 欄位    | 型別     | 說明                              |
| ------- | -------- | --------------------------------- |
| `tag`   | `string` | 技術名稱（Title Case）或 `"其他"` |
| `count` | `number` | 在所有職缺 title 中匹配到的總次數 |

- 最多四筆（Top 3 + `"其他"`）
- 依 `count` 遞減排序
- `"其他"` 僅在 Top 3 之外有剩餘計數時出現，固定最末
- jobs.json 不存在或無任何 tag 匹配時回傳 `[]`

### `locations` 陣列

| 欄位       | 型別     | 說明                                        |
| ---------- | -------- | ------------------------------------------- |
| `location` | `string` | 正規化後縣市名稱；空字串地點顯示為 `"不明"` |
| `count`    | `number` | 該縣市的職缺計數（≥ 1）                     |

- 包含所有計數 ≥ 1 的縣市，不限制數量
- 依 `count` 遞減排序；`"不明"` 固定末尾（無論 count 大小）
- jobs.json 不存在時回傳 `[]`

### `lastCrawledAt`

| 型別             | 說明                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| `string \| null` | 最後一次 `POST /crawl` 成功完成的 ISO 8601 UTC 時間戳；服務重啟後若未再爬取則為 `null` |

---

## 行為規格

| 情境                           | HTTP Status | 行為                                                        |
| ------------------------------ | ----------- | ----------------------------------------------------------- |
| jobs.json 存在且有效           | 200         | 回傳計算後的 ChartStats                                     |
| jobs.json 不存在               | 200         | 回傳空 ChartStats（platforms 均為 0，tags/locations 為 []） |
| jobs.json 存在但無效 JSON      | 500         | `{ ok: false, error: "..." }`                               |
| 爬蟲正在執行中（讀取不受影響） | 200         | 正常讀取上次完成的資料，不阻擋                              |
| 服務啟動後尚未爬取             | 200         | `lastCrawledAt: null`，其餘視 jobs.json 狀態決定            |

---

## 與現有端點的差異對照

| 端點          | jobs.json 不存在  | 回應格式                         |
| ------------- | ----------------- | -------------------------------- |
| `GET /last`   | HTTP 404          | `Job[]`（陣列，非 envelope）     |
| `GET /charts` | HTTP 200 含空統計 | `{ ok: true, data: ChartStats }` |
| `GET /health` | N/A               | `{ ok, running, last }`          |
