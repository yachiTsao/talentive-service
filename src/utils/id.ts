import crypto from 'crypto';

// 回傳 SHA-256(url) 的前 8 碼十六進位（FR-002）
export function generateId(url: string): string {
  return crypto.createHash('sha256').update(url, 'utf8').digest('hex').slice(0, 8);
}

// Validate that an id is exactly 8 lowercase hex characters (FR-006)
export function isValidJobId(id: string): boolean {
  return /^[0-9a-f]{8}$/.test(id);
}
