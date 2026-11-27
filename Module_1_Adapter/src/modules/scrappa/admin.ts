import { z } from 'zod';
import { query, transaction } from '../../lib/db.js';
import { encryptSecret, decryptSecret, sha256 } from '../../lib/security.js';
import { handler, HttpError } from '../../lib/errors.js';
import { roles, type AdminIdentity } from '../auth/auth.js';
import type { Router } from 'express';
import { ensureTikTokSource, storeTikTokCandidate } from '../creators-bucket/tiktok-staging.js';
import { collect, collectProfile, username, MAX_COLLECTION_CREDITS, MONTHLY_CREDIT_LIMIT, SCHEDULED_CREDIT_CEILING } from './collector.js';
const SQL = `CREATE TABLE IF NOT EXISTS scrappa_admin_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL, fingerprint text NOT NULL UNIQUE, ciphertext text NOT NULL, active boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX IF NOT EXISTS scrappa_one_active_key ON scrappa_admin_keys(active) WHERE active;
CREATE TABLE IF NOT EXISTS scrappa_credit_month (month date PRIMARY KEY, used integer NOT NULL CHECK(used BETWEEN 0 AND 500));
CREATE TABLE IF NOT EXISTS scrappa_candidates (external_id text PRIMARY KEY, handle text NOT NULL UNIQUE, display_name text, person_name text, niche text, checked_at timestamptz NOT NULL DEFAULT now());
-- TikTok private staging: explicit identity links, refresh state and coherent snapshots.
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS last_error text;
CREATE UNIQUE INDEX IF NOT EXISTS scrappa_candidate_person_uq ON scrappa_candidates(person_id) WHERE person_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS scrappa_snapshots (
 run_id uuid PRIMARY KEY REFERENCES ingest_jobs(id) ON DELETE CASCADE,
 external_id text NOT NULL REFERENCES scrappa_candidates(external_id) ON DELETE CASCADE,
 observed_at timestamptz NOT NULL,
 profile jsonb NOT NULL,
 posts jsonb NOT NULL,
 analytics jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS scrappa_snapshot_latest_idx ON scrappa_snapshots(external_id, observed_at DESC);
-- Explicit owner approval of third-party data publication; private by default.
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS published_at timestamptz;

`;
let ready: Promise<unknown>|undefined;
export function ensureScrappaSchema(){return ready??=(transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710323)');await c.query(SQL);}).then(()=>ensureTikTokSource()).catch(e=>{ready=undefined;throw e;}));}
const ensure=ensureScrappaSchema;
const month = "date_trunc('month',now() AT TIME ZONE 'UTC')::date";
async function reserve(limit=MONTHLY_CREDIT_LIMIT){const r=await query(`INSERT INTO scrappa_credit_month(month,used) VALUES(${month},1) ON CONFLICT(month) DO UPDATE SET used=scrappa_credit_month.used+1 WHERE scrappa_credit_month.used<$1 RETURNING used`,[limit]);return Boolean(r.rowCount);}
async function remaining(limit:number){return limit-Number((await query(`SELECT used FROM scrappa_credit_month WHERE month=${month}`)).rows[0]?.used??0);}
async function keys(){return (await query('SELECT id,label,active FROM scrappa_admin_keys ORDER BY label,id')).rows;}
function handle(raw:string){let v=raw.trim();if(v.includes('/')){const u=new URL(v.startsWith('https://')?v:'https://'+v);if(!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/@[^/]+\/?$/.test(u.pathname))throw Error('invalid_username');v=u.pathname.split('/')[1];}return username(v);}
async function lookup(raw:string){let name:string;try{name=handle(raw);}catch{throw new HttpError(400,'INVALID_HANDLE','Enter a TikTok username or profile URL');}const key=(await query<{ciphertext:string}>('SELECT ciphertext FROM scrappa_admin_keys WHERE active')).rows[0];if(!key)throw new HttpError(409,'SCRAPPA_KEY_MISSING','Owner must activate a Scrappa key');try{return await collectProfile(name,decryptSecret(key.ciphertext),reserve);}catch(e){const msg=e instanceof Error?e.message:'';throw new HttpError(msg==='quota_exhausted'?429:422,'SCRAPPA_LOOKUP',msg==='quota_exhausted'?'Monthly PCI credit limit reached':'Profile lookup failed or account is not public');}}
export function mountScrappaAdmin(router:Router){
 router.get('/bucket/scrappa/keys',roles('owner'),handler(async(_req,res)=>{await ensure();res.json({data:{keys:await keys(),used:Number((await query(`SELECT used FROM scrappa_credit_month WHERE month=${month}`)).rows[0]?.used??0),limit:500}});}));
 router.get('/bucket/scrappa/status',roles('owner','editor'),handler(async(_req,res)=>{
  await ensure();
  const summary=(await query(`SELECT count(*)::int AS staged,count(*) FILTER(WHERE s.person_id IS NOT NULL)::int AS linked,
   count(*) FILTER(WHERE x.observed_at IS NOT NULL)::int AS collected,
   count(*) FILTER(WHERE x.observed_at>now()-interval '15 days')::int AS fresh,
   count(*) FILTER(WHERE x.analytics->>'sampleSize'='10')::int AS full_samples,
   max(x.observed_at) AS latest_at FROM scrappa_candidates s
   LEFT JOIN LATERAL (SELECT observed_at,analytics FROM scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC LIMIT 1) x ON true`)).rows[0];
  const enabled=(await query<{enabled:boolean}>("SELECT enabled FROM ingest_sources WHERE id='scrappa.api'")).rows[0]?.enabled??false;
  res.json({data:{...summary,enabled,autoConfigured:process.env.PCI_SCRAPPA_AUTO_REFRESH==='true',used:MONTHLY_CREDIT_LIMIT-await remaining(MONTHLY_CREDIT_LIMIT),limit:MONTHLY_CREDIT_LIMIT,scheduledLimit:SCHEDULED_CREDIT_CEILING}});
 }));
 router.post('/bucket/scrappa/refresh-settings',roles('owner'),handler(async(req,res)=>{
  await ensure();
  const {enabled}=z.object({enabled:z.boolean()}).strict().parse(req.body);
  if(enabled&&process.env.PCI_SCRAPPA_AUTO_REFRESH!=='true')throw new HttpError(409,'SCRAPPA_AUTO_NOT_CONFIGURED','Configure PCI_SCRAPPA_AUTO_REFRESH=true on the worker first');
  await transaction(async c=>{
   await c.query("UPDATE ingest_sources SET enabled=$1 WHERE id='scrappa.api'",[enabled]);
   await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.refresh.switch','scrappa',JSON.stringify({enabled})]);
  });
  res.json({data:{enabled}});
 }));
 router.post('/bucket/scrappa/keys',roles('owner'),handler(async(req,res)=>{await ensure();const b=z.object({label:z.string().trim().min(1).max(80),apiKey:z.string().trim().min(8).max(512)}).strict().parse(req.body);await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');await c.query('INSERT INTO scrappa_admin_keys(label,fingerprint,ciphertext) VALUES($1,$2,$3) ON CONFLICT(fingerprint) DO NOTHING',[b.label,sha256(b.apiKey),encryptSecret(b.apiKey)]);await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.save','scrappa','{}']);});res.json({data:await keys()});}));
 router.post('/bucket/scrappa/keys/:id/activate',roles('owner'),handler(async(req,res)=>{await ensure();const id=z.string().uuid().parse(req.params.id);await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');if(!(await c.query('SELECT 1 FROM scrappa_admin_keys WHERE id=$1',[id])).rowCount)throw new HttpError(404,'NOT_FOUND','Key not found');await c.query('UPDATE scrappa_admin_keys SET active=false WHERE active');await c.query('UPDATE scrappa_admin_keys SET active=true WHERE id=$1',[id]);});res.json({data:await keys()});}));
 router.post('/bucket/scrappa/keys/:id/rename',roles('owner'),handler(async(req,res)=>{
  await ensure();const id=z.string().uuid().parse(req.params.id);const {label}=z.object({label:z.string().trim().min(1).max(80)}).strict().parse(req.body);
  await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');if(!(await c.query('UPDATE scrappa_admin_keys SET label=$2 WHERE id=$1',[id,label])).rowCount)throw new HttpError(404,'NOT_FOUND','Key not found');await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.rename',id,'{}']);});res.json({data:await keys()});
 }));
 router.post('/bucket/scrappa/keys/:id/delete',roles('owner'),handler(async(req,res)=>{
  await ensure();const id=z.string().uuid().parse(req.params.id);z.object({confirm:z.literal(true)}).strict().parse(req.body);
  await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');const key=(await c.query<{active:boolean}>('SELECT active FROM scrappa_admin_keys WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!key)throw new HttpError(404,'NOT_FOUND','Key not found');if(key.active)throw new HttpError(409,'SCRAPPA_ACTIVE_KEY','Activate another key before deleting this key');await c.query('DELETE FROM scrappa_admin_keys WHERE id=$1',[id]);await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.delete',id,'{}']);});res.json({data:await keys()});
 }));
 router.post('/bucket/scrappa/candidates/:id/collect',roles('owner'),handler(async(req,res)=>{
  const id=z.string().regex(/^\d{1,30}$/).parse(req.params.id);
  res.json({data:await collectCandidate(id,'manual',(res.locals.admin as AdminIdentity).id)});
 }));
 router.post('/bucket/scrappa/candidates/:id/link',roles('owner'),handler(async(req,res)=>{
  await ensure();
  const id=z.string().regex(/^\d{1,30}$/).parse(req.params.id);
  const {personSlug}=z.object({personSlug:z.string().trim().min(2).max(60).nullable()}).strict().parse(req.body);
  await transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(710324)');
   const candidate=await c.query('SELECT external_id FROM scrappa_candidates WHERE external_id=$1 FOR UPDATE',[id]);
   if(!candidate.rowCount)throw new HttpError(404,'NOT_FOUND','Candidate not found');
   const person=personSlug===null?null:(await c.query<{id:string}>('SELECT id FROM people WHERE slug=$1 FOR KEY SHARE',[personSlug])).rows[0];
   if(personSlug!==null&&!person)throw new HttpError(404,'NOT_FOUND','Existing person slug not found');
   const personId=person?.id??null;
   if(personId&&(await c.query('SELECT 1 FROM scrappa_candidates WHERE person_id=$1 AND external_id<>$2',[personId,id])).rowCount)throw new HttpError(409,'PERSON_ALREADY_LINKED','Person already has a staged TikTok account');
   await c.query('UPDATE scrappa_candidates SET person_id=$2,published_at=NULL WHERE external_id=$1',[id,personId]);
   await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.identity.link',id,JSON.stringify({personId})]);
  });
  res.json({data:{linked:personSlug!==null}});
 }));
 router.post('/bucket/scrappa/candidates/:id/publish',roles('owner'),handler(async(req,res)=>{
  await ensure();
  const id=z.string().regex(/^\d{1,30}$/).parse(req.params.id);
  const {publish}=z.object({publish:z.boolean(),confirm:z.literal(true)}).strict().parse(req.body);
  await transaction(async c=>{
   const candidate=(await c.query(`SELECT s.handle,x.profile,x.observed_at FROM scrappa_candidates s LEFT JOIN LATERAL
    (SELECT profile,observed_at FROM scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC,run_id DESC LIMIT 1) x ON true WHERE s.external_id=$1 FOR UPDATE OF s`,[id])).rows[0];
   if(!candidate)throw new HttpError(404,'NOT_FOUND','Candidate not found');
   if(publish&&(!candidate.profile||candidate.profile.handle!==candidate.handle||!Number.isSafeInteger(candidate.profile.followers)||candidate.profile.followers<0||Date.now()-new Date(candidate.observed_at).getTime()>15*86400000))throw new HttpError(409,'SCRAPPA_NOT_READY','Collect a recent verified snapshot with followers first');
   await c.query('UPDATE scrappa_candidates SET published_at=CASE WHEN $2 THEN now() ELSE NULL END WHERE external_id=$1',[id,publish]);
   await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.publication',id,JSON.stringify({publish})]);
  });
  res.json({data:{published:publish}});
 }));
 router.get('/bucket/scrappa/candidates',roles('owner','editor'),handler(async(_req,res)=>{await ensure();res.json({data:(await query('SELECT s.external_id,s.handle,s.display_name,s.person_name,s.niche,s.checked_at,s.last_success_at,s.last_attempt_at,s.last_error,s.published_at,p.slug AS person_slug,x.analytics,x.profile FROM scrappa_candidates s LEFT JOIN people p ON p.id=s.person_id LEFT JOIN LATERAL (SELECT analytics,profile FROM scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC LIMIT 1) x ON true ORDER BY s.checked_at DESC LIMIT 200')).rows});}));
 router.get('/bucket/scrappa/candidates/:id/snapshots',roles('owner','editor'),handler(async(req,res)=>{
  await ensure();const id=z.string().regex(/^\d{1,30}$/).parse(req.params.id);
  if(!(await query('SELECT 1 FROM scrappa_candidates WHERE external_id=$1',[id])).rowCount)throw new HttpError(404,'NOT_FOUND','Candidate not found');
  res.json({data:(await query('SELECT run_id,observed_at,profile,posts,analytics FROM scrappa_snapshots WHERE external_id=$1 ORDER BY observed_at DESC,run_id DESC LIMIT 20',[id])).rows});
 }));
 router.post('/bucket/scrappa/candidates/:id/remove',roles('owner'),handler(async(req,res)=>{
  await ensure();const id=z.string().regex(/^\d{1,30}$/).parse(req.params.id);
  z.object({confirm:z.literal(true)}).strict().parse(req.body);
  await transaction(async c=>{
   await c.query('SELECT pg_advisory_xact_lock(710330)');
   if((await c.query("SELECT 1 FROM ingest_jobs WHERE source_id='scrappa.api' AND status='running' AND started_at>now()-interval '5 minutes'")).rowCount)throw new HttpError(409,'SCRAPPA_BUSY','Wait for the current collection to finish');
   if(!(await c.query('DELETE FROM scrappa_candidates WHERE external_id=$1 RETURNING external_id',[id])).rowCount)throw new HttpError(404,'NOT_FOUND','Candidate not found');
   const key='tiktok_candidate:'+id;
   await c.query("DELETE FROM ingest_latest WHERE source_id='scrappa.api' AND (entity_id=$1 OR left(entity_id,length($1)+1)=$1||':')",[key]);
   await c.query("DELETE FROM ingest_observations WHERE source_id='scrappa.api' AND (entity_id=$1 OR left(entity_id,length($1)+1)=$1||':')",[key]);
   await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.candidate.remove','scrappa',JSON.stringify({removed:1})]);
  });
  res.json({data:{removed:true}});
 }));
 router.post('/bucket/scrappa/check',roles('owner','editor'),handler(async(req,res)=>{await ensure();const b=z.object({account:z.string().min(1).max(200)}).strict().parse(req.body);res.json({data:await lookup(b.account)});}));
 router.post('/bucket/scrappa/candidates',roles('owner','editor'),handler(async(req,res)=>{await ensure();const b=z.object({account:z.string().min(1).max(200),person:z.string().max(120).optional(),niche:z.string().max(60).optional()}).strict().parse(req.body);const p=await lookup(b.account);await query('INSERT INTO scrappa_candidates(external_id,handle,display_name,person_name,niche) VALUES($1,$2,$3,$4,$5) ON CONFLICT(external_id) DO UPDATE SET handle=excluded.handle,display_name=excluded.display_name,person_name=excluded.person_name,niche=excluded.niche,checked_at=now(),published_at=NULL',[p.accountId,p.handle,p.name,b.person||null,b.niche||null]);res.json({data:{handle:p.handle}});}));
}

/** Shared manual/scheduled collector. The database lease serializes all workers. */
export async function collectCandidate(id:string,trigger:'manual'|'scheduled',actorId:string|null,fetcher:typeof fetch=fetch){
 await ensure();
 const limit=trigger==='scheduled'?SCHEDULED_CREDIT_CEILING:MONTHLY_CREDIT_LIMIT;
 const key=(await query<{ciphertext:string}>('SELECT ciphertext FROM scrappa_admin_keys WHERE active')).rows[0];
 if(!key)throw new HttpError(409,'SCRAPPA_KEY_MISSING','Activate a Scrappa key first');
 const run=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710330)');
  await c.query(`UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code='expired' WHERE source_id='scrappa.api' AND status='running' AND started_at<now()-interval '5 minutes'`);
  if((await c.query(`SELECT 1 FROM ingest_jobs WHERE source_id='scrappa.api' AND status='running'`)).rowCount)throw new HttpError(409,'SCRAPPA_BUSY','Another collection is running');
  const candidate=(await c.query<{handle:string}>('SELECT handle FROM scrappa_candidates WHERE external_id=$1 FOR UPDATE',[id])).rows[0];
  if(!candidate)throw new HttpError(404,'NOT_FOUND','Stage a verified creator first');
  if(trigger==='scheduled'){
   const eligible=await c.query(`SELECT 1 FROM scrappa_candidates WHERE external_id=$1 AND (last_success_at IS NULL OR last_success_at<now()-interval '15 days') AND (last_attempt_at IS NULL OR last_attempt_at<now()-interval '24 hours')`,[id]);
   if(!eligible.rowCount)throw new HttpError(409,'SCRAPPA_NOT_DUE','Candidate is not due');
   if(!(await c.query("SELECT 1 FROM ingest_sources WHERE id='scrappa.api' AND enabled=true")).rowCount)throw new HttpError(409,'SCRAPPA_DISABLED','Source is disabled');
  }
  const used=Number((await c.query(`SELECT used FROM scrappa_credit_month WHERE month=${month}`)).rows[0]?.used??0);
  if(limit-used<MAX_COLLECTION_CREDITS)throw new HttpError(429,'SCRAPPA_QUOTA','Insufficient credit budget for a bounded collection');
  const runId=(await c.query<{id:string}>(`INSERT INTO ingest_jobs(source_id,trigger,status,requested_by,started_at) VALUES('scrappa.api',$1,'running',$2,now()) RETURNING id`,[trigger,actorId])).rows[0].id;
  await c.query('UPDATE scrappa_candidates SET last_attempt_at=now() WHERE external_id=$1',[id]);
  await c.query("UPDATE ingest_sources SET last_attempt_at=now() WHERE id='scrappa.api'");
  return {runId,handle:candidate.handle};
 });
 try{
  const result=await collect(run.handle,decryptSecret(key.ciphertext),()=>reserve(limit),fetcher,id);
  if(result.profile.accountId!==id)throw Error('candidate_identity_changed');
  const stored=await storeTikTokCandidate(run.runId,result);
  return {runId:run.runId,stored,profile:result.profile,analytics:result.analytics};
 }catch(e){
  const quota=e instanceof Error&&e.message==='quota_exhausted';
  const detail=e instanceof Error?e.message:'';
  const code=quota?'quota_exhausted':detail==='scrappa_http_429'?'provider_rate_limited':detail==='scrappa_http_401'||detail==='scrappa_http_403'?'provider_auth':'collection_failed';
  await transaction(async c=>{
   const changed=await c.query(`UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code=$2 WHERE id=$1 AND status='running'`,[run.runId,code]);
   if(changed.rowCount){
    await c.query('UPDATE scrappa_candidates SET last_error=$2 WHERE external_id=$1',[id,code]);
    await c.query("UPDATE ingest_sources SET last_error=$1 WHERE id='scrappa.api'",[code]);
    await c.query(`INSERT INTO hub_source_health(source_id,status,consecutive_failures,last_error_code,checked_at) VALUES('scrappa.api','degraded',1,$1,now()) ON CONFLICT(source_id) DO UPDATE SET consecutive_failures=hub_source_health.consecutive_failures+1,last_error_code=EXCLUDED.last_error_code,checked_at=now()`,[code]);
   }
  });
  throw new HttpError(quota?429:422,'SCRAPPA_COLLECTION',quota?'Monthly PCI credit limit reached':'Collection failed; no successful snapshot was published');
 }
}
/** At most one candidate per hourly tick; opt-in and a 100-credit manual reserve. */
export async function refreshScrappaCandidates(fetcher:typeof fetch=fetch){
 if(process.env.PCI_SCRAPPA_AUTO_REFRESH!=='true')return;
 await ensure();await ensureTikTokSource();
 if(!(await query(`SELECT 1 FROM ingest_sources s LEFT JOIN hub_source_health h ON h.source_id=s.id
  WHERE s.id='scrappa.api' AND s.enabled=true
    AND NOT (COALESCE(s.last_error IN ('provider_auth','provider_rate_limited'),false) AND COALESCE(s.last_attempt_at>now()-interval '24 hours',false))
    AND NOT (COALESCE(h.consecutive_failures,0)>=3 AND COALESCE(s.last_attempt_at>now()-interval '6 hours',false))`)).rowCount)return;
 if(await remaining(SCHEDULED_CREDIT_CEILING)<MAX_COLLECTION_CREDITS)return;
 if(!(await query('SELECT 1 FROM scrappa_admin_keys WHERE active')).rowCount)return;
 const candidate=(await query<{external_id:string}>(`SELECT external_id FROM scrappa_candidates
  WHERE (last_success_at IS NULL OR last_success_at<now()-interval '15 days') AND (last_attempt_at IS NULL OR last_attempt_at<now()-interval '24 hours')
  ORDER BY last_success_at NULLS FIRST,last_attempt_at NULLS FIRST,external_id LIMIT 1`)).rows[0];
 if(candidate)await collectCandidate(candidate.external_id,'scheduled',null,fetcher);
}
