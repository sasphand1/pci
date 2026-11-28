import {skipRuntimeDDL} from '../../architecture/managed-runtime.js';
import { z } from 'zod';
import { query, transaction } from '../../lib/db.js';
import { encryptSecret, decryptSecret, sha256 } from '../../lib/security.js';
import { handler, HttpError } from '../../lib/errors.js';
import { roles, type AdminIdentity } from '../auth/auth.js';
import type { Router } from 'express';
import { ensureTikTokSource, storeTikTokCandidate } from '../creators-bucket/tiktok-staging.js';
import { collect, collectProfile, summarize, MAX_COLLECTION_CREDITS } from './collector.js';
import {monthlyCap} from './credit-policy.js';
import {activeKey,keyUsage,remainingCredits,reserveFor,creditMonitor} from './credits.js';
import {checkProfile,stageVerifiedCandidate,collectionError,normalizeHandle} from './checks.js';
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

-- Scrappa credit accounting v2. Never discard the unallocated legacy total.
ALTER TABLE scrappa_admin_keys ADD COLUMN IF NOT EXISTS monthly_cap integer NOT NULL DEFAULT 499 CHECK(monthly_cap BETWEEN 1 AND 100000);
ALTER TABLE scrappa_admin_keys ADD COLUMN IF NOT EXISTS retired_at timestamptz;
DO $$ BEGIN
 IF to_regclass('scrappa_key_credit_month') IS NULL THEN
  CREATE TABLE scrappa_key_credit_month (
   key_id uuid NOT NULL REFERENCES scrappa_admin_keys(id) ON DELETE RESTRICT,
   month date NOT NULL, used integer NOT NULL CHECK(used>=0), legacy_used integer NOT NULL DEFAULT 0 CHECK(legacy_used>=0 AND legacy_used<=used),
   PRIMARY KEY(key_id,month));
  -- Old usage has no key attribution. Charge the full shared total to each existing key conservatively.
  INSERT INTO scrappa_key_credit_month(key_id,month,used,legacy_used)
   SELECT k.id,m.month,m.used,m.used FROM scrappa_admin_keys k CROSS JOIN scrappa_credit_month m;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='scrappa_credit_month'::regclass AND conname='scrappa_legacy_credit_nonnegative') THEN
  ALTER TABLE scrappa_credit_month DROP CONSTRAINT IF EXISTS scrappa_credit_month_used_check;
  ALTER TABLE scrappa_credit_month ADD CONSTRAINT scrappa_legacy_credit_nonnegative CHECK(used>=0);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS scrappa_credit_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key_id uuid NOT NULL REFERENCES scrappa_admin_keys(id) ON DELETE RESTRICT,
 run_id uuid REFERENCES ingest_jobs(id) ON DELETE SET NULL,
 month date NOT NULL, endpoint text NOT NULL CHECK(endpoint IN ('profile','posts')), handle text NOT NULL,
 outcome text NOT NULL DEFAULT 'reserved' CHECK(outcome IN ('reserved','response','ambiguous')),
 http_status integer CHECK(http_status BETWEEN 100 AND 599),
 reserved_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, transport_failure boolean NOT NULL DEFAULT false,
 CHECK((outcome='reserved' AND finished_at IS NULL AND http_status IS NULL) OR (outcome='response' AND finished_at IS NOT NULL AND http_status IS NOT NULL) OR (outcome='ambiguous' AND finished_at IS NOT NULL AND http_status IS NULL)));
CREATE INDEX IF NOT EXISTS scrappa_credit_ledger_key_time_idx ON scrappa_credit_ledger(key_id,reserved_at DESC,id);
CREATE INDEX IF NOT EXISTS scrappa_credit_ledger_run_idx ON scrappa_credit_ledger(run_id);
CREATE TABLE IF NOT EXISTS scrappa_profile_checks (
 handle text PRIMARY KEY, attempt_id uuid NOT NULL, attempted_at timestamptz NOT NULL,
 completed_at timestamptz, checked_at timestamptz, profile jsonb, last_error text,
 CHECK((profile IS NULL)=(checked_at IS NULL)));

-- Unverified registration is private and does not require a provider identity.
CREATE TABLE IF NOT EXISTS scrappa_pending_accounts (
 handle text PRIMARY KEY CHECK(handle ~ '^[a-z0-9._]{2,24}$'),
 person_name text, niche text, created_at timestamptz NOT NULL DEFAULT now(),
 last_attempt_at timestamptz, last_error text
);

`;
let ready: Promise<unknown>|undefined;
export async function ensureScrappaSchema(){monthlyCap(process.env.SCRAPPA_MONTHLY_CREDIT_CAP);if(skipRuntimeDDL())return;return ready??=(transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710323)');await c.query(SQL);}).then(()=>ensureTikTokSource()).catch(e=>{ready=undefined;throw e;}));}
const ensure=ensureScrappaSchema;
const keys=keyUsage;
const defaultCap=()=>monthlyCap(process.env.SCRAPPA_MONTHLY_CREDIT_CAP);
export function mountScrappaAdmin(router:Router){
 router.get('/bucket/scrappa/keys',roles('owner'),handler(async(_req,res)=>{await ensure();const rows=await keys(),active=rows.find(k=>k.active);res.json({data:{keys:rows,used:active?.used??0,limit:active?.cap??0,defaultCap:defaultCap()}});}));
 router.get('/bucket/scrappa/status',roles('owner','editor'),handler(async(_req,res)=>{
  await ensure();
  const summary=(await query(`SELECT count(*)::int AS staged,count(*) FILTER(WHERE s.person_id IS NOT NULL)::int AS linked,
   count(*) FILTER(WHERE x.observed_at IS NOT NULL)::int AS collected,
   count(*) FILTER(WHERE x.observed_at>now()-interval '15 days')::int AS fresh,
   count(*) FILTER(WHERE x.analytics->>'sampleSize'='10')::int AS full_samples,
   max(x.observed_at) AS latest_at FROM scrappa_candidates s
   LEFT JOIN LATERAL (SELECT observed_at,analytics FROM scrappa_snapshots WHERE external_id=s.external_id ORDER BY observed_at DESC LIMIT 1) x ON true`)).rows[0];
  const enabled=(await query<{enabled:boolean}>("SELECT enabled FROM ingest_sources WHERE id='scrappa.api'")).rows[0]?.enabled??false;
  res.json({data:{...summary,enabled,autoConfigured:process.env.PCI_SCRAPPA_AUTO_REFRESH==='true',...await creditMonitor((res.locals.admin as AdminIdentity).role==='owner')}});
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
 router.post('/bucket/scrappa/keys',roles('owner'),handler(async(req,res)=>{await ensure();const b=z.object({label:z.string().trim().min(1).max(80),apiKey:z.string().trim().min(8).max(512),cap:z.number().int().min(1).max(100000).optional()}).strict().parse(req.body);await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');await c.query('INSERT INTO scrappa_admin_keys(label,fingerprint,ciphertext,monthly_cap) VALUES($1,$2,$3,$4) ON CONFLICT(fingerprint) DO UPDATE SET label=excluded.label,ciphertext=excluded.ciphertext,monthly_cap=excluded.monthly_cap,retired_at=NULL WHERE scrappa_admin_keys.retired_at IS NOT NULL',[b.label,sha256(b.apiKey),encryptSecret(b.apiKey),b.cap??defaultCap()]);await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.save','scrappa','{}']);});res.json({data:await keys()});}));
 router.post('/bucket/scrappa/keys/:id/activate',roles('owner'),handler(async(req,res)=>{await ensure();const id=z.string().uuid().parse(req.params.id);await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');if(!(await c.query('SELECT 1 FROM scrappa_admin_keys WHERE id=$1 AND retired_at IS NULL',[id])).rowCount)throw new HttpError(404,'NOT_FOUND','Key not found');if((await c.query("SELECT 1 FROM scrappa_credit_ledger WHERE outcome='reserved' AND reserved_at>now()-interval '2 minutes' LIMIT 1")).rowCount)throw new HttpError(409,'SCRAPPA_BUSY','Wait for the current request before switching keys');await c.query('UPDATE scrappa_admin_keys SET active=false WHERE active');await c.query('UPDATE scrappa_admin_keys SET active=true WHERE id=$1 AND retired_at IS NULL',[id]);await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.activate',id,'{}']);});res.json({data:await keys()});}));
 router.post('/bucket/scrappa/keys/:id/rename',roles('owner'),handler(async(req,res)=>{
  await ensure();const id=z.string().uuid().parse(req.params.id);const {label}=z.object({label:z.string().trim().min(1).max(80)}).strict().parse(req.body);
  await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');if(!(await c.query('UPDATE scrappa_admin_keys SET label=$2 WHERE id=$1 AND retired_at IS NULL',[id,label])).rowCount)throw new HttpError(404,'NOT_FOUND','Key not found');await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.rename',id,'{}']);});res.json({data:await keys()});
 }));
 router.post('/bucket/scrappa/keys/:id/cap',roles('owner'),handler(async(req,res)=>{
  await ensure();const id=z.string().uuid().parse(req.params.id);const {cap}=z.object({cap:z.number().int().min(1).max(100000),confirm:z.literal(true)}).strict().parse(req.body);
  await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');if(!(await c.query('UPDATE scrappa_admin_keys SET monthly_cap=$2 WHERE id=$1 AND retired_at IS NULL',[id,cap])).rowCount)throw new HttpError(404,'NOT_FOUND','Key not found');await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.cap',id,JSON.stringify({cap})]);});res.json({data:await keys()});
 }));
 router.post('/bucket/scrappa/keys/:id/delete',roles('owner'),handler(async(req,res)=>{
  await ensure();const id=z.string().uuid().parse(req.params.id);z.object({confirm:z.literal(true)}).strict().parse(req.body);
  await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710329)');const key=(await c.query<{active:boolean}>('SELECT active FROM scrappa_admin_keys WHERE id=$1 AND retired_at IS NULL FOR UPDATE',[id])).rows[0];if(!key)throw new HttpError(404,'NOT_FOUND','Key not found');if(key.active)throw new HttpError(409,'SCRAPPA_ACTIVE_KEY','Activate another key before deleting this key');await c.query("UPDATE scrappa_admin_keys SET retired_at=now(),ciphertext='' WHERE id=$1",[id]);await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.key.delete',id,'{}']);});res.json({data:await keys()});
 }));
 router.post('/bucket/scrappa/candidates/:id/collect',roles('owner'),handler(async(req,res)=>{
  const id=z.string().regex(/^\d{1,30}$/).parse(req.params.id);
  const {profileOnly,confirm}=z.object({profileOnly:z.boolean().optional(),confirm:z.boolean().optional()}).strict().parse(req.body??{});
  if(profileOnly&&confirm!==true)throw new HttpError(400,'SCRAPPA_CONFIRM','Confirm the one-credit profile refresh');
  res.json({data:await collectCandidate(id,'manual',(res.locals.admin as AdminIdentity).id,fetch,profileOnly===true)});
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
 router.get('/bucket/scrappa/pending',roles('owner','editor'),handler(async(_req,res)=>{
  await ensure();res.json({data:(await query('SELECT handle,person_name,niche,created_at,last_attempt_at,last_error FROM scrappa_pending_accounts ORDER BY created_at,handle LIMIT 1000')).rows});
 }));
 router.post('/bucket/scrappa/pending',roles('owner','editor'),handler(async(req,res)=>{
  await ensure();const rows=z.array(z.object({account:z.string().min(1).max(200),person:z.string().max(120).optional(),niche:z.string().max(60).optional()}).strict()).min(1).max(200).parse(req.body);
  res.json({data:await registerPending(rows,(res.locals.admin as AdminIdentity).id)});
 }));
 router.post('/bucket/scrappa/pending/:handle/collect',roles('owner'),handler(async(req,res)=>{
  z.object({confirm:z.literal(true)}).strict().parse(req.body);
  res.json({data:await collectPending(normalizeHandle(req.params.handle),'manual',(res.locals.admin as AdminIdentity).id)});
 }));
 router.post('/bucket/scrappa/pending/:handle/remove',roles('owner'),handler(async(req,res)=>{
  await ensure();z.object({confirm:z.literal(true)}).strict().parse(req.body);const handle=normalizeHandle(req.params.handle);
  await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710330)');
   if((await c.query("SELECT 1 FROM ingest_jobs WHERE source_id='scrappa.api' AND status='running' AND started_at>now()-interval '5 minutes'")).rowCount)throw new HttpError(409,'SCRAPPA_BUSY','Wait for collection to finish');
   await c.query('DELETE FROM scrappa_pending_accounts WHERE handle=$1',[handle]);
   await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'scrappa.pending.remove','scrappa','{}']);
  });res.json({data:{removed:true}});
 }));
 router.post('/bucket/scrappa/check',roles('owner','editor'),handler(async(req,res)=>{
  await ensure();const b=z.object({account:z.string().min(1).max(200),force:z.boolean().optional()}).strict().parse(req.body);const actor=res.locals.admin as AdminIdentity;
  if(b.force){if(actor.role!=='owner')throw new HttpError(403,'FORBIDDEN','Only the Owner can force a paid recheck');await query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[actor.id,'scrappa.check.force','scrappa','{}']);}
  res.json({data:await checkProfile(b.account,b.force??false)});
 }));
 router.post('/bucket/scrappa/candidates',roles('owner','editor'),handler(async(req,res)=>{
  await ensure();const b=z.object({account:z.string().min(1).max(200),person:z.string().max(120).optional(),niche:z.string().max(60).optional()}).strict().parse(req.body);res.json({data:await stageVerifiedCandidate(b.account,b.person,b.niche)});
 }));
}

/** Local-only registration. No credential lookup or provider call. */
export async function registerPending(rows:{account:string;person?:string;niche?:string}[],actorId:string|null){
 return transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710330)');
  const results:{handle:string;status:'added'|'duplicate'|'invalid'}[]=[],seen=new Set<string>();
  for(const row of rows){
   let handle:string;try{handle=normalizeHandle(row.account);}catch{results.push({handle:row.account,status:'invalid'});continue;}
   if(seen.has(handle)){results.push({handle,status:'duplicate'});continue;}seen.add(handle);
   const inserted=await c.query(`INSERT INTO scrappa_pending_accounts(handle,person_name,niche)
    SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM scrappa_candidates WHERE handle=$1)
    ON CONFLICT(handle) DO NOTHING RETURNING handle`,[handle,row.person||null,row.niche||null]);
   results.push({handle,status:inserted.rowCount?'added':'duplicate'});
  }
  if(actorId)await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[actorId,'scrappa.pending.register','scrappa',JSON.stringify({added:results.filter(r=>r.status==='added').length})]);
  return results;
 });
}
/** First collection resolves identity and records actual profile metrics in one paid request. */
export async function collectPending(handle:string,trigger:'manual'|'scheduled',actorId:string|null,fetcher:typeof fetch=fetch){
 await ensure();handle=normalizeHandle(handle);const key=await activeKey();
 const runId=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710330)');
  await c.query("UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code='expired' WHERE source_id='scrappa.api' AND status='running' AND started_at<now()-interval '5 minutes'");
  if((await c.query("SELECT 1 FROM ingest_jobs WHERE source_id='scrappa.api' AND status='running'")).rowCount)throw new HttpError(409,'SCRAPPA_BUSY','Another collection is running');
  const pending=(await c.query<{recent:boolean}>("SELECT COALESCE(last_attempt_at>now()-interval '24 hours',false) AS recent FROM scrappa_pending_accounts WHERE handle=$1 FOR UPDATE",[handle])).rows[0];
  if(!pending)throw new HttpError(404,'NOT_FOUND','Pending creator not found');
  if(pending.recent)throw new HttpError(409,'SCRAPPA_RECENT_CHECK','Already attempted within 24 hours');
  if(trigger==='scheduled'&&!(await c.query("SELECT 1 FROM ingest_sources WHERE id='scrappa.api' AND enabled=true")).rowCount)throw new HttpError(409,'SCRAPPA_DISABLED','Source is disabled');
  if(await remainingCredits(key.id,trigger==='scheduled',c)<1)throw new HttpError(429,'SCRAPPA_QUOTA','Insufficient credit budget');
  const id=(await c.query<{id:string}>("INSERT INTO ingest_jobs(source_id,trigger,status,requested_by,started_at) VALUES('scrappa.api',$1,'running',$2,now()) RETURNING id",[trigger,actorId])).rows[0].id;
  await c.query('UPDATE scrappa_pending_accounts SET last_attempt_at=now() WHERE handle=$1',[handle]);
  await c.query("UPDATE ingest_sources SET last_attempt_at=now() WHERE id='scrappa.api'");return id;
 });
 try{
  const profile=await collectProfile(handle,decryptSecret(key.ciphertext),reserveFor(key.id,trigger==='scheduled',runId),fetcher);
  const result={source:'scrappa.api',observedAt:new Date().toISOString(),profile,posts:[],analytics:summarize([])};
  const stored=await storeTikTokCandidate(runId,result,true);
  return {runId,stored,profile:{...profile,avatar:null,bio:null},analytics:result.analytics};
 }catch(e){
  const err=collectionError(e);await transaction(async c=>{
   const changed=await c.query("UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code=$2 WHERE id=$1 AND status='running'",[runId,err.code]);
   if(changed.rowCount){await c.query('UPDATE scrappa_pending_accounts SET last_error=$2 WHERE handle=$1',[handle,err.code]);await c.query("UPDATE ingest_sources SET last_error=$1 WHERE id='scrappa.api'",[err.code]);}
  });throw err;
 }
}

/** Shared manual/scheduled collector. The database lease serializes all workers. */
export async function collectCandidate(id:string,trigger:'manual'|'scheduled',actorId:string|null,fetcher:typeof fetch=fetch,profileOnly=false){
 await ensure();
 const key=await activeKey();
 const run=await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710330)');
  await c.query(`UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code='expired' WHERE source_id='scrappa.api' AND status='running' AND started_at<now()-interval '5 minutes'`);
  if((await c.query(`SELECT 1 FROM ingest_jobs WHERE source_id='scrappa.api' AND status='running'`)).rowCount)throw new HttpError(409,'SCRAPPA_BUSY','Another collection is running');
  const candidate=(await c.query<{handle:string}>('SELECT handle FROM scrappa_candidates WHERE external_id=$1 FOR UPDATE',[id])).rows[0];
  if(!candidate)throw new HttpError(404,'NOT_FOUND','Stage a verified creator first');
  if(profileOnly){
   const latest=(await c.query<{sampled:boolean}>("SELECT jsonb_array_length(posts)>0 AS sampled FROM scrappa_snapshots WHERE external_id=$1 ORDER BY observed_at DESC,run_id DESC LIMIT 1",[id])).rows[0];
   if(!latest||latest.sampled)throw new HttpError(409,'SCRAPPA_PROFILE_ONLY_UNAVAILABLE','Use full collection to preserve the sampled video snapshot');
  }
  if(trigger==='scheduled'){
   const eligible=await c.query(`SELECT 1 FROM scrappa_candidates WHERE external_id=$1 AND (last_success_at IS NULL OR last_success_at<now()-interval '15 days') AND (last_attempt_at IS NULL OR last_attempt_at<now()-interval '24 hours')`,[id]);
   if(!eligible.rowCount)throw new HttpError(409,'SCRAPPA_NOT_DUE','Candidate is not due');
   if(!(await c.query("SELECT 1 FROM ingest_sources WHERE id='scrappa.api' AND enabled=true")).rowCount)throw new HttpError(409,'SCRAPPA_DISABLED','Source is disabled');
  }
  if(await remainingCredits(key.id,trigger==='scheduled',c)<(profileOnly?1:MAX_COLLECTION_CREDITS))throw new HttpError(429,'SCRAPPA_QUOTA','Insufficient credit budget for a bounded collection');
  const runId=(await c.query<{id:string}>(`INSERT INTO ingest_jobs(source_id,trigger,status,requested_by,started_at) VALUES('scrappa.api',$1,'running',$2,now()) RETURNING id`,[trigger,actorId])).rows[0].id;
  await c.query('UPDATE scrappa_candidates SET last_attempt_at=now() WHERE external_id=$1',[id]);
  await c.query("UPDATE ingest_sources SET last_attempt_at=now() WHERE id='scrappa.api'");
  return {runId,handle:candidate.handle};
 });
 try{
  const secret=decryptSecret(key.ciphertext),reserve=reserveFor(key.id,trigger==='scheduled',run.runId);
  const result=profileOnly?await (async()=>{const profile=await collectProfile(run.handle,secret,reserve,fetcher);return {source:'scrappa.api',observedAt:new Date().toISOString(),profile,posts:[],analytics:summarize([])};})():await collect(run.handle,secret,reserve,fetcher,id);
  if(result.profile.accountId!==id)throw Error('candidate_identity_changed');
  const stored=await storeTikTokCandidate(run.runId,result);
  return {runId:run.runId,stored,profile:result.profile,analytics:result.analytics};
 }catch(e){
  const err=collectionError(e);
  const code=err.code==='SCRAPPA_QUOTA'?'quota_exhausted':err.code==='SCRAPPA_PROVIDER_STOP'?'provider_auth':err.code==='SCRAPPA_CIRCUIT_OPEN'?'circuit_open':err.code==='SCRAPPA_BUSY'?'request_busy':'collection_failed';
  await transaction(async c=>{
   const changed=await c.query(`UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code=$2 WHERE id=$1 AND status='running'`,[run.runId,code]);
   if(changed.rowCount){
    await c.query('UPDATE scrappa_candidates SET last_error=$2 WHERE external_id=$1',[id,code]);
    await c.query("UPDATE ingest_sources SET last_error=$1 WHERE id='scrappa.api'",[code]);
    await c.query(`INSERT INTO hub_source_health(source_id,status,consecutive_failures,last_error_code,checked_at) VALUES('scrappa.api','degraded',1,$1,now()) ON CONFLICT(source_id) DO UPDATE SET consecutive_failures=hub_source_health.consecutive_failures+1,last_error_code=EXCLUDED.last_error_code,checked_at=now()`,[code]);
   }
  });
  throw err;
 }
}
/** At most one candidate per hourly tick; opt-in and a 20% manual reserve per key. */
export async function refreshScrappaCandidates(fetcher:typeof fetch=fetch){
 if(process.env.PCI_SCRAPPA_AUTO_REFRESH!=='true')return;
 await ensure();await ensureTikTokSource();
 if(!(await query(`SELECT 1 FROM ingest_sources s LEFT JOIN hub_source_health h ON h.source_id=s.id
  WHERE s.id='scrappa.api' AND s.enabled=true
    AND NOT (COALESCE(s.last_error IN ('provider_auth','provider_rate_limited'),false) AND COALESCE(s.last_attempt_at>now()-interval '24 hours',false))
    AND NOT (COALESCE(h.consecutive_failures,0)>=3 AND COALESCE(s.last_attempt_at>now()-interval '6 hours',false))`)).rowCount)return;
 const key=await activeKey().catch(e=>{if(e instanceof HttpError&&e.code==='SCRAPPA_KEY_MISSING')return null;throw e;});
 if(!key||await remainingCredits(key.id,true)<1)return;
 const pending=(await query<{handle:string}>("SELECT handle FROM scrappa_pending_accounts WHERE last_attempt_at IS NULL OR last_attempt_at<now()-interval '24 hours' ORDER BY created_at,handle LIMIT 1")).rows[0];
 if(pending){await collectPending(pending.handle,'scheduled',null,fetcher);return;}
 if(await remainingCredits(key.id,true)<MAX_COLLECTION_CREDITS)return;
 const candidate=(await query<{external_id:string}>(`SELECT external_id FROM scrappa_candidates
  WHERE (last_success_at IS NULL OR last_success_at<now()-interval '15 days') AND (last_attempt_at IS NULL OR last_attempt_at<now()-interval '24 hours')
  ORDER BY last_success_at NULLS FIRST,last_attempt_at NULLS FIRST,external_id LIMIT 1`)).rows[0];
 if(candidate)await collectCandidate(candidate.external_id,'scheduled',null,fetcher);
}
