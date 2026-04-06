import fs from 'fs';
import path from 'path';

// ── Error type ───────────────────────────────────────────────
export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

// ── Data types ───────────────────────────────────────────────
export interface FavoriteEntry {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  url: string;
  source: string;
  savedAt: string; // ISO 8601 UTC
}

export type GroupedFavorites = Record<string, FavoriteEntry[]>;

// ── Path helpers ─────────────────────────────────────────────
export function favoritesPath(): string {
  return process.env.FAVORITES_OUTPUT ?? '/app/data/favorites.json';
}

function jobsPath(): string {
  return process.env.OUTPUT ?? '/app/data/jobs.json';
}

// ── Mutex (Promise Chain Lock) ───────────────────────────────
let writeLock: Promise<void> = Promise.resolve();

export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeLock.then(() => fn());
  // Chain onto lock so next writer queues after this one
  writeLock = result.then(() => undefined, () => undefined);
  return result;
}

// ── Core store functions ─────────────────────────────────────

/** Load favorites from disk. Returns [] if file missing or corrupt (FR-012). */
export function loadFavorites(): FavoriteEntry[] {
  const p = favoritesPath();
  if (!fs.existsSync(p)) return [];
  try {
    const txt = fs.readFileSync(p, 'utf-8');
    return JSON.parse(txt) as FavoriteEntry[];
  } catch {
    // Corrupt JSON — auto-reset (FR-012)
    return [];
  }
}

/** Atomic write: write to tmp then rename (crash-safe). */
export function saveFavorites(entries: FavoriteEntry[]): void {
  const p = favoritesPath();
  const tmp = p + '.tmp';
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(entries, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

/** Return a Set of all favorited ids (reads from disk, no lock needed). */
export function getFavoriteIds(): Set<string> {
  return new Set(loadFavorites().map((e) => e.id));
}

// ── US1: addFavorite ─────────────────────────────────────────

export async function addFavorite(id: string): Promise<FavoriteEntry> {
  return withWriteLock(async () => {
    // Read jobs.json
    const jp = jobsPath();
    if (!fs.existsSync(jp)) {
      throw new AppError(404, '最近一次爬取結果不存在');
    }
    let jobs: any[];
    try {
      jobs = JSON.parse(fs.readFileSync(jp, 'utf-8'));
    } catch {
      throw new AppError(500, 'jobs.json 解析失敗');
    }

    const job = jobs.find((j: any) => j.id === id);
    if (!job) {
      throw new AppError(404, '職缺 id 不存在於最近一次爬取結果');
    }

    const current = loadFavorites();
    if (current.some((e) => e.id === id)) {
      throw new AppError(409, '職缺已在收藏清單中');
    }

    const entry: FavoriteEntry = {
      id: job.id,
      title: job.title ?? '',
      company: job.company ?? '',
      location: job.location ?? '',
      salary: job.salary ?? '',
      url: job.url ?? '',
      source: job.source ?? '',
      savedAt: new Date().toISOString(),
    };

    saveFavorites([...current, entry]);
    return entry;
  });
}

// ── US2: groupBySource ───────────────────────────────────────

export function groupBySource(entries: FavoriteEntry[]): GroupedFavorites {
  const grouped = entries.reduce<GroupedFavorites>((acc, entry) => {
    if (!acc[entry.source]) acc[entry.source] = [];
    acc[entry.source].push(entry);
    return acc;
  }, {});

  // Sort each group by savedAt descending
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  return grouped;
}

// ── US3: removeFavorite ──────────────────────────────────────

export async function removeFavorite(id: string): Promise<void> {
  return withWriteLock(async () => {
    const current = loadFavorites();
    saveFavorites(current.filter((e) => e.id !== id));
  });
}
