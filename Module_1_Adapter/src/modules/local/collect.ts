import { query } from '../../lib/db.js';
import { logger } from '../../lib/errors.js';
import { CITIES, CITY_SLUGS, TOP_N, placeScore, searchPlan, topPlaces } from './rules.mjs';
import { googleSearcher, placeDetails, toPlace, type Place, type Searcher } from './google.js';
import { recordObservation } from '../ingest/store.js';
import { reportSourceResult } from '../ingest/monitor.js';

export type LocalResult = { status: 'done' | 'skipped'; reason?: string; requests: number; found: number; kept: number };

/** Weekly collection of restaurants for Karachi, Lahore and Islamabad. Stops at the request budget and never blanks old data on failure. */
export async function collectLocalPlaces(opts: { maxRequests?: number; searcher?: Searcher } = {}): Promise<LocalResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!opts.searcher && !key) return { status: 'skipped', reason: 'no_api_key', requests: 0, found: 0, kept: 0 };
  const recent = await query("SELECT 1 FROM local_place_runs WHERE started_at > now() - interval '6 hours' AND result IN ('running','done') LIMIT 1");
  if (recent.rows[0]) return { status: 'skipped', reason: 'ran_recently', requests: 0, found: 0, kept: 0 };
  const envMax = Number(process.env.PCI_PLACES_MAX_REQUESTS);
  const max = Math.min(60, Math.max(1, Math.trunc(opts.maxRequests ?? (Number.isFinite(envMax) && envMax > 0 ? envMax : 30))));
  const search: Searcher = opts.searcher ?? googleSearcher(key as string);
  const run = await query<{ id: string }>("INSERT INTO local_place_runs DEFAULT VALUES RETURNING id");
  const runId = run.rows[0].id;
  const hubRun = `places:${runId}`;
  let requests = 0, found = 0, kept = 0, failed = 0;
  const byCity = new Map<string, Place[]>(CITY_SLUGS.map(c => [c, []]));
  try {
    for (const step of searchPlan(max)) {
      requests++;
      try {
        const raw = await search(step.text);
        for (const x of raw) { const p = toPlace(x, step.area); if (p) { byCity.get(step.city)!.push(p); found++; } }
      } catch (err) {
        failed++;
        logger.warn({ err, city: step.city, area: step.area }, 'Local places search failed');
        if (String((err as Error).message).match(/_(401|403|429)$/)) break; // key, billing or quota problem: stop spending
      }
    }
    for (const [city, list] of byCity) {
      for (const p of topPlaces(list, 60)) { // keep a deeper pool than 20 so ranks stay stable between weeks
        await saveLocalPlace(city, p, hubRun);
        kept++;
      }
    }
    // Hand-picked restaurants are refreshed by id (their rating can be below the automatic list's minimum on purpose).
    if (key && !opts.searcher) {
      const picks = await query<{ place_id: string; city: string }>("SELECT place_id,city FROM local_place_overrides WHERE mode='pick' ORDER BY created_at LIMIT 20");
      for (const pk of picks.rows) {
        requests++;
        try {
          const p = toPlace(await placeDetails(key, pk.place_id), '');
          if (p && Number.isFinite(p.rating) && Number.isFinite(p.reviews)) { await saveLocalPlace(pk.city, p, hubRun); kept++; }
        } catch (err) { failed++; logger.warn({ err, placeId: pk.place_id }, 'Pick refresh failed'); if (String((err as Error).message).match(/_(401|403|429)$/)) break; }
      }
    }
    await query('UPDATE local_place_runs SET finished_at=now(),requests=$2,found=$3,kept=$4,result=$5 WHERE id=$1', [runId, requests, found, kept, failed && !kept ? 'failed' : 'done']);
    if (!opts.searcher) {
      if (kept) await query("UPDATE ingest_sources SET enabled=true WHERE id='google_places.api' AND NOT enabled").catch(() => undefined);
      await reportSourceResult('google_places.api', kept > 0, kept ? undefined : 'UNAVAILABLE');
    }
    return { status: 'done', requests, found, kept };
  } catch (err) {
    await query("UPDATE local_place_runs SET finished_at=now(),requests=$2,found=$3,kept=$4,result='failed' WHERE id=$1", [runId, requests, found, kept]).catch(() => undefined);
    throw err;
  }
}

/** Stores one place with its score and the time it was seen. Existing rows are updated, never duplicated.
 * Every reading also goes into the hub (rating, reviews, score), so restaurants share one store with creators;
 * local_places is the ranked list built from those readings. */
export async function saveLocalPlace(city: string, p: Place, hubRun = `places:manual:${Date.now()}`): Promise<void> {
  const score = placeScore(p.rating, p.reviews);
  if (score === null) return;
  const observedAt = new Date().toISOString(), entityId = `google_places:${p.id}`;
  const meta = { city, name: p.name.slice(0, 200), area: p.area || null };
  for (const [metric, value, scale] of [['rating', Math.round(p.rating * 10), 1], ['reviews', p.reviews, 0], ['score', Math.round(score * 1000), 3]] as const) {
    if (!Number.isSafeInteger(value) || value < 0) continue;
    await recordObservation({ sourceId: 'google_places.api', sourceRunRef: hubRun, accountId: null, entityKind: 'place', entityId, metric,
      valueNumeric: value, valueScale: scale, valueText: null, accuracy: 'exact', observedAt, metadata: meta })
      .catch(err => logger.warn({ err, placeId: p.id }, 'Hub place reading not stored'));
  }
  await query(`INSERT INTO local_places (place_id,city,name,address,area,rating,review_count,score,maps_url,business_status,observed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
    ON CONFLICT (place_id) DO UPDATE SET city=EXCLUDED.city,name=EXCLUDED.name,address=EXCLUDED.address,area=COALESCE(NULLIF(EXCLUDED.area,''),local_places.area),rating=EXCLUDED.rating,
      review_count=EXCLUDED.review_count,score=EXCLUDED.score,maps_url=EXCLUDED.maps_url,business_status=EXCLUDED.business_status,observed_at=now()`,
    [p.id, city, p.name, p.address, p.area || null, p.rating, p.reviews, score, p.mapsUrl, p.status ?? null]);
}
export { CITIES, TOP_N };
