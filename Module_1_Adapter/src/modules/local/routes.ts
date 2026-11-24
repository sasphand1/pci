import { Router } from 'express';
import { query } from '../../lib/db.js';
import { handler } from '../../lib/errors.js';
import { CITIES, CITY_SLUGS, MAX_AGE_DAYS, TOP_N, parseCity } from './rules.mjs';

/** Public, read-only Top 20 restaurants per city. Entries older than the allowed age are hidden, never shown with an invented figure. */
export const publicLocalRoutes = Router();
publicLocalRoutes.use((_req, res, next) => { res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600'); next(); });

type Row = { place_id: string; city: string; name: string; address: string | null; area: string | null; rating: string; review_count: number; maps_url: string | null; observed_at: Date };
async function top(city: string) {
  const r = await query<Row>(`SELECT place_id,city,name,address,area,rating::text,review_count,maps_url,observed_at FROM local_places
    WHERE city=$1 AND observed_at > now() - ($2 || ' days')::interval ORDER BY score DESC, review_count DESC, name LIMIT $3`, [city, String(MAX_AGE_DAYS), TOP_N]);
  return r.rows.map((x, i) => ({ rank: i + 1, placeId: x.place_id, name: x.name, area: x.area, address: x.address, rating: Number(x.rating), reviewCount: x.review_count,
    mapsUrl: x.maps_url, asOf: x.observed_at.toISOString() }));
}

publicLocalRoutes.get('/', handler(async (req, res) => {
  const one = parseCity(req.query.city);
  const slugs = one ? [one] : CITY_SLUGS;
  const cities = await Promise.all(slugs.map(async s => ({ slug: s, label: CITIES[s].label, places: await top(s) })));
  res.json({ data: cities, attribution: 'Ratings and review counts from Google Maps', method: 'Bayesian average of rating and review count, minimum 50 reviews' });
}));
