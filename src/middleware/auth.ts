import { Request, Response, NextFunction } from 'express';

export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const apiKey = process.env.API_KEY;
  if (!apiKey || req.headers['x-api-key'] === apiKey) {
    next();
    return;
  }
  res.status(401).json({ ok: false, error: '未授權' });
}
