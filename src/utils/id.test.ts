import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from './id';
import { assignIds } from '../crawler';
import type { JobData } from '../providers/types';

// ── generateId 單元測試（T004）──────────────────────────────────

describe('generateId', () => {
  it('相同 URL 回傳相同結果', () => {
    const url = 'https://www.104.com.tw/job/abc123';
    assert.strictEqual(generateId(url), generateId(url));
  });

  it('長度恆為 8 個字元', () => {
    const id = generateId('https://example.com/job/1');
    assert.strictEqual(id.length, 8);
  });

  it('僅含 [0-9a-f] 字元', () => {
    const id = generateId('https://www.yourator.co/companies/foo/jobs/bar');
    assert.match(id, /^[0-9a-f]{8}$/);
  });

  it('不同 URL 產生不同 id（基本相異性）', () => {
    const id1 = generateId('https://www.104.com.tw/job/aaa');
    const id2 = generateId('https://www.104.com.tw/job/bbb');
    assert.notStrictEqual(id1, id2);
  });

  it('空字串 URL 也能執行而不崩潰，回傳 8 碼', () => {
    const id = generateId('');
    assert.strictEqual(id.length, 8);
    assert.match(id, /^[0-9a-f]{8}$/);
  });
});

// ── assignIds 單元測試（T005）──────────────────────────────────

function makeJob(url: string, overrides?: Partial<JobData>): JobData {
  return {
    title: 'Test Engineer',
    company: 'Test Co',
    location: '台北市',
    salary: '面議',
    url,
    page: 1,
    source: '104',
    ...overrides,
  };
}

describe('assignIds', () => {
  it('每筆 job 均獲得非空 id', () => {
    const jobs = [makeJob('https://a.com/1'), makeJob('https://b.com/2')];
    const result = assignIds(jobs);
    assert.strictEqual(result.length, 2);
    for (const j of result) {
      assert.ok(j.id && j.id.length === 8, `id 應為 8 碼但得到: ${j.id}`);
    }
  });

  it('所有 id 互不重複（正常情況）', () => {
    const jobs = [
      makeJob('https://a.com/1'),
      makeJob('https://b.com/2'),
      makeJob('https://c.com/3'),
    ];
    const result = assignIds(jobs);
    const ids = result.map((j) => j.id);
    assert.strictEqual(new Set(ids).size, ids.length);
  });

  it('相同 URL 的重複 job 透過 dedupeByUrl 已去除；但 assignIds 本身以 id 偵測碰撞', () => {
    // 兩筆完全相同 URL → 相同 id → 後者捨棄
    const jobs = [makeJob('https://dup.com/1'), makeJob('https://dup.com/1')];
    const result = assignIds(jobs);
    assert.strictEqual(result.length, 1);
  });

  it('碰撞時發出 console.warn 並捨棄後出現者', () => {
    // 製造碰撞：我們直接驗證行為（捨棄後者）而非強迫碰撞發生
    // 使用相同 URL → 相同 id → 碰撞場景
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => warnings.push(args.join(' '));

    try {
      const collisionUrl = 'https://collision.example.com/job/test';
      const jobs = [makeJob(collisionUrl), makeJob(collisionUrl)];
      const result = assignIds(jobs);
      assert.strictEqual(result.length, 1);
      assert.ok(
        warnings.some((w) => w.includes('[ID COLLISION]')),
        `應發出 [ID COLLISION] 警告，實際得到: ${warnings.join(', ')}`
      );
    } finally {
      console.warn = origWarn;
    }
  });

  it('保留原始 job 各欄位，僅新增 id', () => {
    const job = makeJob('https://x.com/job/99');
    const [result] = assignIds([job]);
    assert.strictEqual(result.title, job.title);
    assert.strictEqual(result.company, job.company);
    assert.strictEqual(result.url, job.url);
    assert.ok(result.id && result.id.length === 8);
  });
});
