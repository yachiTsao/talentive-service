# Research: Dashboard Chart Aggregation API

**Feature**: `004-chart-aggregation-api`  
**Phase**: 0 — 解析未知項目與技術決策  
**Date**: 2026-04-12

---

## 研究議題一：`lastCrawledAt` 資料來源

### 問題

`GET /charts` 需要回傳 `lastCrawledAt`（與 `GET /health` 的 `last.at` 相同來源）。目前 `lastMeta` 是 `server.ts` 模組層級的私有變數，`GET /charts` 路由需要能讀取它。

### 調查結果

`server.ts` 中 `lastMeta` 宣告為：

```typescript
let lastMeta: { at: string; count: number } | null = null;
```

此變數在 `POST /crawl` 成功後設定，在 `GET /health` 中回傳。若將 `GET /charts` 的 handler 直接加入 `server.ts`，兩個 handler 可共用同一個 `lastMeta` 閉包變數，**不需要任何重構或新模組**。

### 決策

- **決定**：在 `server.ts` 中直接內聯 `GET /charts` route handler，與 `GET /health`、`GET /last` 並列，共用`lastMeta` module-level 變數。
- **理由**：最小攻擊面，無需引入共享狀態模組，符合現有慣例（所有 handler 均在 `server.ts` 內）。
- **排除替代方案**：將 `lastMeta` 提取至獨立模組 → 增加重構範圍，超出本功能邊界。

---

## 研究議題二：jobs.json 讀取函式重用策略

### 問題

FR-008 要求重用 `GET /last` 的內部讀檔函式，避免重複实作。`GET /last` 的讀取邏輯目前直接內嵌於 `server.ts` 的 handler 中（約 20 行），包含：路徑解析、`fs.existsSync`、`fs.readFileSync`、JSON.parse、舊版 id 補齊、`is_fav` 標記。

### 調查結果

`GET /charts` 只需要純粹的職缺陣列（`BaseJob[]`），**不需要** `is_fav` 標記也**不需要**舊版 id 補齊（`GET /charts` 作統計用，id 不影響計算）。如果直接呼叫現有 `/last` handler 的完整邏輯，會包含不必要的邏輯。

最輕量的方案是**提取一個 `readJobs()` 私有輔助函式**，只做：

1. 讀取 `process.env.OUTPUT || "/app/data/jobs.json"`
2. `fs.existsSync` 判斷 → 不存在回傳 `[]`（for `/charts`）
3. `JSON.parse` → 失敗 `throw`（呼叫者 catch 後回傳 HTTP 500）

### 決策

- **決定**：在 `server.ts` 中提取 `readJobs(): BaseJob[]` 私有輔助函式（約 10 行），供 `GET /last` 和 `GET /charts` 共用；`GET /last` 在此基礎上疊加 id 補齊與 `is_fav` 邏輯。
- **理由**：消除重複讀檔程式碼；`GET /last` 現有行為不變；`GET /charts` 得到乾淨的 `BaseJob[]`。
- **排除替代方案**：直接複製讀檔程式碼 → 未來路徑或環境變數變更時需雙重維護。

---

## 研究議題三：技術標籤關鍵字清單設計

### 問題

`chartUtils.ts` 需要對 `title` 欄位做關鍵字比對，以推導技術標籤。關鍵字清單的範圍和格式需要確定。

### 調查結果

分析現有的 `jobs.json`（樣本資料）及一般台灣前端職缺職稱，常見關鍵字：

- **框架**：Vue、React、Angular、Svelte、Nuxt、Next.js
- **語言**：TypeScript、JavaScript
- **工具**：Vite、Webpack
- **全端**：Node.js（前端職缺常見）

比對規則：

- 大小寫不敏感（`vue`、`Vue`、`VUE` 均視為 `Vue`）
- 每個職缺 title 可匹配多個關鍵字（計數各自累加）
- 不匹配任何關鍵字者計入「其他」

### 決策

- **決定**：在 `chartUtils.ts` 中定義 `TECH_KEYWORDS` 常數陣列，包含 10 個初始關鍵字（Vue、React、Angular、TypeScript、JavaScript、Next.js、Nuxt、Svelte、Node.js、Vite）；以正規化後的 Title Case 作為顯示名稱。
- **理由**：關鍵字定義在純函式模組內，後續擴充只需修改常數，無副作用。
- **排除替代方案**：從外部設定注入關鍵字清單 → 過度工程化，本功能不需要動態設定。

---

## 研究議題四：純函式的輸入輸出型別設計

### 問題

`chartUtils.ts` 需要定義明確的輸入（`BaseJob[]`）與輸出型別，並確保與 `ChartStats` response 型別對齊。

### 決策

```typescript
// 輸入型別：直接使用現有的 BaseJob（從 providers/types.ts import）

// 輸出型別（定義於 chartUtils.ts）：
interface PlatformStat {
  platform: "104" | "1111" | "yourator";
  count: number;
}

interface TagStat {
  tag: string;
  count: number;
}

interface LocationStat {
  location: string;
  count: number;
}

interface ChartStats {
  platforms: PlatformStat[]; // 固定 3 筆
  tags: TagStat[]; // 最多 4 筆（Top 3 + 「其他」）
  locations: LocationStat[]; // 全部縣市，「不明」末尾
  lastCrawledAt: string | null; // 由 server.ts 注入，非 chartUtils 計算
}
```

- **理由**：`lastCrawledAt` 由 `server.ts` 注入（因為它在 `lastMeta` 中），不屬於純函式計算範疇。三個純函式各自只接受 `BaseJob[]` 並回傳對應的 stat 陣列，保持最小職責。

---

## 研究議題五：`GET /charts` 對 jobs.json 不存在的行為

### 問題

spec 規定 jobs.json 不存在時 `/charts` 回傳 HTTP 200（空 ChartStats），而 `/last` 回傳 404。兩者行為不同，實作時需明確區分。

### 決策

- `readJobs()` 在檔案不存在時回傳 `[]`（空陣列），不拋出例外。
- `GET /charts` handler 收到 `[]` 後，呼叫 chartUtils 計算出空統計（platforms 三平台均 0，tags/locations 均 `[]`），正常回傳 HTTP 200。
- `GET /last` 在現有邏輯中保留 `fs.existsSync` 判斷回傳 404，使用 `readJobs()` 時需在 handler 層做此判斷，而非在 `readJobs()` 內。

---

## 無未解決項目

所有 NEEDS CLARIFICATION 已在 Clarifications 階段解決，research.md 無新增未解項。
