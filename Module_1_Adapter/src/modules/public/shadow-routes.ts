import { Router } from 'express';
import { handler } from '../../lib/errors.js';
import { query } from '../../lib/db.js';
import { requireAdmin, roles } from '../auth/auth.js';
import { compareRows } from './shadow.js';

export const shadowAdminRoutes = Router();
shadowAdminRoutes.use('/shadow', requireAdmin);

/** Old YouTube subscriber ranking (legacy tables) next to the published youtube.subscribed ranking. Read-only. */
shadowAdminRoutes.get('/shadow/youtube', roles('owner', 'editor'), handler(async (_req, res) => {
  let legacy;
  try {
    legacy = await query(`SELECT c.channel_id AS key, c.display_name AS name FROM creators c JOIN channel_stats_latest s ON s.creator_id=c.id
      WHERE c.enabled=true AND s.subscriber_hidden IS NOT TRUE AND s.subscriber_count IS NOT NULL ORDER BY s.subscriber_count DESC, c.id LIMIT 100`);
  } catch (e) {
    if ((e as { code?: string }).code === '42P01') return res.json({ data: { available: false, reason: 'The old tables are gone, so there is nothing left to compare with.' } });
    throw e;
  }
  const published = await query(`SELECT a.external_id AS key, p.display_name AS name FROM published_pointers pp JOIN rank_slots s ON s.run_id=pp.run_id
    JOIN people p ON p.id=s.person_id JOIN accounts a ON a.person_id=p.id AND a.platform='youtube' WHERE pp.scope='youtube.subscribed' ORDER BY s.slot LIMIT 100`);
  res.json({ data: { available: true, top15: compareRows(legacy.rows, published.rows, 15), top100: compareRows(legacy.rows, published.rows, 100),
    note: 'Differences are expected when the bucket holds different people than the old list, or when an old number was older than 7 days.' } });
}));
