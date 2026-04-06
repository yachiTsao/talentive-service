# Data Model: 優化爬蟲流程並加入 id 欄位

**Branch**: `002-optimize-flow-add-id` | **Date**: 2026-04-05

## 實體定義

### BaseJob（更新後）

代表一筆從任意平台抓取並標準化的職缺資料。

| 欄位       | 型別     | 必填 | 說明                                                         | 變更     |
| ---------- | -------- | ---- | ------------------------------------------------------------ | -------- |
| `id`       | `string` | ✅   | SHA-256(url) 前 8 碼十六進位。決定性識別碼，跨次爬取保持一致 | **新增** |
| `title`    | `string` | ✅   | 職稱                                                         | 不變     |
| `company`  | `string` | ✅   | 公司名稱                                                     | 不變     |
| `location` | `string` | ✅   | 地點                                                         | 不變     |
| `salary`   | `string` | ✅   | 薪資（原始字串）                                             | 不變     |
| `date`     | `string` | ❌   | 發布日期（104 有，其他平台可能為空）                         | 不變     |
| `url`      | `string` | ✅   | 原始職缺連結；同時是 `id` 的產生來源                         | 不變     |
| `page`     | `number` | ✅   | 來源頁碼                                                     | 不變     |
| `source`   | `string` | ✅   | Provider 名稱（`104` / `yourator` / `1111`）                 | 不變     |

**缺值規則**（既有，維持不變）：所有必填字串欄位缺值時用 `""` 填入，不使用 `null` 或 `undefined`。

---

### generateId 函式合約

| 項目     | 說明                                                         |
| -------- | ------------------------------------------------------------ |
| 輸入     | `url: string`（任意職缺 URL）                                |
| 輸出     | `string`（8 個小寫十六進位字元，例如 `"a3f9c021"`）          |
| 演算法   | `SHA-256(utf-8 encoded url)` → hex digest → slice(0, 8)      |
| 確定性   | 相同輸入永遠回傳相同輸出                                     |
| 碰撞處理 | 由呼叫方（`assignIds`）偵測並處理，此函式純函數              |
| 模組位置 | `src/utils/id.ts`（由 `crawler.ts` 與 `server.ts` 共用匯入） |

---

### ProviderResult（內部輔助型別，新增）

用於並行執行時表示單一 provider 的執行結果，不對外暴露。

| 欄位        | 型別            | 說明                          |
| ----------- | --------------- | ----------------------------- |
| `name`      | `string`        | Provider 名稱                 |
| `jobs`      | `BaseJob[]`     | 成功時的職缺列表              |
| `error`     | `Error \| null` | 失敗時的錯誤，成功時為 `null` |
| `elapsedMs` | `number`        | 執行耗時（毫秒）              |

---

## 狀態轉換

### 職缺資料流（更新後）

```
Platform HTML/API
    ↓
Provider.fetch()            → BaseJob[]（無 id）
    ↓
dedupeByUrl()               → BaseJob[]（URL 去重，無 id）
    ↓
assignIds()                 → BaseJob[]（含 id，含碰撞過濾）
    ↓
writeOutput() / return      → 最終 BaseJob[]（完整）
```

### `GET /last` 補齊流程

```
磁碟 jobs.json
    ↓
JSON.parse()                → any[]
    ↓
缺少 id？
  ├─ 是 → map + generateId() → BaseJob[]（補齊，不寫回磁碟）
  └─ 否 → 直接回傳原始字串（效能最佳）
```

---

## 驗證規則

| 規則        | 說明                                              |
| ----------- | ------------------------------------------------- |
| `id` 長度   | 恰好 8 個字元                                     |
| `id` 字元集 | 僅含 `[0-9a-f]`                                   |
| `id` 唯一性 | 同一批輸出中不重複（碰撞者捨棄並警告）            |
| 向後相容    | 舊版 JSON 缺少 `id` 不視為錯誤，由 GET /last 補齊 |

---

## 型別定義（TypeScript，供實作參考）

```ts
// src/providers/types.ts（更新）
export interface BaseJob {
  id: string; // 新增：SHA-256(url) 前 8 碼
  title: string;
  company: string;
  location: string;
  salary: string;
  date?: string;
  url: string;
  page: number;
  source: string;
}

// src/utils/id.ts（新增）
import crypto from "crypto";

export function generateId(url: string): string {
  return crypto
    .createHash("sha256")
    .update(url, "utf8")
    .digest("hex")
    .slice(0, 8);
}
```
