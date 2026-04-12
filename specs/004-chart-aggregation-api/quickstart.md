# Quickstart: Dashboard Chart Aggregation API

**Feature**: `004-chart-aggregation-api`  
**Date**: 2026-04-12

---

## 實作概述

本功能需新增兩個檔案、修改一個現有檔案：

| 動作 | 檔案                           | 說明                                       |
| ---- | ------------------------------ | ------------------------------------------ |
| 新增 | `src/utils/chartUtils.ts`      | 三個純函式 + 型別定義                      |
| 新增 | `src/utils/chartUtils.test.ts` | 單元測試（覆蓋所有邊界情境）               |
| 修改 | `src/server.ts`                | 提取 `readJobs()`、新增 `GET /charts` 路由 |

---

## 步驟一：建立 `src/utils/chartUtils.ts`

定義型別與三個純函式。

```typescript
import type { BaseJob } from "../providers/types";

// ── 技術標籤關鍵字清單 ──────────────────────────────────────
const TECH_KEYWORDS = [
  "Vue",
  "React",
  "Angular",
  "TypeScript",
  "JavaScript",
  "Next.js",
  "Nuxt",
  "Svelte",
  "Node.js",
  "Vite",
];

// ── 型別定義 ─────────────────────────────────────────────────
export interface PlatformStat {
  platform: "104" | "1111" | "yourator";
  count: number;
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface LocationStat {
  location: string;
  count: number;
}

export interface ChartStats {
  platforms: PlatformStat[];
  tags: TagStat[];
  locations: LocationStat[];
  lastCrawledAt: string | null;
}

// ── 圖表一：來源平台比例 ──────────────────────────────────────
export function groupByPlatform(jobs: BaseJob[]): PlatformStat[] {
  const counts: Record<string, number> = { "104": 0, "1111": 0, yourator: 0 };
  for (const job of jobs) {
    if (job.source in counts) counts[job.source]++;
  }
  return [
    { platform: "104", count: counts["104"] },
    { platform: "1111", count: counts["1111"] },
    { platform: "yourator", count: counts["yourator"] },
  ];
}

// ── 圖表二：前端技術標籤比例 ─────────────────────────────────
export function extractTechTags(jobs: BaseJob[]): TagStat[] {
  const counts = new Map<string, number>();
  let others = 0;

  for (const job of jobs) {
    const lower = job.title.toLowerCase();
    let matched = false;
    for (const kw of TECH_KEYWORDS) {
      if (lower.includes(kw.toLowerCase())) {
        counts.set(kw, (counts.get(kw) ?? 0) + 1);
        matched = true;
      }
    }
    if (!matched) others++;
  }

  // 依計數遞減排序（並列時依 TECH_KEYWORDS 順序穩定排序）
  const sorted = [...counts.entries()].sort(
    (a, b) =>
      b[1] - a[1] || TECH_KEYWORDS.indexOf(a[0]) - TECH_KEYWORDS.indexOf(b[0]),
  );

  const top3 = sorted.slice(0, 3).map(([tag, count]) => ({ tag, count }));
  const restCount = sorted.slice(3).reduce((sum, [, c]) => sum + c, 0) + others;

  if (restCount > 0) top3.push({ tag: "其他", count: restCount });
  return top3;
}

// ── 圖表三：工作地點分佈 ─────────────────────────────────────
export function groupByLocation(jobs: BaseJob[]): LocationStat[] {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    const raw = job.location;
    const key = raw === "" ? "其他" : raw.length >= 3 ? raw.slice(0, 3) : raw;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const unknown = counts.get("其他") ?? 0;
  counts.delete("其他");

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([location, count]) => ({ location, count }));

  if (unknown > 0) sorted.push({ location: "其他", count: unknown });
  return sorted;
}
```

---

## 步驟二：建立 `src/utils/chartUtils.test.ts`

依照 data-model.md 的測試涵蓋矩陣撰寫測試。

```typescript
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  groupByPlatform,
  extractTechTags,
  groupByLocation,
} from "./chartUtils";
import type { BaseJob } from "../providers/types";

const job = (overrides: Partial<BaseJob>): BaseJob => ({
  id: "test0001",
  title: "",
  company: "",
  location: "",
  salary: "",
  url: "",
  page: 1,
  source: "104",
  ...overrides,
});

// ── groupByPlatform ───────────────────────────────────────────
test("groupByPlatform 空陣列回傳三平台皆為 0", () => {
  const result = groupByPlatform([]);
  assert.deepEqual(result, [
    { platform: "104", count: 0 },
    { platform: "1111", count: 0 },
    { platform: "yourator", count: 0 },
  ]);
});

test("groupByPlatform 計數正確且順序固定", () => {
  const jobs = [
    job({ source: "104" }),
    job({ source: "104" }),
    job({ source: "1111" }),
  ];
  const result = groupByPlatform(jobs);
  assert.equal(result[0].platform, "104");
  assert.equal(result[0].count, 2);
  assert.equal(result[1].platform, "1111");
  assert.equal(result[1].count, 1);
  assert.equal(result[2].platform, "yourator");
  assert.equal(result[2].count, 0);
});

// ── extractTechTags ───────────────────────────────────────────
test("extractTechTags 空陣列回傳空陣列", () => {
  assert.deepEqual(extractTechTags([]), []);
});

test("extractTechTags 大小寫正規化 vue/Vue/VUE 計為同一", () => {
  const jobs = [
    job({ title: "vue 工程師" }),
    job({ title: "Vue.js Developer" }),
    job({ title: "VUE 前端" }),
  ];
  const result = extractTechTags(jobs);
  assert.equal(result[0].tag, "Vue");
  assert.equal(result[0].count, 3);
});

test("extractTechTags 無已知關鍵字時「其他」等於職缺總數", () => {
  const jobs = [job({ title: "業務助理" }), job({ title: "後端工程師" })];
  const result = extractTechTags(jobs);
  assert.equal(result.length, 1);
  assert.equal(result[0].tag, "其他");
  assert.equal(result[0].count, 2);
});

test("extractTechTags Top3 截取且剩餘歸入「其他」", () => {
  const jobs = [
    ...Array(10).fill(job({ title: "Vue 工程師" })),
    ...Array(6).fill(job({ title: "React 工程師" })),
    ...Array(4).fill(job({ title: "Angular 工程師" })),
    ...Array(2).fill(job({ title: "TypeScript 工程師" })),
  ];
  const result = extractTechTags(jobs);
  assert.equal(result.length, 4);
  assert.equal(result[3].tag, "其他");
  assert.equal(result[3].count, 2);
});

// ── groupByLocation ───────────────────────────────────────────
test("groupByLocation 空陣列回傳空陣列", () => {
  assert.deepEqual(groupByLocation([]), []);
});

test("groupByLocation 含行政區地點正規化", () => {
  const jobs = [
    job({ location: "台北市信義區" }),
    job({ location: "台北市中山區" }),
    job({ location: "高雄市" }),
  ];
  const result = groupByLocation(jobs);
  const taipei = result.find((r) => r.location === "台北市");
  assert.ok(taipei);
  assert.equal(taipei.count, 2);
});

test("groupByLocation 空字串歸為「其他」且排末尾", () => {
  const jobs = [
    job({ location: "" }),
    job({ location: "台北市" }),
    job({ location: "" }),
  ];
  const result = groupByLocation(jobs);
  assert.equal(result[result.length - 1].location, "其他");
  assert.equal(result[result.length - 1].count, 2);
});

test("groupByLocation 短地點字串（< 3 字元）維持原值", () => {
  const jobs = [job({ location: "台北" })];
  const result = groupByLocation(jobs);
  assert.equal(result[0].location, "台北");
});

test("groupByLocation「其他」計數最大時仍在末尾", () => {
  const jobs = [
    ...Array(5).fill(job({ location: "" })),
    job({ location: "台北市" }),
  ];
  const result = groupByLocation(jobs);
  assert.equal(result[result.length - 1].location, "其他");
  assert.equal(result[result.length - 1].count, 5);
});
```

---

## 步驟三：修改 `src/server.ts`

### 3-1 新增 import

```typescript
import {
  groupByPlatform,
  extractTechTags,
  groupByLocation,
  type ChartStats,
} from "./utils/chartUtils";
import type { BaseJob } from "./providers/types";
```

### 3-2 提取 `readJobs()` 私有輔助函式（建議放在 `let isRunning` 前）

```typescript
/** 讀取 jobs.json；檔案不存在時回傳 []，無效 JSON 時拋出例外 */
function readJobs(): BaseJob[] {
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  if (!fs.existsSync(output)) return [];
  const txt = fs.readFileSync(output, "utf-8");
  return JSON.parse(txt) as BaseJob[];
}
```

### 3-3 重構 `GET /last`（使用 `readJobs()`）

```typescript
app.get("/last", (_req: Request, res: Response) => {
  const output = process.env.OUTPUT || "/app/data/jobs.json";
  if (!fs.existsSync(output))
    return res.status(404).json({ ok: false, message: "檔案不存在" });
  try {
    const jobs = readJobs();
    const needsPatch = jobs.some((j: any) => !j.id);
    const patched = needsPatch
      ? jobs.map((j: any) => {
          if (j.id) return j;
          if (!j.url) {
            console.warn(`[GET /last] 缺少 url: ${JSON.stringify(j)}`);
            return { ...j, id: "" };
          }
          return { ...j, id: generateId(j.url) };
        })
      : jobs;
    const favIds = getFavoriteIds();
    return res.json(
      patched.map((j: any) => ({ ...j, is_fav: favIds.has(j.id) })),
    );
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

### 3-4 新增 `GET /charts` 路由（放在 `GET /last` 之後，`app.use('/favorites', ...)` 之前）

```typescript
app.get("/charts", (_req: Request, res: Response) => {
  try {
    const jobs = readJobs();
    const stats: ChartStats = {
      platforms: groupByPlatform(jobs),
      tags: extractTechTags(jobs),
      locations: groupByLocation(jobs),
      lastCrawledAt: lastMeta?.at ?? null,
    };
    res.json({ ok: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
```

---

## 步驟四：執行測試

```bash
# 執行所有單元測試（包含新增的 chartUtils.test.ts）
npx ts-node --test src/utils/chartUtils.test.ts

# 或執行全部測試
npm test
```

期望輸出：所有測試通過，無失敗，無跳過。

---

## 步驟五：手動驗證

```bash
# 啟動服務
npx ts-node src/server.ts

# 尚未爬取時（jobs.json 不存在）→ 應回傳空 ChartStats
curl http://localhost:3000/charts

# 先觸發爬蟲
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{"keyword":"前端工程師","pages":1}'

# 爬取完成後查看圖表統計
curl http://localhost:3000/charts
```

預期回應格式請參閱 [contracts/api.md](./contracts/api.md)。
