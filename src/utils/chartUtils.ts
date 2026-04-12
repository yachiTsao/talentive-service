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
      b[1] - a[1] || TECH_KEYWORDS.indexOf(a[0]) - TECH_KEYWORDS.indexOf(b[0])
  );

  const top3 = sorted.slice(0, 3).map(([tag, count]) => ({ tag, count }));
  const restCount =
    sorted.slice(3).reduce((sum, [, c]) => sum + c, 0) + others;

  if (restCount > 0) top3.push({ tag: "其他", count: restCount });
  return top3;
}

// ── 圖表三：工作地點分佈 ─────────────────────────────────────
export function groupByLocation(jobs: BaseJob[]): LocationStat[] {
  const counts = new Map<string, number>();

  for (const job of jobs) {
    const raw = job.location;
    const key = raw === "" ? "不明" : raw.length >= 3 ? raw.slice(0, 3) : raw;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const unknown = counts.get("不明") ?? 0;
  counts.delete("不明");

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([location, count]) => ({ location, count }));

  if (unknown > 0) sorted.push({ location: "不明", count: unknown });
  return sorted;
}
