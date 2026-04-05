# 快速入門：001-api-scaffold-setup

本文件說明如何在本機啟動服務，並驗證 CORS、SQLite migration 與健康檢查端點均正常運作。

---

## 前置條件

| 工具    | 版本     |
| ------- | -------- |
| Node.js | 18+ LTS  |
| npm     | ≥ 9      |
| Git     | 任意版本 |

---

## 安裝依賴

```bash
cd talentive-service
npm install
```

> 本功能將新增 `better-sqlite3`、`cors`（及其型別）到 `package.json`。
> 若 `node_modules/` 尚未包含這些套件，請在 `npm install` 前確認 `package.json` 已更新。

---

## 環境變數

| 變數名稱  | 預設值                | 用途              |
| --------- | --------------------- | ----------------- |
| `PORT`    | `3000`                | HTTP 監聽埠       |
| `DB_PATH` | `./data/talentive.db` | SQLite 資料庫路徑 |
| `OUTPUT`  | `/app/data/jobs.json` | 爬蟲輸出檔路徑    |

本機開發不需要手動建立 `.env`，預設值已足夠；如需客製化可直接在 shell 中設定：

```bash
export DB_PATH=./data/dev.db
```

---

## 啟動服務

```bash
npm run dev
```

預期啟動輸出：

```
[INFO] migration: 001_create_favorites.sql applied
[INFO] server listening on :3000
```

> 若 migration 失敗，程序會以非零 exit code 結束並印出 `[ERROR]` 訊息。
> 此為刻意設計（fail-fast），請修正 migration 檔後重新啟動。

---

## 驗證端點

### 1. 健康檢查

```bash
curl http://localhost:3000/health
```

預期回應（HTTP 200）：

```json
{ "ok": true, "running": false, "last": null }
```

### 2. 確認 CORS 設定正確

```bash
curl -i -H "Origin: http://localhost:5173" http://localhost:3000/health
```

預期 response headers 含：

```
Access-Control-Allow-Origin: http://localhost:5173
```

### 3. 確認 SQLite 資料庫已建立

```bash
ls ./data/talentive.db
```

或直接查詢：

```bash
npx better-sqlite3 ./data/talentive.db "SELECT * FROM favorites;"
```

---

## Docker 執行（選用）

```bash
docker build -t talentive-service .
docker run -p 3000:3000 -v $(pwd)/data:/app/data talentive-service
```

---

## 常見問題

| 現象                                  | 原因                     | 解法                                         |
| ------------------------------------- | ------------------------ | -------------------------------------------- |
| `[ERROR] migration failed` + 程序退出 | SQL 語法錯誤或資料庫鎖定 | 檢查 migration 檔內容；確認無其他程序持有 DB |
| `CORS error` in 瀏覽器                | Origin 不符合設定        | 確認前端執行於 `http://localhost:5173`       |
| 無法連線 3000 port                    | PORT 被佔用              | `export PORT=3001` 後重新啟動                |
