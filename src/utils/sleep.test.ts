import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sleep } from './sleep';

describe('sleep', () => {
  it('在指定毫秒後 resolve', async () => {
    const start = Date.now();
    await sleep(50);
    assert.ok(Date.now() - start >= 45, '應至少等待 45ms');
  });

  it('回傳值為 undefined', async () => {
    const result = await sleep(1);
    assert.strictEqual(result, undefined);
  });

  it('delay=0 也能正常 resolve', async () => {
    await assert.doesNotReject(sleep(0));
  });
});
