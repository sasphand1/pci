import { Router } from 'express';
import { query } from '../../lib/db.js';
import { handler, HttpError } from '../../lib/errors.js';

/** Serves the locally stored copy of a profile picture. Public, read-only, image bytes only. */
export const publicAvatarRoutes = Router();
publicAvatarRoutes.get('/:id', handler(async (req, res) => {
  const id = String(req.params.id);
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'NOT_FOUND', 'Not found');
  const r = await query<{ content_type: string; bytes: Buffer }>('SELECT content_type,bytes FROM avatar_cache WHERE account_id=$1', [id]);
  if (!r.rows[0]) throw new HttpError(404, 'NOT_FOUND', 'Not found');
  res.setHeader('Content-Type', r.rows[0].content_type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  res.send(r.rows[0].bytes);
}));
