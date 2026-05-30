# Quickstart：優化爬蟲流程並加入 id 欄位

**Branch**: `002-optimize-flow-add-id` | **Date**: 2026-04-05

## 本次變更摘要

這次更新帶來三件事：

1. 每筆職缺新增 `id` 欄位（8 碼十六進位，基於 URL SHA-256）
2. 多平台並行爬取（速度提升）
3. 單一平台失敗不中斷整體結果

---

## 使用方式（無需變更）

API 呼叫方式與舊版完全相同，`id` 欄位自動出現在輸出中。

### CLI

```bash
npm run dev -- --keyword=資料工程師 --pages=2 --providers=yourator,104,1111 --delay=700
```

### HTTP API

```bash
# 觸發爬取
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{"keyword":"資料工程師","pages":2,"providers":["104","yourator"]}'

# 讀取上次結果（舊版 JSON 也會自動補齊 id）
curl http://localhost:3000/last
```

---

## 新輸出格式

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

`id` 欄位特性：

- 長度恆為 8 個字元（`[0-9a-f]`）
- 相同 URL 永遠產生相同 `id`，跨次爬取可追蹤同一職缺
- 在同一批結果中唯一

---

## 向後相容說明

| 場景                                 | 行為                                     |
| ------------------------------------ | ---------------------------------------- |
| 現有前端消費 `data[]`                | 無感，多出 `id` 欄位，不影響其他欄位     |
| `GET /last` 讀取舊版 JSON（無 `id`） | 伺服器自動補齊 `id` 後回傳，磁碟檔案不變 |
| 舊版 `jobs.json` 手動讀取            | 不受影響，仍可正常解析                   |

---

## 並行執行說明

各平台現在**同時執行**（而非逐一等待）。

- 整體爬取時間 ≈ 最慢平台的時間（而非所有平台時間之和）
- 若某平台失敗或逾時（120 秒），其他平台結果**仍完整回傳**
- 失敗資訊記錄於伺服器日誌：`[PROVIDER ERROR] name=xxx error=... elapsedMs=...`

---

## 注意事項

- `id` 基於 URL 產生，若兩個職缺 URL 完全相同，視同同一筆（現有去重邏輯）
- 極少情況下不同 URL 產生相同 `id`（雜湊碰撞），後出現者會被捨棄並在日誌中警告
- TypeScript 使用方：需更新 `BaseJob` 型別引用，新增 `id: string` 欄位
