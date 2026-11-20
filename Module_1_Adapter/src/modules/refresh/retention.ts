import { query } from '../../lib/db.js';
import { retentionDays } from './normalize.js';

/** Deletes observations older than the per-platform retention (default 90 days). Rankings only read
 * the last 7 days, so this never changes a ranking. YouTube API terms may require shorter retention:
 * set PCI_RETENTION_DAYS_YOUTUBE (minimum 8). */
export async function runRetention(env: NodeJS.ProcessEnv = process.env): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const platform of ['youtube', 'instagram'] as const) {
    const days = retentionDays(platform, env);
    const r = await query(`DELETE FROM metric_observations o USING accounts a WHERE a.id=o.account_id AND a.platform=$1 AND o.observed_at < now() - make_interval(days => $2)`, [platform, days]);
    out[platform] = r.rowCount ?? 0;
  }
  return out;
}
