# Data Model: Dashboard Chart Aggregation API

**Feature**: `004-chart-aggregation-api`  
**Phase**: 1 — 設計  
**Date**: 2026-04-12

---

## 型別定義

### 來源型別（現有，不修改）

```typescript
// src/providers/types.ts（現有）
interface BaseJob {
  id: string; // SHA-256(url) 前 8 碼
  title: string; // 職缺職稱（技術標籤推導來源）
  company: string;
  location: string; // 工作地點（縣市或含行政區）
  salary: string;
  date?: string;
  url: string;
  page: number;
  source: string; // "104" | "yourator" | "1111"
}
```

---

### 新增型別（src/utils/chartUtils.ts）

```typescript
export interface PlatformStat {
  platform: "104" | "1111" | "yourator";
  count: number;
}

export interface TagStat {
  tag: string; // 正規化後的 Title Case，例如 "Vue"、"React"、「其他」
  count: number;
}

export interface LocationStat {
  location: string; // 正規化後縣市名稱，例如 "台北市"；空字串 → "不明"
  count: number;
}

export interface ChartStats {
  platforms: PlatformStat[]; // 固定 3 筆，依 104 → 1111 → yourator 順序
  tags: TagStat[]; // 最多 4 筆（Top 3 + 「其他」）；無「其他」時省略
  locations: LocationStat[]; // 全部縣市，依 count 遞減；「不明」固定末尾
  lastCrawledAt: string | null; // ISO 8601 UTC；尚無爬取記錄時為 null
}
```

---

## 純函式規格

### `groupByPlatform(jobs: BaseJob[]): PlatformStat[]`

| 規則        | 說明                                                          |
| ----------- | ------------------------------------------------------------- |
| 固定三平台  | 輸出固定包含 `104`、`1111`、`yourator` 三筆，順序不可變       |
| 零值保留    | 某平台無職缺時 `count: 0`，不省略                             |
| source 比對 | 直接比對 `job.source`（小寫字串），未知 source 不計入任何平台 |

**範例**

```
輸入：[{ source: "104" }, { source: "104" }, { source: "1111" }]
輸出：[{ platform: "104", count: 2 }, { platform: "1111", count: 1 }, { platform: "yourator", count: 0 }]
```

---

### `extractTechTags(jobs: BaseJob[]): TagStat[]`

| 規則         | 說明                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------- |
| 關鍵字清單   | 內建 `TECH_KEYWORDS`（初始：Vue、React、Angular、TypeScript、JavaScript、Next.js、Nuxt、Svelte、Node.js、Vite） |
| 正規化       | `title.toLowerCase()` 後進行不分大小寫比對；輸出顯示名稱用 `TECH_KEYWORDS` 中定義的 Title Case                  |
| 多標籤       | 單一職缺可匹配多個關鍵字，各自計入                                                                              |
| 不匹配       | 不匹配任何關鍵字的職缺計入「其他」（`tag: "其他"`）                                                             |
| 排序         | 依 `count` 遞減排序；並列時依 `TECH_KEYWORDS` 定義順序穩定排序                                                  |
| 截取         | 僅保留前三名；其餘 count 合計為「其他」一筆，附加在末尾                                                         |
| 省略「其他」 | 若前三名已涵蓋所有計數（無殘餘），不加入「其他」                                                                |
| 空輸入       | 輸入 `[]` 時，若 TECH_KEYWORDS 無匹配，回傳 `[]`（無「其他」）                                                  |

**計算流程**

1. 累計每個 keyword 在所有 title 中的出現次數（大小寫不敏感比對）
2. 對每筆職缺，若所有 keyword 均不匹配，`others++`
3. 依 count 遞減排序，取前 3 名
4. `restCount = 排名第 4+ 的已知技術計數合計 + others`；若 `restCount > 0`，附加 `{ tag: "其他", count: restCount }`

> **設計備註（CHK010）**：`groupByPlatform` 的未知 source 直接忽略（平台清單封閉、未知值屬無效資料）；`extractTechTags` 的不匹配職缺歸入「其他」（任何職缺都有技術屬性，只是尚未識別）。兩者語意不同，是刻意設計。

---

### `groupByLocation(jobs: BaseJob[]): LocationStat[]`

| 規則         | 說明                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 前三字正規化 | `location.slice(0, 3)` 作為縣市鍵值（JavaScript `String.slice` 以 UTF-16 字元為單位，中文三字 = 3 codepoints，英文三字母 = 3 chars，行為一致） |
| 長度不足     | `location` 長度 < 3 時，維持原值（不補足、不截斷）                                                                                             |
| 空字串       | `location === ""` → 鍵值為 `"不明"`                                                                                                            |
| 排序         | 依 `count` 遞減排序；**並列時順序不保證**（使用 JS 穩定排序預設行為，不加額外決勝規則）；「不明」強制置於末尾（即使 count 大於其他縣市）       |
| 空輸入       | 輸入 `[]` 時回傳 `[]`                                                                                                                          |
| 全部空字串   | 所有職缺 `location === ""` 時，輸出僅含 `[{ location: "不明", count: n }]` 一筆                                                                |

**範例**

```
輸入：[
  { location: "台北市信義區" }, { location: "台北市中山區" },
  { location: "高雄市" }, { location: "" }
]
輸出：[
  { location: "台北市", count: 2 },
  { location: "高雄市", count: 1 },
  { location: "不明",   count: 1 }   // 強制末尾
]
```

---

## 狀態管理（server.ts 層）

`ChartStats.lastCrawledAt` 由 `server.ts` 的 `GET /charts` handler 注入：

```typescript
// server.ts（示意）
app.get("/charts", (_req, res) => {
  try {
    const jobs = readJobs(); // 回傳 BaseJob[] 或 []
    const stats: ChartStats = {
      platforms: groupByPlatform(jobs),
      tags: extractTechTags(jobs),
      locations: groupByLocation(jobs),
      lastCrawledAt: lastMeta?.at ?? null, // 共用 module-level 變數
    };
    res.json({ ok: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

`readJobs()` 私有輔助函式（重用邏輯，在 `server.ts` 中定義）：

```typescript
function readJobs(): BaseJob[] {
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  if (!fs.existsSync(output)) return []; // 檔案不存在 → 空陣列（不拋出）
  const txt = fs.readFileSync(output, "utf-8");
  return JSON.parse(txt) as BaseJob[]; // 無效 JSON → 拋出（呼叫者 catch → HTTP 500）
}
```

---

## 測試涵蓋矩陣

| 測試情境                                            | 涵蓋函式                             |
| --------------------------------------------------- | ------------------------------------ |
| 空陣列輸入                                          | 三個函式均需                         |
| 平台計數為 0                                        | `groupByPlatform`                    |
| 三平台順序不可變                                    | `groupByPlatform`                    |
| tags 大小寫混用（vue/Vue/VUE）                      | `extractTechTags`                    |
| 單一職缺匹配多個 keyword                            | `extractTechTags`                    |
| 所有職缺無已知技術                                  | `extractTechTags` → 「其他」等於總數 |
| Top 3 截取與「其他」合計（第 4+ 已知技術 + 不匹配） | `extractTechTags`                    |
| **恰好三種技術（無殘餘），「其他」應省略**          | `extractTechTags`（CHK014）          |
| 含行政區地點正規化（台北市信義區 → 台北市）         | `groupByLocation`                    |
| 短地點字串（< 3 字元）維持原值                      | `groupByLocation`                    |
| 空字串地點 → 「不明」                               | `groupByLocation`                    |
| **所有職缺 location 均為空字串 → 僅「不明」一筆**   | `groupByLocation`（CHK015）          |
| 「不明」固定末尾（count 大於其他縣市時）            | `groupByLocation`                    |
| 依計數遞減排序                                      | `groupByLocation`、`extractTechTags` |

> **擴充備註（CHK016）**：`TECH_KEYWORDS` 為模組內常數，擴充時只需修改陣列。現有測試硬編碼特定關鍵字，不受未知新增項影響；但若在現有兩個已知關鍵字「之間」插入新項，可能改變計數並列時的穩定排序結果——需同步檢視並列情境的測試。
