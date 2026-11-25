import { Router } from 'express';
import { z } from 'zod';
import { query, transaction } from '../../lib/db.js';
import { isDeleted, lockPlace, purgePlace } from './place-lifecycle.js';
import { handler, HttpError } from '../../lib/errors.js';
import { boundedLimit } from '../../lib/redis.js';
import { requireAdmin, roles, type AdminIdentity } from '../auth/auth.js';
import { CITY_SLUGS, MAX_AGE_DAYS, isPlaceId } from './rules.mjs';
import { googleSearcher, placeDetails, searchPhrase, toPlace } from './google.js';
import { saveLocalPlace } from './collect.js';

/** Admin tools for the restaurant lists: find a place from a name or Google Maps link, pin it as a pick, hide it, or remove the override. */
export const localAdminRoutes = Router();
localAdminRoutes.use(requireAdmin, roles('owner', 'editor'));
const actor = (res: { locals: Record<string, unknown> }) => (res.locals.admin as AdminIdentity | undefined)?.id ?? null;
const cityEnum = z.enum(CITY_SLUGS as [string, ...string[]]);
function key(): string { const k = process.env.GOOGLE_PLACES_API_KEY; if (!k) throw new HttpError(503, 'LOCAL_NO_KEY', 'GOOGLE_PLACES_API_KEY is not set on Module 1.'); return k; }
async function budget(name: string, max: number) {
  try { if (!(await boundedLimit(`local:${name}`, max, 86400))) throw new HttpError(429, 'LOCAL_DAILY_LIMIT', 'Daily lookup limit reached. Try again tomorrow.'); }
  catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(503, 'LOCAL_LIMITER_UNAVAILABLE', 'Lookup limiter unavailable.'); }
}

localAdminRoutes.get('/status', handler(async (_req, res) => {
  const [overrides, runs, counts] = await Promise.all([
    query(`SELECT o.place_id,o.city,o.mode,o.note,o.name,o.created_at,p.rating::text,p.review_count,p.observed_at,p.maps_url
           FROM local_place_overrides o LEFT JOIN local_places p ON p.place_id=o.place_id ORDER BY o.city,o.mode,o.name`),
    query('SELECT started_at,finished_at,requests,found,kept,result FROM local_place_runs ORDER BY started_at DESC LIMIT 5'),
    query(`SELECT city,count(*)::int AS places,count(*) FILTER (WHERE observed_at > now() - ($1 || ' days')::interval)::int AS fresh,max(observed_at) AS newest FROM local_places GROUP BY city`, [String(MAX_AGE_DAYS)]),
  ]);
  res.json({ data: {
    keyConfigured: Boolean(process.env.GOOGLE_PLACES_API_KEY),
    autofill: process.env.PCI_LOCAL_PLACES_AUTOFILL === 'true',
    overrides: overrides.rows.map((r: any) => ({ placeId: r.place_id, city: r.city, mode: r.mode, note: r.note, name: r.name, addedAt: r.created_at,
      rating: r.rating === null ? null : Number(r.rating), reviewCount: r.review_count, asOf: r.observed_at, mapsUrl: r.maps_url })),
    runs: runs.rows.map((r: any) => ({ startedAt: r.started_at, finishedAt: r.finished_at, requests: r.requests, found: r.found, kept: r.kept, result: r.result })),
    cities: counts.rows.map((r: any) => ({ city: r.city, places: r.places, fresh: r.fresh, newest: r.newest })),
  } });
}));

/** Search by restaurant name or by a pasted Google Maps link. Returns up to 5 candidates for the admin to confirm. */
localAdminRoutes.post('/search', handler(async (req, res) => {
  const b = z.object({ input: z.string().trim().min(2).max(500), city: cityEnum }).strict().parse(req.body ?? {});
  const k = key();
  await budget('search', 60);
  let phrase: string;
  try { phrase = await searchPhrase(b.input); }
  catch (e) {
    const m = (e as Error).message;
    throw new HttpError(422, 'LOCAL_BAD_LINK', m === 'not_a_maps_link' ? 'Only Google Maps links can be pasted here.' : 'Could not read a restaurant name from that link. Type the name instead.');
  }
  const city = b.city[0].toUpperCase() + b.city.slice(1);
  const raw = await googleSearcher(k, 5)(`${phrase}, ${city}, Pakistan`).catch((e: Error) => { throw new HttpError(502, 'LOCAL_GOOGLE_FAILED', `Google lookup failed (${e.message}).`); });
  const data = raw.map(x => toPlace(x, '')).filter(Boolean).map(p => ({ placeId: p!.id, name: p!.name, address: p!.address,
    rating: Number.isFinite(p!.rating) ? p!.rating : null, reviewCount: Number.isFinite(p!.reviews) ? p!.reviews : null, mapsUrl: p!.mapsUrl }));
  res.json({ data: { phrase, candidates: data } });
}));

/** Save a pick or hide. The place is re-read from Google by id, so nothing the browser sends is trusted for ratings. */
localAdminRoutes.post('/places', handler(async (req, res) => {
  const b = z.object({ placeId: z.string().refine(isPlaceId, 'Invalid place id'), city: cityEnum, mode: z.enum(['pick', 'hide']), note: z.string().trim().max(200).optional() }).strict().parse(req.body ?? {});
  const k = key();
  await budget('details', 60);
  const raw = await placeDetails(k, b.placeId).catch((e: Error) => { throw new HttpError(502, 'LOCAL_GOOGLE_FAILED', `Google lookup failed (${e.message}).`); });
  const p = toPlace(raw, '');
  if (!p) throw new HttpError(404, 'LOCAL_NOT_FOUND', 'Google has no place with that id.');
  if (Number.isFinite(p.rating) && Number.isFinite(p.reviews)) await saveLocalPlace(b.city, p);
  await transaction(async tx=>{await lockPlace(tx,b.placeId);
  if(await isDeleted(tx,b.placeId))throw new HttpError(409,'LOCAL_DELETED','This restaurant was permanently deleted.');
  await tx.query(`INSERT INTO local_place_overrides (place_id,city,mode,note,name,added_by) VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT (place_id) DO UPDATE SET city=EXCLUDED.city,mode=EXCLUDED.mode,note=EXCLUDED.note,name=EXCLUDED.name`,
    [b.placeId, b.city, b.mode, b.note || null, p.name, actor(res)]);});
  res.status(201).json({ data: { placeId: b.placeId, name: p.name, mode: b.mode, hasRating: Number.isFinite(p.rating) } });
}));

localAdminRoutes.delete('/purge/:placeId', roles('owner'),handler(async(req,res)=>{
  const id=String(req.params.placeId);if(!isPlaceId(id))throw new HttpError(400,'LOCAL_BAD_ID','Invalid place id');
  z.object({confirmation:z.literal('DELETE')}).strict().parse(req.body??{});
  await purgePlace(id);res.json({data:{deleted:true}});
}));

localAdminRoutes.delete('/places/:placeId', handler(async (req, res) => {
  const id = String(req.params.placeId);
  if (!isPlaceId(id)) throw new HttpError(400, 'LOCAL_BAD_ID', 'Invalid place id');
  await query('DELETE FROM local_place_overrides WHERE place_id=$1', [id]);
  res.json({ data: { removed: true } });
}));
