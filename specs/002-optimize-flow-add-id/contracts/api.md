# API 合約：POST /crawl

**Branch**: `002-optimize-flow-add-id` | **Date**: 2026-04-05

## 端點

`POST /crawl`

## 請求

### Headers

| Header         | 值                 |
| -------------- | ------------------ |
| `Content-Type` | `application/json` |

### Body（JSON）

| 欄位        | 型別                   | 必填 | 預設                        | 說明                               |
| ----------- | ---------------------- | ---- | --------------------------- | ---------------------------------- |
| `keyword`   | `string`               | ❌   | `"前端工程師"`              | 搜尋關鍵字                         |
| `pages`     | `number`               | ❌   | `1`                         | 各 provider 抓取頁數               |
| `providers` | `string[]` \| `string` | ❌   | `["104","yourator","1111"]` | 指定平台清單（陣列或逗號分隔字串） |
| `delay`     | `number`               | ❌   | `700`                       | 頁面間延遲（毫秒）                 |
| `debug`     | `boolean`              | ❌   | `false`                     | 啟用 debug HTML 快照               |
| `output`    | `string`               | ❌   | `"/app/data/jobs.json"`     | 輸出檔路徑（空字串 = 不寫檔）      |

### 請求範例

```json
{
  "keyword": "資料工程師",
  "pages": 2,
  "providers": ["104", "yourator"],
  "delay": 700
}
```

## 回應

### 成功（HTTP 200）

| 欄位         | 型別        | 說明               |
| ------------ | ----------- | ------------------ |
| `ok`         | `true`      | 恆為 true          |
| `durationMs` | `number`    | 總執行耗時（毫秒） |
| `count`      | `number`    | 回傳職缺總筆數     |
| `data`       | `BaseJob[]` | 職缺陣列           |

```json
{
  "ok": true,
  "durationMs": 8432,
  "count": 2,
  "data": [
    {
      "id": "a3f9c021",
      "title": "資料工程師",
      "company": "範例公司",
      "location": "台北市",
      "salary": "面議",
      "date": "2026/04/01",
      "url": "https://www.104.com.tw/job/xxxxxxxx",
      "page": 1,
      "source": "104"
    },
    {
      "id": "7d2e8b14",
      "title": "Data Engineer",
      "company": "另一家公司",
      "location": "新北市",
      "salary": "60,000–90,000",
      "date": "",
      "url": "https://www.yourator.co/companies/xxx/jobs/yyy",
      "page": 1,
      "source": "yourator"
    }
  ]
}
```

### 爬蟲執行中（HTTP 409）

```json
{
  "ok": false,
  "message": "Crawler 正在執行中"
}
```

### 伺服器錯誤（HTTP 500）

```json
{
  "ok": false,
  "error": "錯誤訊息"
}
```

## 行為變更說明（vs 舊版）

| 項目               | 舊版             | 新版                                   |
| ------------------ | ---------------- | -------------------------------------- |
| `data[].id`        | 不存在           | 新增，8 碼十六進位字串                 |
| provider 執行方式  | 串行（逐一等待） | **並行**（`Promise.allSettled`）       |
| 單一 provider 失敗 | 整批結果可能遺失 | 其他 provider 正常回傳，失敗者記錄日誌 |
| provider 逾時      | 無限等待         | 120 秒後視同失敗                       |

---

# API 合約：GET /last

## 端點

`GET /last`

## 回應

### 成功（HTTP 200）

回傳 `BaseJob[]` JSON 陣列。若磁碟檔案不含 `id` 欄位，**伺服器即時補齊後回傳，不改寫磁碟**。

```json
[
  {
    "id": "a3f9c021",
    "title": "資料工程師",
    "company": "範例公司",
    "location": "台北市",
    "salary": "面議",
    "date": "2026/04/01",
    "url": "https://www.104.com.tw/job/xxxxxxxx",
    "page": 1,
    "source": "104"
  }
]
```

### 檔案不存在（HTTP 404）

```json
{
  "ok": false,
  "message": "檔案不存在"
}
```

### 伺服器錯誤（HTTP 500）

```json
{
  "ok": false,
  "error": "錯誤訊息"
}
```

## 行為變更說明（vs 舊版）

| 項目      | 舊版                              | 新版                                                         |
| --------- | --------------------------------- | ------------------------------------------------------------ |
| 回傳格式  | 原始 JSON 字串（直接 `res.send`） | 若缺少 `id`：`res.json(patched)`；否則：原始字串（效能最佳） |
| `id` 欄位 | 不存在                            | 缺失時即時補齊                                               |

---

# BaseJob 型別定義

```ts
interface BaseJob {
  id: string; // 新增
  title: string;
  company: string;
  location: string;
  salary: string;
  date?: string;
  url: string;
  page: number;
  source: string;
}
```

> **Breaking change**：TypeScript 型別層面新增必填欄位 `id`；Provider 實作目前不需産生 `id`（由 `assignIds()` 統一在 crawler 層注入）。Provider 回傳的 `BaseJob` 在型別上暫為 `Omit<BaseJob, 'id'>` 或直接使用型別斷言，待實作時決定。
