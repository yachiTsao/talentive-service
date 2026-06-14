import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCrawlInput } from './validateCrawl';

describe('validateCrawlInput', () => {
  // ── keyword ─────────────────────────────────────────────────
  describe('keyword', () => {
    it('未傳 keyword 時 opts.keyword 為 undefined', () => {
      const r = validateCrawlInput({});
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.keyword, undefined);
    });

    it('合法 keyword 正確 trim 空白', () => {
      const r = validateCrawlInput({ keyword: '  前端工程師  ' });
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.keyword, '前端工程師');
    });

    it('空字串回傳 400', () => {
      const r = validateCrawlInput({ keyword: '' });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });

    it('trim 後為空字串回傳 400', () => {
      const r = validateCrawlInput({ keyword: '   ' });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });

    it('100 字元通過', () => {
      const r = validateCrawlInput({ keyword: 'a'.repeat(100) });
      assert.ok(r.ok);
    });

    it('101 字元回傳 400', () => {
      const r = validateCrawlInput({ keyword: 'a'.repeat(101) });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });
  });

  // ── pages ────────────────────────────────────────────────────
  describe('pages', () => {
    it('未傳 pages 時 opts.pages 為 undefined', () => {
      const r = validateCrawlInput({});
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.pages, undefined);
    });

    it('pages=1 通過', () => {
      assert.ok(validateCrawlInput({ pages: 1 }).ok);
    });

    it('pages=10 通過', () => {
      assert.ok(validateCrawlInput({ pages: 10 }).ok);
    });

    it('pages=0 回傳 400', () => {
      const r = validateCrawlInput({ pages: 0 });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });

    it('pages=11 回傳 400', () => {
      const r = validateCrawlInput({ pages: 11 });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });

    it('pages=1.5（非整數）回傳 400', () => {
      const r = validateCrawlInput({ pages: 1.5 });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });

    it('pages=-1 回傳 400', () => {
      const r = validateCrawlInput({ pages: -1 });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });
  });

  // ── delay ────────────────────────────────────────────────────
  describe('delay', () => {
    it('未傳 delay 時 opts.delay 為 undefined', () => {
      const r = validateCrawlInput({});
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.delay, undefined);
    });

    it('delay=500 通過', () => {
      assert.ok(validateCrawlInput({ delay: 500 }).ok);
    });

    it('delay=499 回傳 400', () => {
      const r = validateCrawlInput({ delay: 499 });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });

    it('delay=0 回傳 400', () => {
      const r = validateCrawlInput({ delay: 0 });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });
  });

  // ── providers ────────────────────────────────────────────────
  describe('providers', () => {
    it('未傳 providers 時 opts.providers 為 undefined', () => {
      const r = validateCrawlInput({});
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.providers, undefined);
    });

    it('陣列格式的合法 providers 通過', () => {
      const r = validateCrawlInput({ providers: ['104', 'yourator', '1111'] });
      assert.ok(r.ok);
      if (r.ok) assert.deepStrictEqual(r.opts.providers, ['104', 'yourator', '1111']);
    });

    it('逗號分隔字串正確解析', () => {
      const r = validateCrawlInput({ providers: '104,yourator' });
      assert.ok(r.ok);
      if (r.ok) assert.deepStrictEqual(r.opts.providers, ['104', 'yourator']);
    });

    it('逗號分隔字串含空白正確 trim', () => {
      const r = validateCrawlInput({ providers: ' 104 , yourator ' });
      assert.ok(r.ok);
      if (r.ok) assert.deepStrictEqual(r.opts.providers, ['104', 'yourator']);
    });

    it('未知 provider 回傳 400', () => {
      const r = validateCrawlInput({ providers: ['104', 'evil'] });
      assert.ok(!r.ok);
      if (!r.ok) {
        assert.strictEqual(r.status, 400);
        assert.ok(r.error.includes('evil'));
      }
    });

    it('全未知的字串 providers 回傳 400', () => {
      const r = validateCrawlInput({ providers: 'fake' });
      assert.ok(!r.ok);
      if (!r.ok) assert.strictEqual(r.status, 400);
    });
  });

  // ── debug ────────────────────────────────────────────────────
  describe('debug', () => {
    it('debug=true 正確傳遞', () => {
      const r = validateCrawlInput({ debug: true });
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.debug, true);
    });

    it('debug=false 正確傳遞', () => {
      const r = validateCrawlInput({ debug: false });
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.debug, false);
    });

    it('debug 非 boolean 時視為 false', () => {
      const r = validateCrawlInput({ debug: 'yes' });
      assert.ok(r.ok);
      if (r.ok) assert.strictEqual(r.opts.debug, false);
    });
  });

  // ── 複合場景 ─────────────────────────────────────────────────
  describe('複合場景', () => {
    it('多個欄位同時合法時全部帶入 opts', () => {
      const r = validateCrawlInput({ keyword: '前端', pages: 2, delay: 1000, providers: ['104'], debug: true });
      assert.ok(r.ok);
      if (r.ok) {
        assert.strictEqual(r.opts.keyword, '前端');
        assert.strictEqual(r.opts.pages, 2);
        assert.strictEqual(r.opts.delay, 1000);
        assert.deepStrictEqual(r.opts.providers, ['104']);
        assert.strictEqual(r.opts.debug, true);
      }
    });

    it('第一個錯誤欄位立即回傳 400，不繼續驗證', () => {
      // keyword 超長 + pages 超界：應只回報 keyword 錯誤
      const r = validateCrawlInput({ keyword: 'a'.repeat(200), pages: 99 });
      assert.ok(!r.ok);
      if (!r.ok) {
        assert.strictEqual(r.status, 400);
        assert.ok(r.error.includes('keyword'));
      }
    });
  });
});
