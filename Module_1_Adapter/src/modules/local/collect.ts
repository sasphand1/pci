import { query } from '../../lib/db.js';
import { logger } from '../../lib/errors.js';
import { CITIES, CITY_SLUGS, TOP_N, searchPlan, topPlaces, type Candidate } from './rules.mjs';

export type LocalResult = { status: 'done' | 'skipped'; reason?: string; requests: number; found: number; kept: number };
type Place = Candidate & { address: string | null; area: string; mapsUrl: string | null };
type Searcher = (text: string) => Promise<unknown[]>;

const FIELDS = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.googleMapsUri,places.businessStatus';

/** One Google Places (New) text search. Asks only for the fields we show, to keep the cost down. */
function googleSearcher(key: string): Searcher {
  return async (text) => {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify({ textQuery: text, includedType: 'restaurant', strictTypeFiltering: true, pageSize: 20, languageCode: 'en', regionCode: 'PK' }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`google_places_${r.status}`);
    const b = (await r.json()) as { places?: unknown[] };
    return b.places ?? [];
  };
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 300) : null);
function toPlace(raw: any, area: string): Place | null {
  const id = str(raw?.id), name = str(raw?.displayName?.text);
  if (!id || !name) return null;
  return { id, name, rating: typeof raw.rating === 'number' ? raw.rating : NaN, reviews: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : NaN,
    status: str(raw.businessStatus) ?? undefined, address: str(raw.formattedAddress), area, mapsUrl: str(raw.googleMapsUri) };
}

/** Weekly collection of restaurants for Karachi, Lahore and Islamabad. Stops at the request budget and never blanks old data on failure. */
export async function collectLocalPlaces(opts: { maxRequests?: number; searcher?: Searcher } = {}): Promise<LocalResult> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!opts.searcher && !key) return { status: 'skipped', reason: 'no_api_key', requests: 0, found: 0, kept: 0 };
  const recent = await query("SELECT 1 FROM local_place_runs WHERE started_at > now() - interval '6 hours' AND result IN ('running','done') LIMIT 1");
  if (recent.rows[0]) return { status: 'skipped', reason: 'ran_recently', requests: 0, found: 0, kept: 0 };
  const envMax = Number(process.env.PCI_PLACES_MAX_REQUESTS);
  const max = Math.min(60, Math.max(1, Math.trunc(opts.maxRequests ?? (Number.isFinite(envMax) && envMax > 0 ? envMax : 30))));
  const search = opts.searcher ?? googleSearcher(key as string);
  const run = await query<{ id: string }>("INSERT INTO local_place_runs DEFAULT VALUES RETURNING id");
  const runId = run.rows[0].id;
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
        await query(`INSERT INTO local_places (place_id,city,name,address,area,rating,review_count,score,maps_url,business_status,observed_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
          ON CONFLICT (place_id) DO UPDATE SET city=EXCLUDED.city,name=EXCLUDED.name,address=EXCLUDED.address,area=EXCLUDED.area,rating=EXCLUDED.rating,
            review_count=EXCLUDED.review_count,score=EXCLUDED.score,maps_url=EXCLUDED.maps_url,business_status=EXCLUDED.business_status,observed_at=now()`,
          [p.id, city, p.name, p.address, p.area, p.rating, p.reviews, p.score, p.mapsUrl, p.status ?? null]);
        kept++;
      }
    }
    await query('UPDATE local_place_runs SET finished_at=now(),requests=$2,found=$3,kept=$4,result=$5 WHERE id=$1', [runId, requests, found, kept, failed && !kept ? 'failed' : 'done']);
    return { status: 'done', requests, found, kept };
  } catch (err) {
    await query("UPDATE local_place_runs SET finished_at=now(),requests=$2,found=$3,kept=$4,result='failed' WHERE id=$1", [runId, requests, found, kept]).catch(() => undefined);
    throw err;
  }
}
export { CITIES, TOP_N };
