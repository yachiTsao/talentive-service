# API Contract: Favorite API

**Feature**: 003-favorite-api  
**Base URL**: `http://localhost:{PORT}` （PORT 預設 3000）  
**Date**: 2026-04-06

---

## 通用慣例

- 所有回應 Content-Type：`application/json; charset=utf-8`
- 所有回應結構遵循：`{ ok: boolean, ... }`
- 路徑參數 `:id`：8 碼十六進位字串（`/^[0-9a-f]{8}$/`），格式不合法一律回傳 `400`

---

## POST /favorites/:id

**描述**：將指定 `id` 的職缺加入收藏清單。Server 自行從 `jobs.json` 查找完整資料。

### Request

| 部分    | 內容                   |
| ------- | ---------------------- |
| Method  | POST                   |
| Path    | `/favorites/:id`       |
| Body    | 無（不需傳遞任何欄位） |
| Headers | 無特殊要求             |

### Response

#### 201 Created — 新增成功

```json
{
  "ok": true,
  "data": {
    "id": "a3f9c021",
    "title": "前端工程師",
    "company": "範例公司",
    "location": "台北市",
    "salary": "60,000–90,000",
    "url": "https://www.104.com.tw/job/xxxxxxxx",
    "source": "104",
    "savedAt": "2026-04-06T10:00:00.000Z"
  }
}
```

#### 400 Bad Request — id 格式不合法

```json
{
  "ok": false,
  "error": "id 格式不合法，須為 8 碼十六進位字串（[0-9a-f]{8}）"
}
```

#### 404 Not Found — id 不存在於爬取結果

```json
{
  "ok": false,
  "error": "職缺 id 不存在於最近一次爬取結果"
}
```

#### 409 Conflict — 已在收藏清單中

```json
{
  "ok": false,
  "error": "職缺已在收藏清單中"
}
```

#### 500 Internal Server Error

```json
{
  "ok": false,
  "error": "錯誤描述（不含 stack trace）"
}
```

---

## DELETE /favorites/:id

**描述**：從收藏清單移除指定 `id` 的職缺（冪等，不存在也回傳 200）。

### Request

| 部分   | 內容             |
| ------ | ---------------- |
| Method | DELETE           |
| Path   | `/favorites/:id` |
| Body   | 無               |

### Response

#### 200 OK — 移除成功（或原本不存在）

```json
{
  "ok": true
}
```

#### 400 Bad Request — id 格式不合法

```json
{
  "ok": false,
  "error": "id 格式不合法，須為 8 碼十六進位字串（[0-9a-f]{8}）"
}
```

#### 500 Internal Server Error

```json
{
  "ok": false,
  "error": "錯誤描述"
}
```

---

## GET /favorites

**描述**：列出所有收藏職缺，以來源平台（`source`）分群。

### Request

| 部分         | 內容         |
| ------------ | ------------ |
| Method       | GET          |
| Path         | `/favorites` |
| Query Params | 無           |

### Response

#### 200 OK — 成功（含資料）

```json
{
  "ok": true,
  "data": {
    "104": [
      {
        "id": "a3f9c021",
        "title": "前端工程師",
        "company": "範例公司",
        "location": "台北市",
        "salary": "60,000–90,000",
        "url": "https://www.104.com.tw/job/xxxxxxxx",
        "source": "104",
        "savedAt": "2026-04-06T10:00:00.000Z"
      }
    ],
    "yourator": [
      {
        "id": "b1c23d45",
        "title": "React 工程師",
        "company": "新創公司",
        "location": "台北市",
        "salary": "",
        "url": "https://www.yourator.co/companies/foo/jobs/bar",
        "source": "yourator",
        "savedAt": "2026-04-06T09:00:00.000Z"
      }
    ]
  }
}
```

#### 200 OK — 成功（清單為空）

```json
{
  "ok": true,
  "data": {}
}
```

#### 500 Internal Server Error

```json
{
  "ok": false,
  "error": "錯誤描述"
}
```

---

## GET /last（修改現有端點）

**描述**：取得最近一次爬取的職缺清單，每筆附加 `is_fav` 欄位。

> **注意**：此端點為現有端點的行為擴充，不是新端點。原有回應欄位完全保留，僅新增 `is_fav`。

### 回應結構變更

- **原 `BaseJob` 欄位**：完全不變（`id`、`title`、`company`、`location`、`salary`、`url`、`page`、`source`）
- **新增欄位** `is_fav: boolean`：職缺 `id` 是否在收藏清單中

### Response 範例

#### 200 OK

```json
[
  {
    "id": "a3f9c021",
    "title": "前端工程師",
    "company": "範例公司",
    "location": "台北市",
    "salary": "60,000–90,000",
    "date": "2026/04/01",
    "url": "https://www.104.com.tw/job/xxxxxxxx",
    "page": 1,
    "source": "104",
    "is_fav": true
  },
  {
    "id": "c4d5e6f7",
    "title": "後端工程師",
    "company": "另一家公司",
    "location": "新北市",
    "salary": "",
    "date": "2026/04/02",
    "url": "https://www.104.com.tw/job/yyyyyyyy",
    "page": 1,
    "source": "104",
    "is_fav": false
  }
]
```
