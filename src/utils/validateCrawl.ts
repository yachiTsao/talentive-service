import type { CrawlerOptions } from '../crawler';
import { KNOWN_PROVIDERS } from '../crawler';

type Success = { ok: true; opts: Partial<CrawlerOptions> };
type Failure = { ok: false; status: 400; error: string };
export type CrawlValidationResult = Success | Failure;

export function validateCrawlInput(raw: Record<string, unknown>): CrawlValidationResult {
  const keyword = typeof raw.keyword === 'string' ? raw.keyword.trim() : undefined;
  if (keyword !== undefined && (keyword.length === 0 || keyword.length > 100)) {
    return { ok: false, status: 400, error: 'keyword 長度須介於 1–100 字元' };
  }

  const pages = raw.pages !== undefined ? Number(raw.pages) : undefined;
  if (pages !== undefined && (!Number.isInteger(pages) || pages < 1 || pages > 10)) {
    return { ok: false, status: 400, error: 'pages 須為 1–10 的整數' };
  }

  const delay = raw.delay !== undefined ? Number(raw.delay) : undefined;
  if (delay !== undefined && (isNaN(delay) || delay < 500)) {
    return { ok: false, status: 400, error: 'delay 最小值為 500ms' };
  }

  let providers: string[] | undefined;
  if (typeof raw.providers === 'string') {
    providers = raw.providers.split(',').map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(raw.providers)) {
    providers = (raw.providers as unknown[]).map(String);
  }
  if (providers !== undefined) {
    const unknown = providers.filter((p) => !KNOWN_PROVIDERS.has(p));
    if (unknown.length > 0) {
      return { ok: false, status: 400, error: `未知 provider: ${unknown.join(', ')}` };
    }
  }

  return {
    ok: true,
    opts: { keyword, pages, delay, providers, debug: raw.debug === true },
  };
}
