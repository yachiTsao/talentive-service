import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Store functions will be imported once implemented
import {
  loadFavorites,
  saveFavorites,
  getFavoriteIds,
  addFavorite,
  removeFavorite,
  groupBySource,
  type FavoriteEntry,
} from './store';

// ── Test helpers ─────────────────────────────────────────────

let tmpDir: string;
let tmpFile: string;

function makeTmpFavoritesPath(): string {
  return path.join(tmpDir, 'favorites.json');
}

function makeEntry(overrides: Partial<FavoriteEntry> = {}): FavoriteEntry {
  return {
    id: 'a3f9c021',
    title: '前端工程師',
    company: '範例公司',
    location: '台北市',
    salary: '60,000–90,000',
    url: 'https://www.104.com.tw/job/a3f9c021',
    source: '104',
    savedAt: '2026-04-06T10:00:00.000Z',
    ...overrides,
  };
}

function makeJobsJson(tmpJobsDir: string, jobs: object[]): string {
  const p = path.join(tmpJobsDir, 'jobs.json');
  fs.writeFileSync(p, JSON.stringify(jobs), 'utf-8');
  return p;
}

// ── Phase 2 — Foundational tests (T004) ─────────────────────

describe('loadFavorites', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    process.env.FAVORITES_OUTPUT = makeTmpFavoritesPath();
  });

  afterEach(() => {
    delete process.env.FAVORITES_OUTPUT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('檔案不存在時回傳空陣列', () => {
    const result = loadFavorites();
    assert.deepStrictEqual(result, []);
  });

  it('損毀 JSON 時自動重置為空陣列（FR-012）', () => {
    fs.writeFileSync(process.env.FAVORITES_OUTPUT!, '{ bad json !!', 'utf-8');
    const result = loadFavorites();
    assert.deepStrictEqual(result, []);
  });
});

describe('saveFavorites + loadFavorites', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    process.env.FAVORITES_OUTPUT = makeTmpFavoritesPath();
  });

  afterEach(() => {
    delete process.env.FAVORITES_OUTPUT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('寫入後可再讀取，內容一致', () => {
    const entry = makeEntry();
    saveFavorites([entry]);
    const loaded = loadFavorites();
    assert.deepStrictEqual(loaded, [entry]);
  });
});

describe('getFavoriteIds', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    process.env.FAVORITES_OUTPUT = makeTmpFavoritesPath();
  });

  afterEach(() => {
    delete process.env.FAVORITES_OUTPUT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('favorites.json 不存在時回傳空 Set', () => {
    const ids = getFavoriteIds();
    assert.strictEqual(ids.size, 0);
  });
});

// ── Phase 3 — US1: addFavorite (T007) ───────────────────────

describe('addFavorite', () => {
  let tmpJobsDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    tmpJobsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobs-test-'));
    process.env.FAVORITES_OUTPUT = makeTmpFavoritesPath();
  });

  afterEach(() => {
    delete process.env.FAVORITES_OUTPUT;
    delete process.env.OUTPUT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(tmpJobsDir, { recursive: true, force: true });
  });

  it('新增成功回傳 FavoriteEntry（含 savedAt）', async () => {
    const jobId = 'a3f9c021';
    process.env.OUTPUT = makeJobsJson(tmpJobsDir, [
      { id: jobId, title: '前端工程師', company: '範例公司', location: '台北市', salary: '60k', url: 'https://104.com.tw/job/a3f9c021', page: 1, source: '104' },
    ]);
    const entry = await addFavorite(jobId);
    assert.strictEqual(entry.id, jobId);
    assert.strictEqual(entry.title, '前端工程師');
    assert.ok(entry.savedAt, 'savedAt 應存在');
    assert.match(entry.savedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('重複新增拋出 AppError statusCode=409', async () => {
    const jobId = 'a3f9c021';
    process.env.OUTPUT = makeJobsJson(tmpJobsDir, [
      { id: jobId, title: '前端工程師', company: '範例公司', location: '台北市', salary: '', url: 'https://104.com.tw/job/a3f9c021', page: 1, source: '104' },
    ]);
    await addFavorite(jobId);
    await assert.rejects(
      () => addFavorite(jobId),
      (err: any) => { assert.strictEqual(err.statusCode, 409); return true; }
    );
  });

  it('jobs.json 不存在拋出 AppError statusCode=404', async () => {
    // OUTPUT points to non-existent file
    process.env.OUTPUT = path.join(tmpJobsDir, 'nonexistent.json');
    await assert.rejects(
      () => addFavorite('a3f9c021'),
      (err: any) => { assert.strictEqual(err.statusCode, 404); return true; }
    );
  });

  it('id 不在 jobs.json 中拋出 AppError statusCode=404', async () => {
    process.env.OUTPUT = makeJobsJson(tmpJobsDir, [
      { id: 'aaaabbbb', title: '其他職缺', company: 'X', location: '', salary: '', url: 'https://x.com', page: 1, source: '104' },
    ]);
    await assert.rejects(
      () => addFavorite('a3f9c021'),
      (err: any) => { assert.strictEqual(err.statusCode, 404); return true; }
    );
  });
});

// ── Phase 4 — US2: groupBySource (T011) ─────────────────────

describe('groupBySource', () => {
  it('跨平台資料分群正確', () => {
    const entries = [
      makeEntry({ id: 'aaa00001', source: '104', savedAt: '2026-04-06T10:00:00.000Z' }),
      makeEntry({ id: 'bbb00001', source: 'yourator', savedAt: '2026-04-06T09:00:00.000Z' }),
    ];
    const result = groupBySource(entries);
    assert.ok(result['104']);
    assert.ok(result['yourator']);
    assert.strictEqual(result['104'].length, 1);
    assert.strictEqual(result['yourator'].length, 1);
  });

  it('群內依 savedAt 降冪排序（較新收藏在前）', () => {
    const entries = [
      makeEntry({ id: 'old00001', source: '104', savedAt: '2026-04-06T08:00:00.000Z' }),
      makeEntry({ id: 'new00001', source: '104', savedAt: '2026-04-06T10:00:00.000Z' }),
    ];
    const result = groupBySource(entries);
    assert.strictEqual(result['104'][0].id, 'new00001');
    assert.strictEqual(result['104'][1].id, 'old00001');
  });

  it('清單為空回傳 {}', () => {
    assert.deepStrictEqual(groupBySource([]), {});
  });

  it('單一平台僅出現一個鍵', () => {
    const entries = [
      makeEntry({ id: 'aaa00001', source: '104' }),
      makeEntry({ id: 'bbb00001', source: '104' }),
    ];
    const result = groupBySource(entries);
    assert.deepStrictEqual(Object.keys(result), ['104']);
  });
});

// ── Phase 5 — US3: removeFavorite (T014) ────────────────────

describe('removeFavorite', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    process.env.FAVORITES_OUTPUT = makeTmpFavoritesPath();
  });

  afterEach(() => {
    delete process.env.FAVORITES_OUTPUT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('存在的 id 移除後不再出現於 loadFavorites', async () => {
    const entry = makeEntry({ id: 'aaa00001' });
    saveFavorites([entry]);
    await removeFavorite('aaa00001');
    const loaded = loadFavorites();
    assert.strictEqual(loaded.length, 0);
  });

  it('不存在的 id 呼叫不拋錯（冪等）', async () => {
    saveFavorites([]);
    await assert.doesNotReject(() => removeFavorite('xxxxxxxx'));
  });

  it('移除後其他項目不受影響', async () => {
    const e1 = makeEntry({ id: 'aaa00001' });
    const e2 = makeEntry({ id: 'bbb00002' });
    saveFavorites([e1, e2]);
    await removeFavorite('aaa00001');
    const loaded = loadFavorites();
    assert.strictEqual(loaded.length, 1);
    assert.strictEqual(loaded[0].id, 'bbb00002');
  });
});

// ── Phase 6 — US4: getFavoriteIds advanced (T017) ───────────

describe('getFavoriteIds advanced', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fav-test-'));
    process.env.FAVORITES_OUTPUT = makeTmpFavoritesPath();
  });

  afterEach(() => {
    delete process.env.FAVORITES_OUTPUT;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('多筆收藏後 Set 包含所有 id', () => {
    const e1 = makeEntry({ id: 'aaa00001' });
    const e2 = makeEntry({ id: 'bbb00002' });
    saveFavorites([e1, e2]);
    const ids = getFavoriteIds();
    assert.ok(ids.has('aaa00001'));
    assert.ok(ids.has('bbb00002'));
    assert.strictEqual(ids.size, 2);
  });

  it('移除後 Set 不含該 id', async () => {
    const entry = makeEntry({ id: 'aaa00001' });
    saveFavorites([entry]);
    await removeFavorite('aaa00001');
    const ids = getFavoriteIds();
    assert.ok(!ids.has('aaa00001'));
  });
});
