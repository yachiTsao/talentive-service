# Quickstart: Favorite API

**Feature**: 003-favorite-api  
**Date**: 2026-04-06

---

## 前置需求

- 已有一次成功的爬取紀錄（`jobs.json` 存在）
- 執行中的 `talentive-service`（`npm run dev` 或 Docker 容器）
- 環境變數 `FAVORITES_OUTPUT`（可選，預設 `/app/data/favorites.json`）

---

## 本地開發啟動

```bash
# 1. 安裝依賴
npm install

# 2. 啟動 dev server
npm run dev
# → [API] listening on :3000

# 3. 先執行一次爬取，產生 jobs.json（若尚未存在）
curl -s -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{"keyword":"前端工程師","pages":1,"providers":["104"]}' | jq .
```

---

## 快速試用：收藏功能

### 步驟 1：查看目前職缺列表，確認 `id`

```bash
curl -s http://localhost:3000/last | jq '[.[] | {id, title, source, is_fav}]'
```

記下任一筆職缺的 `id`（8 碼十六進位，如 `a3f9c021`）。

---

### 步驟 2：加入收藏

```bash
curl -s -X POST http://localhost:3000/favorites/a3f9c021 | jq .
# 成功 → { "ok": true, "data": { "id": "a3f9c021", ... } }
# 重複新增 → { "ok": false, "error": "職缺已在收藏清單中" } (HTTP 409)
# id 不存在 → { "ok": false, "error": "..." } (HTTP 404)
```

---

### 步驟 3：驗證 `is_fav` 欄位

```bash
curl -s http://localhost:3000/last | jq '[.[] | select(.id == "a3f9c021") | {id, is_fav}]'
# → [{ "id": "a3f9c021", "is_fav": true }]
```

---

### 步驟 4：列出收藏清單（依平台分群）

```bash
curl -s http://localhost:3000/favorites | jq '.data'
# → { "104": [...], "yourator": [...] }
```

---

### 步驟 5：移除收藏

```bash
curl -s -X DELETE http://localhost:3000/favorites/a3f9c021 | jq .
# → { "ok": true }

# 確認 is_fav 已恢復 false
curl -s http://localhost:3000/last | jq '[.[] | select(.id == "a3f9c021") | {id, is_fav}]'
# → [{ "id": "a3f9c021", "is_fav": false }]
```

---

## 執行測試

```bash
# 執行所有單元測試（含 favorites 相關）
npm test
```

---

## Docker 環境設定

在 `docker-compose.yml` 或 `docker run` 中可設定：

```bash
docker run \
  -e OUTPUT=/app/data/jobs.json \
  -e FAVORITES_OUTPUT=/app/data/favorites.json \
  -e PORT=3000 \
  -v $(pwd)/data:/app/data \
  talentive-service
```

`favorites.json` 與 `jobs.json` 存於同一掛載目錄，重啟後資料持續保留。

---

## 常見問題

| 問題                           | 解決方案                                                      |
| ------------------------------ | ------------------------------------------------------------- |
| `POST /favorites/:id` 回傳 404 | 先執行 `POST /crawl` 產生 `jobs.json`，確認 `id` 存在於清單中 |
| 收藏後 `is_fav` 仍為 `false`   | 確認 `FAVORITES_OUTPUT` 路徑與服務可讀取權限一致              |
| 重啟後收藏清單消失             | 確認 `favorites.json` 所在目錄已掛載為持久化 volume           |
