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

/** Same per-platform retention for the hub's own copy of account and video statistics. Ranking
 * history snapshots (rank_history) are PCI's derived positions and are kept permanently. */
export async function runHubRetention(env: NodeJS.ProcessEnv = process.env): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const platform of ['youtube', 'instagram'] as const) {
    const days = retentionDays(platform, env);
    const r = await query(`DELETE FROM ingest_observations WHERE entity_kind IN ('account','content')
      AND entity_id LIKE $1 AND observed_at < now() - make_interval(days => $2)`, [`${platform}:%`, days]);
    out[platform] = r.rowCount ?? 0;
  }
  // Google Maps Platform terms allow only short-term caching of place details: keep 30 days of readings.
  const places = await query(`DELETE FROM ingest_observations WHERE entity_kind='place' AND observed_at < now() - interval '30 days'`);
  out.places = places.rowCount ?? 0;
  return out;
}
