import { Router, Request, Response } from 'express';
import { isValidJobId } from '../utils/id';
import {
  addFavorite,
  removeFavorite,
  loadFavorites,
  groupBySource,
  AppError,
} from './store';

const router = Router();

// ── POST /favorites/:id — US1 ────────────────────────────────
router.post('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidJobId(id)) {
    return res.status(400).json({ ok: false, error: 'id 格式不合法，須為 8 碼十六進位字串（[0-9a-f]{8}）' });
  }
  try {
    const entry = await addFavorite(id);
    return res.status(201).json({ ok: true, data: entry });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    return res.status(500).json({ ok: false, error: '伺服器錯誤' });
  }
});

// ── DELETE /favorites/:id — US3 ──────────────────────────────
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!isValidJobId(id)) {
    return res.status(400).json({ ok: false, error: 'id 格式不合法，須為 8 碼十六進位字串（[0-9a-f]{8}）' });
  }
  try {
    await removeFavorite(id);
    return res.status(200).json({ ok: true });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    return res.status(500).json({ ok: false, error: '伺服器錯誤' });
  }
});

// ── GET /favorites — US2 ─────────────────────────────────────
router.get('/', (_req: Request, res: Response) => {
  try {
    const entries = loadFavorites();
    const data = groupBySource(entries);
    return res.status(200).json({ ok: true, data });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ ok: false, error: err.message });
    }
    return res.status(500).json({ ok: false, error: '伺服器錯誤' });
  }
});

export default router;
