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
  const scrappaDays=90;
  const scrappa=await query(`DELETE FROM ingest_observations WHERE source_id='scrappa.api' AND observed_at<now()-make_interval(days => $1)`,[scrappaDays]);
  out.scrappa=scrappa.rowCount??0;
  await query(`DELETE FROM ingest_latest WHERE source_id='scrappa.api' AND observed_at<now()-make_interval(days => $1)`,[scrappaDays]);
  if((await query("SELECT to_regclass('public.scrappa_snapshots') AS table_name")).rows[0]?.table_name)await query('DELETE FROM scrappa_snapshots WHERE observed_at<now()-make_interval(days => $1)',[scrappaDays]);
  // Google Maps Platform terms allow only short-term caching of place details: keep 30 days of readings.
  const places = await query(`DELETE FROM ingest_observations WHERE entity_kind='place' AND observed_at < now() - interval '30 days'`);
  out.places = places.rowCount ?? 0;
  // Satellite sub-bucket: hourly city readings grow fast; keep PCI_RETENTION_DAYS_SATELLITE (default 90).
  const raw = Number(env.PCI_RETENTION_DAYS_SATELLITE ?? 90);
  const satDays = Number.isInteger(raw) && raw >= 7 && raw <= 3650 ? raw : 90;
  const sat = await query(`DELETE FROM ingest_observations WHERE source_id LIKE 'sat\\_%' AND observed_at < now() - make_interval(days => $1)`, [satDays]);
  out.satellite = sat.rowCount ?? 0;
  const detail = await query(`DELETE FROM satellite.observations WHERE metric IN ('air_quality','weather','aq_station','orbit','space_weather','river_flow') AND observed_at < now() - make_interval(days => $1)`, [satDays]).catch(() => ({ rowCount: 0 }));
  out.satelliteDetail = detail.rowCount ?? 0;
  return out;
}
