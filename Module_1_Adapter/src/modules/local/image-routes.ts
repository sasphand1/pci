import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { query, transaction } from '../../lib/db.js';
import { handler, HttpError } from '../../lib/errors.js';
import { boundedLimit } from '../../lib/redis.js';
import { requireAdmin, roles, type AdminIdentity } from '../auth/auth.js';
import { reportSourceResult } from '../ingest/monitor.js';
import { isPlaceId } from './rules.mjs';
import { collectAuthorizedImage, discoverRestaurantImages } from './image-http.js';
import { MAX_CACHE_BYTES, safeSource } from './image-rules.mjs';
import { fetchGooglePhoto, GooglePhotoError } from './google-photo.js';
import { fillRestaurantHttpPhotos } from './image-autofill.js';
import { discoverGoogleWebsite, publicGooglePhotosEnabled, reserveGooglePhoto, photoWidth } from './photo-policy.js';
import { MAX_AGE_DAYS, MIN_REVIEWS, TOP_N } from './rules.mjs';

const SOURCE='restaurant_images.http';
const idSchema=z.string().refine(isPlaceId,'Invalid place id');
const httpsUrl=z.string().trim().max(2000).refine(v=>Boolean(safeSource(v)),'Use an authorized public HTTPS URL');
const input=z.object({placeId:idSchema,sourceUrl:httpsUrl,permissionUrl:httpsUrl,mode:z.enum(['direct','page']),attribution:z.string().trim().min(2).max(500),licence:z.string().trim().min(2).max(150),confirmed:z.literal(true)}).strict();
async function limit(name:string,n:number){
 try{if(!await boundedLimit(`local:images:${name}`,n,86400))throw new HttpError(429,'IMAGE_LIMIT','Daily image retrieval limit reached.');}
 catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'IMAGE_LIMITER','Image rate limiter unavailable.');}
}
async function place(id:string){const r=await query<{name:string;city:string;area:string|null}>('SELECT name,city,area FROM local_places WHERE place_id=$1',[id]);if(!r.rows[0])throw new HttpError(404,'NOT_FOUND','Restaurant not found');return r.rows[0];}
async function result(ok:boolean){await query('UPDATE ingest_sources SET enabled=true WHERE id=$1',[SOURCE]).catch(()=>undefined);await reportSourceResult(SOURCE,ok,ok?undefined:'UNAVAILABLE');}
type DiscoveryPlace={placeId:string;name:string;city:string;area:string|null};
async function discoverAndRemember(p:DiscoveryPlace,website?:string){
 let hint=website;let lookupFailed=false;const lookupDiagnostics:string[]=[];
 if(!hint&&process.env.PCI_GOOGLE_WEBSITE_DISCOVERY_ENABLED==='true'){
  try{hint=(await discoverGoogleWebsite(p.placeId))??undefined;lookupDiagnostics.push(hint?'Google website hint found; identity and rights require verification.':'No eligible website URL returned.');}
  catch{lookupFailed=true;lookupDiagnostics.push('Google website lookup unavailable or quota reached.');}
 }
 const r=await discoverRestaurantImages(p.name,p.city,p.area,hint);
 r.diagnostics.unshift(...lookupDiagnostics);
 if(lookupFailed&&!r.candidates.length)r.status='failed';
 await query(`INSERT INTO restaurant_image_discovery(place_id,candidates,last_result,last_attempt_at,discovery_version,diagnostics) VALUES($1,$2::jsonb,$3,now(),3,$4::jsonb) ON CONFLICT(place_id) DO UPDATE SET candidates=CASE WHEN EXCLUDED.last_result='failed' THEN restaurant_image_discovery.candidates ELSE EXCLUDED.candidates END,last_result=EXCLUDED.last_result,last_attempt_at=now(),discovery_version=3,diagnostics=EXCLUDED.diagnostics`,[p.placeId,JSON.stringify(r.candidates),r.status,JSON.stringify(r.diagnostics)]);
 return r;
}
export const restaurantImageAdminRoutes=Router();
restaurantImageAdminRoutes.use(requireAdmin,roles('owner','editor'));
// Explicit admin preview, using the same quota as public photo requests. No content cache.
restaurantImageAdminRoutes.post('/google-preview',handler(async(req,res)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');
 if(process.env.PCI_GOOGLE_PHOTO_PREVIEW_ENABLED!=='true')throw new HttpError(409,'GOOGLE_PHOTO_DISABLED','Google photo preview is disabled. Check applicable Google billing terms before enabling.');
 const key=process.env.GOOGLE_PLACES_API_KEY;
 if(!key)throw new HttpError(409,'GOOGLE_PHOTO_KEY_MISSING','Google Places API key is not configured.');
 const {placeId}=z.object({placeId:idSchema}).strict().parse(req.body??{});
 await place(placeId);
 try{
  const data=await fetchGooglePhoto(placeId,key,reserveGooglePhoto,fetch,photoWidth());
  res.json({data});
 }catch(e){if(e instanceof GooglePhotoError)throw new HttpError(e.status,e.code,e.message);throw e;}
}));
restaurantImageAdminRoutes.post('/http-fill',roles('owner','editor'),handler(async(_req,res)=>{
 await limit('http-fill',30);
 const data=await fillRestaurantHttpPhotos({manual:true,limit:1});
 res.json({data});
}));
restaurantImageAdminRoutes.get('/',handler(async(_req,res)=>{
 const r=await query(`SELECT p.place_id AS "placeId",p.name,p.city,p.area,c.source_url AS "sourceUrl",c.permission_url AS "permissionUrl",c.attribution,c.licence,c.size_bytes AS "sizeBytes",c.fetched_at AS "fetchedAt",COALESCE(d.candidates,'[]'::jsonb) AS candidates,d.last_result AS "discoveryStatus",COALESCE(d.diagnostics,'[]'::jsonb) AS diagnostics,s.result AS "httpResult",s.detail AS "httpDetail",s.last_attempt_at AS "httpAttemptAt" FROM local_places p LEFT JOIN restaurant_image_cache c USING(place_id) LEFT JOIN restaurant_image_discovery d ON d.place_id=p.place_id LEFT JOIN restaurant_image_http_state s ON s.place_id=p.place_id ORDER BY p.city,p.score DESC,p.name LIMIT 1000`);
 res.json({data:r.rows});
}));
restaurantImageAdminRoutes.post('/discover',handler(async(req,res)=>{
 const {placeId,website}=z.object({placeId:idSchema,website:httpsUrl.optional()}).strict().parse(req.body??{});const p=await place(placeId);await limit('discover',60);
 const r=await discoverAndRemember({placeId,...p},website);res.json({data:r});
}));
// Bounded batch discovery, prioritizing the public rankings. Never publishes unreviewed photos.
restaurantImageAdminRoutes.post('/discover-batch',handler(async(_req,res)=>{
 const r=await query<DiscoveryPlace>(`WITH ranked AS (SELECT p.*,row_number() OVER(PARTITION BY p.city ORDER BY p.score DESC,p.review_count DESC,p.name) AS priority FROM local_places p WHERE p.observed_at>now()-interval '30 days' AND p.review_count>=50 AND NOT EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='hide'))
 SELECT p.place_id AS "placeId",p.name,p.city,p.area FROM ranked p LEFT JOIN restaurant_image_discovery d ON d.place_id=p.place_id LEFT JOIN restaurant_image_cache c ON c.place_id=p.place_id WHERE c.place_id IS NULL AND (d.place_id IS NULL OR d.discovery_version<3 OR (d.last_result='failed' AND d.last_attempt_at<now()-interval '24 hours') OR d.last_attempt_at<now()-interval '30 days') ORDER BY p.priority,p.city LIMIT 5`);
 const jobs:DiscoveryPlace[]=[];for(const p of r.rows){await limit('discover',60);jobs.push(p);}
 const outcomes=await Promise.all(jobs.map(p => discoverAndRemember(p)));
 res.json({data:{checked:outcomes.length,found:outcomes.filter(x=>x.status==='found').length,failed:outcomes.filter(x=>x.status==='failed').length}});
}));
restaurantImageAdminRoutes.post('/',handler(async(req,res)=>{
 const b=input.parse(req.body??{});await place(b.placeId);await limit('download',60);
 const actor=(res.locals.admin as AdminIdentity|undefined)?.id??null;
 let image:Awaited<ReturnType<typeof collectAuthorizedImage>>;
 try{image=await collectAuthorizedImage(b.sourceUrl,b.mode);}catch{await result(false);throw new HttpError(422,'IMAGE_FETCH_FAILED','Image download failed: check HTTPS URL, size (200 KB), format or redirects. For ambiguous webpages select the exact image URL first.');}
 const hash=createHash('sha256').update(image.bytes).digest('hex');
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710913)');
  const total=await c.query<{n:string}>('SELECT COALESCE(sum(size_bytes),0)::text AS n FROM restaurant_image_cache WHERE place_id<>$1',[b.placeId]);
  if(Number(total.rows[0].n)+image.bytes.length>MAX_CACHE_BYTES)throw new HttpError(409,'IMAGE_CACHE_FULL','Restaurant image cache is full.');
  const duplicate=await c.query('SELECT 1 FROM restaurant_image_cache WHERE sha256=$1 AND place_id<>$2',[hash,b.placeId]);
  if(duplicate.rowCount)throw new HttpError(409,'IMAGE_DUPLICATE','This exact image is already assigned to another restaurant.');
  await c.query(`INSERT INTO restaurant_image_cache(place_id,source_url,image_url,attribution,licence,permission_url,content_type,bytes,size_bytes,sha256,approved_by)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(place_id) DO UPDATE SET source_url=EXCLUDED.source_url,image_url=EXCLUDED.image_url,attribution=EXCLUDED.attribution,licence=EXCLUDED.licence,permission_url=EXCLUDED.permission_url,content_type=EXCLUDED.content_type,bytes=EXCLUDED.bytes,size_bytes=EXCLUDED.size_bytes,sha256=EXCLUDED.sha256,approved_by=EXCLUDED.approved_by,fetched_at=now()`,[b.placeId,b.sourceUrl,image.imageUrl,b.attribution,b.licence,b.permissionUrl,image.contentType,image.bytes,image.bytes.length,hash,actor]);
 });
 await result(true);res.status(201).json({data:{stored:true,sizeBytes:image.bytes.length}});
}));
restaurantImageAdminRoutes.delete('/:placeId',handler(async(req,res)=>{const id=idSchema.parse(req.params.placeId);await query('DELETE FROM restaurant_image_cache WHERE place_id=$1',[id]);res.json({data:{removed:true}});}));
export const restaurantImagePublicRoutes=Router();
async function listedWithoutCachedPhoto(id:string){
 const r=await query(`WITH ranked AS (
  SELECT p.place_id,row_number() OVER(PARTITION BY p.city ORDER BY p.score DESC,p.review_count DESC,p.name) AS position
  FROM local_places p WHERE p.observed_at>now()-($2||' days')::interval AND p.review_count>=$3
   AND NOT EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='hide')
 ) SELECT 1 FROM local_places p WHERE p.place_id=$1 AND p.observed_at>now()-($2||' days')::interval
 AND NOT EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='hide')
 AND NOT EXISTS(SELECT 1 FROM restaurant_image_cache c WHERE c.place_id=p.place_id)
 AND (EXISTS(SELECT 1 FROM ranked r WHERE r.place_id=p.place_id AND r.position<=$4)
      OR EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='pick'))`,[id,String(MAX_AGE_DAYS),MIN_REVIEWS,TOP_N]);
 return Boolean(r.rowCount);
}
// Only render-time requests; do not persist or reuse Google images, names, or URIs.
restaurantImagePublicRoutes.post('/:placeId/google',handler(async(req,res)=>{
 res.setHeader('Cache-Control','no-store, max-age=0');
 const id=String(req.params.placeId);
 if(!isPlaceId(id)||!publicGooglePhotosEnabled()||!await listedWithoutCachedPhoto(id))throw new HttpError(404,'GOOGLE_PHOTO_UNAVAILABLE','Not Available');
 try{
  const data=await fetchGooglePhoto(id,process.env.GOOGLE_PLACES_API_KEY!,reserveGooglePhoto,fetch,photoWidth());
  if(!data.googleMapsUri||!await listedWithoutCachedPhoto(id))throw new HttpError(404,'GOOGLE_PHOTO_UNAVAILABLE','Not Available');
  res.json({data});
 }catch(e){if(e instanceof GooglePhotoError)throw new HttpError(e.status,e.code,e.message);throw e;}
}));
restaurantImagePublicRoutes.get('/:placeId',handler(async(req,res)=>{
 const id=String(req.params.placeId);if(!isPlaceId(id))throw new HttpError(404,'NOT_FOUND','Not found');
 const r=await query<{content_type:string;bytes:Buffer;sha256:string}>(`SELECT c.content_type,c.bytes,c.sha256 FROM restaurant_image_cache c WHERE c.place_id=$1 AND NOT EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=c.place_id AND o.mode='hide')`,[id]);
 const photo=r.rows[0];if(!photo)throw new HttpError(404,'NOT_FOUND','Not found');
 res.set({'Content-Type':photo.content_type,'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'cross-origin','Cache-Control':'no-store, max-age=0','ETag':`"${photo.sha256}"`});res.send(photo.bytes);
}));
