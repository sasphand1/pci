import { createHash } from 'node:crypto';
import { pool, query, transaction } from '../../lib/db.js';
import { discoverGoogleWebsite } from './photo-policy.js';
import { collectAuthorizedImage, discoverRestaurantImages, type ImageCandidate } from './image-http.js';
import { MAX_CACHE_BYTES } from './image-rules.mjs';
import { lockPlace } from './place-lifecycle.js';

export const HTTP_IMAGE_STATE_SQL=`-- Independent HTTP photo job state. Cascades with restaurant deletion.
CREATE TABLE IF NOT EXISTS restaurant_image_http_state (
  place_id text PRIMARY KEY REFERENCES local_places(place_id) ON DELETE CASCADE,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('stored','refreshed','review','unavailable','failed','changed')),
  detail text NOT NULL DEFAULT ''
);
`;
type Result='stored'|'refreshed'|'review'|'unavailable'|'failed'|'changed';
type Job={place_id:string;name:string;city:string;area:string|null;address:string|null;image_url:string|null;sha256:string|null};
export type HttpFillReport={status:'done'|'busy'|'disabled';checked:number;stored:number;refreshed:number;review:number;unavailable:number;failed:number;changed:number};
const enabled=()=>process.env.PCI_RESTAURANT_HTTP_AUTOFILL==='true';
function batchSize(){const n=Number(process.env.PCI_RESTAURANT_HTTP_BATCH_SIZE??3);return Number.isSafeInteger(n)&&n>0?Math.min(n,10):3;}
function detail(e:unknown){const s=e instanceof Error?e.message:'UNKNOWN';return /^[A-Z_0-9]{1,100}$/.test(s)?s:'HTTP_OR_DATABASE_ERROR';}
async function mark(id:string,result:Result,message:string){
 await query(`INSERT INTO restaurant_image_http_state(place_id,result,detail) SELECT place_id,$2,$3 FROM local_places WHERE place_id=$1
 ON CONFLICT(place_id) DO UPDATE SET last_attempt_at=now(),result=EXCLUDED.result,detail=EXCLUDED.detail`,[id,result,message.slice(0,500)]);
}
async function store(id:string,candidate:ImageCandidate){
 if(candidate.autoAuthorized!==true||!candidate.permissionUrl||!candidate.attribution||!candidate.licence)return false;
 const image=await collectAuthorizedImage(candidate.sourceUrl,'direct');const hash=createHash('sha256').update(image.bytes).digest('hex');
 return transaction(async tx=>{
  await lockPlace(tx,id);await tx.query('SELECT pg_advisory_xact_lock(710913)');
  const exists=await tx.query(`SELECT 1 FROM local_places p WHERE place_id=$1 AND NOT EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='hide')`,[id]);if(!exists.rowCount)return false;
  const total=await tx.query<{n:string}>('SELECT COALESCE(sum(size_bytes),0)::text AS n FROM restaurant_image_cache');
  if(Number(total.rows[0].n)+image.bytes.length>MAX_CACHE_BYTES)throw new Error('IMAGE_CACHE_FULL');
  const inserted=await tx.query(`INSERT INTO restaurant_image_cache(place_id,source_url,image_url,attribution,licence,permission_url,content_type,bytes,size_bytes,sha256,approved_by)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL) ON CONFLICT DO NOTHING RETURNING place_id`,[id,candidate.sourceUrl,image.imageUrl,candidate.attribution,candidate.licence,candidate.permissionUrl,image.contentType,image.bytes,image.bytes.length,hash]);
  return Boolean(inserted.rowCount);
 });
}
async function processOne(p:Job):Promise<Result>{
 if(p.image_url&&p.sha256){
  // Prior approval covers the approved photograph, not arbitrary replacement bytes at the same URL.
  const image=await collectAuthorizedImage(p.image_url,'direct');const hash=createHash('sha256').update(image.bytes).digest('hex');
  if(hash!==p.sha256){await mark(p.place_id,'changed','Source bytes changed; existing approved photo retained for review.');return 'changed';}
  const updated=await query('UPDATE restaurant_image_cache SET fetched_at=now() WHERE place_id=$1 AND sha256=$2',[p.place_id,p.sha256]);
  if(!updated.rowCount)return 'unavailable';await mark(p.place_id,'refreshed','Approved image verified unchanged.');return 'refreshed';
 }
 let website:string|undefined;let lookupFailed=false;
 if(process.env.PCI_GOOGLE_WEBSITE_DISCOVERY_ENABLED==='true'){
  try{website=(await discoverGoogleWebsite(p.place_id))??undefined;}catch{lookupFailed=true;}
 }
 const r=await discoverRestaurantImages(p.name,p.city,p.area,website,p.address);
 if(lookupFailed)r.diagnostics.unshift('Website lookup unavailable or quota reached.');
 await query(`INSERT INTO restaurant_image_discovery(place_id,candidates,last_result,last_attempt_at,discovery_version,diagnostics)
 SELECT place_id,$2::jsonb,$3,now(),4,$4::jsonb FROM local_places WHERE place_id=$1
 ON CONFLICT(place_id) DO UPDATE SET candidates=CASE WHEN EXCLUDED.last_result='failed' THEN restaurant_image_discovery.candidates ELSE EXCLUDED.candidates END,last_result=EXCLUDED.last_result,last_attempt_at=now(),discovery_version=4,diagnostics=EXCLUDED.diagnostics`,[p.place_id,JSON.stringify(r.candidates),r.status,JSON.stringify(r.diagnostics)]);
 for(const candidate of r.candidates.filter(c=>c.autoAuthorized===true)){
  try{if(await store(p.place_id,candidate)){await mark(p.place_id,'stored','Image-specific open licence and branch address matched.');return 'stored';}}
  catch(e){r.diagnostics.push(detail(e));}
 }
 const result:Result=r.candidates.length?'review':lookupFailed||r.status==='failed'?'failed':'unavailable';
 await mark(p.place_id,result,r.diagnostics.join('; '));return result;
}
export async function fillRestaurantHttpPhotos(opts:{manual?:boolean;limit?:number}={}):Promise<HttpFillReport>{
 const report:HttpFillReport={status:'done',checked:0,stored:0,refreshed:0,review:0,unavailable:0,failed:0,changed:0};
 if(!opts.manual&&!enabled())return {...report,status:'disabled'};
 // A dedicated PostgreSQL transaction lock serializes scheduled and manual workers across instances.
 const conn=await pool.connect();let locked=false;
 try{
  await conn.query('BEGIN');
  locked=Boolean((await conn.query<{ok:boolean}>('SELECT pg_try_advisory_xact_lock(731916) AS ok')).rows[0]?.ok);
  if(!locked)return {...report,status:'busy'};
  const jobs=await query<Job>(`SELECT p.place_id,p.name,p.city,p.area,p.address,c.image_url,c.sha256 FROM local_places p
   LEFT JOIN restaurant_image_cache c USING(place_id) LEFT JOIN restaurant_image_http_state s USING(place_id)
   WHERE NOT EXISTS(SELECT 1 FROM local_place_overrides o WHERE o.place_id=p.place_id AND o.mode='hide')
   AND ((c.place_id IS NULL AND (s.place_id IS NULL OR s.last_attempt_at < now()-CASE WHEN s.result='failed' THEN interval '1 day' ELSE interval '30 days' END))
    OR (c.place_id IS NOT NULL AND c.fetched_at<now()-interval '30 days' AND (s.place_id IS NULL OR s.last_attempt_at<now()-interval '1 day')))
   ORDER BY s.last_attempt_at NULLS FIRST,p.score DESC,p.place_id LIMIT $1`,[opts.limit??batchSize()]);
  for(const p of jobs.rows){report.checked++;try{const result=await processOne(p);report[result]++;}catch(e){report.failed++;await mark(p.place_id,'failed',detail(e)).catch(()=>undefined);}}
  return report;
 }finally{try{await conn.query('ROLLBACK');}finally{conn.release();}}
}
