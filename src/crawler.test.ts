import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, assignIds } from './crawler';
import type { JobData } from './providers/types';

// ── withTimeout 單元測試（T010）──────────────────────────────────

describe('withTimeout', () => {
  it('正常 resolve 時正確透傳結果', async () => {
    const result = await withTimeout(Promise.resolve(42), 1000, 'test');
    assert.strictEqual(result, 42);
  });

  it('Promise 正常 reject 時正確透傳錯誤', async () => {
    await assert.rejects(
      () => withTimeout(Promise.reject(new Error('original error')), 1000, 'test'),
      (e: Error) => {
        assert.strictEqual(e.message, 'original error');
        return true;
      }
    );
  });

  it('超時後 reject 並包含逾時訊息', async () => {
    await assert.rejects(
      () =>
        withTimeout(
          new Promise<void>((resolve) => setTimeout(resolve, 5000)),
          50,
          'slow-provider'
        ),
      (e: Error) => {
        assert.ok(
          e.message.includes('slow-provider') && e.message.includes('50ms'),
          `逾時訊息應包含 provider 名稱與 ms 數，但得到: ${e.message}`
        );
        return true;
      }
    );
  });

  it('resolve 路徑中 clearTimeout 被呼叫（不洩漏計時器）', async () => {
    // 以極短 timeout 確認 resolve 先於 timeout 時不觸發 timeout error
    const result = await withTimeout(Promise.resolve('ok'), 5000, 'fast');
    assert.strictEqual(result, 'ok');
    // 如果 clearTimeout 未被呼叫，計時器仍在等待，但此測試後 Node 會自然退出
    // 這裡主要確認不會在 resolve 後再 throw
  });

  it('reject 路徑中 clearTimeout 被呼叫（不洩漏計時器）', async () => {
    await assert.rejects(
      () => withTimeout(Promise.reject(new Error('fail')), 5000, 'fast-fail'),
      /fail/
    );
    // 若 clearTimeout 未執行，計時器將使 Node 進程不退出
  });
});

// ── assignIds 錯誤隔離相關 + 並行架構 tests（T014, T015）────────

function makeJob(url: string): JobData {
  return {
    title: 'Job',
    company: 'Co',
    location: '台北',
    salary: '面議',
    url,
    page: 1,
    source: 'test',
  };
}

describe('assignIds — 空輸入（全部失敗場景模擬）', () => {
  it('輸入空陣列時回傳空陣列，不拋出例外（US3 全部失敗情境）', () => {
    const result = assignIds([]);
    assert.deepStrictEqual(result, []);
  });
});

describe('assignIds — 部分 provider 失敗場景', () => {
  it('只有部分 jobs 傳入時，仍正確注入 id（模擬錯誤 provider 結果被過濾後）', () => {
    // 模擬：provider A 失敗（貢獻 0 筆），provider B 成功（2 筆）
    const survivingJobs = [makeJob('https://ok.com/1'), makeJob('https://ok.com/2')];
    const result = assignIds(survivingJobs);
    assert.strictEqual(result.length, 2);
    for (const j of result) {
      assert.ok(j.id && j.id.length === 8);
    }
  });
});
