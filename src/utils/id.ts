import crypto from 'crypto';

// SHA-256(url) の最初の8文字を16進数で返す（FR-002）
export function generateId(url: string): string {
  return crypto.createHash('sha256').update(url, 'utf8').digest('hex').slice(0, 8);
}
