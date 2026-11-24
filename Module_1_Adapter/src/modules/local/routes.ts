import { Router } from 'express';
import { query } from '../../lib/db.js';
import { handler } from '../../lib/errors.js';
import { CITIES, CITY_SLUGS, MAX_AGE_DAYS, MIN_REVIEWS, TOP_N, parseCity } from './rules.mjs';

/** Public, read-only Top 20 restaurants per city. Entries older than the allowed age are hidden, never shown with an invented figure. */
export const publicLocalRoutes = Router();
publicLocalRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600'); next(); });

type Row = { place_id: string; name: string; address: string | null; area: string | null; rating: string; review_count: number; maps_url: string | null; observed_at: Date; note?: string | null };
const shape = (x: Row, rank: number | null) => ({ rank, placeId: x.place_id, name: x.name, area: x.area, address: x.address, rating: Number(x.rating), reviewCount: x.review_count,
  mapsUrl: x.maps_url, asOf: x.observed_at.toISOString(), note: x.note ?? null });
async function top(city: string) {
  const r = await query<Row>(`SELECT p.place_id,p.name,p.address,p.area,p.rating::text,p.review_count,p.maps_url,p.observed_at FROM local_places p
    WHERE p.city=$1 AND p.observed_at > now() - ($2 || ' days')::interval AND p.review_count >= $4
      AND NOT EXISTS (SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='hide')
    ORDER BY p.score DESC, p.review_count DESC, p.name LIMIT $3`, [city, String(MAX_AGE_DAYS), TOP_N, MIN_REVIEWS]);
  return r.rows.map((x, i) => shape(x, i + 1));
}
/** Hand-picked places: shown in their own row and never counted in the numbered ranking. */
async function picks(city: string) {
  const r = await query<Row>(`SELECT p.place_id,p.name,p.address,p.area,p.rating::text,p.review_count,p.maps_url,p.observed_at,o.note FROM local_place_overrides o
    JOIN local_places p ON p.place_id=o.place_id WHERE o.city=$1 AND o.mode='pick' AND p.observed_at > now() - ($2 || ' days')::interval ORDER BY o.created_at`, [city, String(MAX_AGE_DAYS)]);
  return r.rows.map(x => shape(x, null));
}

publicLocalRoutes.get('/', handler(async (req, res) => {
  const one = parseCity(req.query.city);
  const slugs = one ? [one] : CITY_SLUGS;
  const cities = await Promise.all(slugs.map(async s => ({ slug: s, label: CITIES[s].label, places: await top(s), picks: await picks(s) })));
  res.json({ data: cities, attribution: 'Ratings and review counts from Google Maps', method: 'Bayesian average of rating and review count, minimum 50 reviews' });
}));
