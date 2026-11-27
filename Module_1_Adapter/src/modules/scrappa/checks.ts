import {query,transaction} from '../../lib/db.js';
import {HttpError} from '../../lib/errors.js';
import {decryptSecret} from '../../lib/security.js';
import {collectProfile,username} from './collector.js';
import {activeKey,reserveFor} from './credits.js';
import {randomUUID} from 'node:crypto';
export type CheckedProfile=Awaited<ReturnType<typeof collectProfile>>;
export function normalizeHandle(raw:string){
 let v=raw.trim();
 try{if(v.includes('/')){const u=new URL(v.startsWith('https://')?v:'https://'+v);if(u.protocol!=='https:'||!['tiktok.com','www.tiktok.com','m.tiktok.com'].includes(u.hostname)||u.username||u.password||u.port||!/^\/@[^/]+\/?$/.test(u.pathname))throw Error('invalid_username');v=u.pathname.split('/')[1];}return username(v);}
 catch{throw new HttpError(400,'INVALID_HANDLE','Enter a TikTok username or profile URL');}
}
export function collectionError(e:unknown):HttpError{
 if(e instanceof HttpError)return e;
 const detail=e instanceof Error?e.message:'';
 if(detail==='quota_exhausted')return new HttpError(429,'SCRAPPA_QUOTA','Monthly credential credit limit reached');
 if(['scrappa_http_401','scrappa_http_402','scrappa_http_403','scrappa_http_429'].includes(detail))return new HttpError(409,'SCRAPPA_PROVIDER_STOP','Scrappa rejected the request; collection paused for this key');
 if(detail==='scrappa_network_error'||/^scrappa_http_5\d\d$/.test(detail))return new HttpError(422,'SCRAPPA_PROVIDER_FAILURE','Scrappa network/provider failure; reserved credit retained');
 return new HttpError(422,'SCRAPPA_LOOKUP','Profile lookup or collection failed; no successful snapshot published');
}
/** Claim a check durably before calling the provider. Concurrent checks cannot duplicate a paid request. */
export async function checkProfile(raw:string,force=false,fetcher:typeof fetch=fetch){
 const handle=normalizeHandle(raw),attemptId=randomUUID();
 const claim=await transaction(async c=>{
  await c.query("SELECT pg_advisory_xact_lock(hashtextextended('scrappa:check:'||$1,0))",[handle]);
  const r=(await c.query<{profile:CheckedProfile|null;fresh:boolean;recent:boolean;in_flight:boolean;last_error:string|null}>(`SELECT profile,checked_at>now()-interval '24 hours' AS fresh,attempted_at>now()-interval '24 hours' AS recent,
    completed_at IS NULL AND attempted_at>now()-interval '2 minutes' AS in_flight,last_error FROM scrappa_profile_checks WHERE handle=$1 FOR UPDATE`,[handle])).rows[0];
  if(!force&&r?.fresh&&r.profile)return {profile:r.profile};
  if(r?.in_flight)throw new HttpError(409,'SCRAPPA_BUSY','A check for this handle is in progress');
  if(!force&&r?.recent&&r.last_error!=='preflight')throw new HttpError(409,'SCRAPPA_RECENT_CHECK','A recent check failed; wait 24 hours or ask the Owner to recheck');
  const key=await activeKey(c);
  await c.query(`INSERT INTO scrappa_profile_checks(handle,attempt_id,attempted_at) VALUES($1,$2,now()) ON CONFLICT(handle) DO UPDATE SET attempt_id=excluded.attempt_id,attempted_at=excluded.attempted_at,completed_at=NULL,last_error=NULL`,[handle,attemptId]);
  return {key};
 });
 if(claim.profile)return {...claim.profile,cached:true};
 if(!claim.key)throw Error('scrappa_check_claim_missing');
 try{
  const p=await collectProfile(handle,decryptSecret(claim.key.ciphertext),reserveFor(claim.key.id,false),fetcher);
  const profile={...p,avatar:null,bio:null};
  const changed=await query('UPDATE scrappa_profile_checks SET profile=$3::jsonb,checked_at=now(),completed_at=now(),last_error=NULL WHERE handle=$1 AND attempt_id=$2',[handle,attemptId,JSON.stringify(profile)]);
  if(!changed.rowCount)throw new HttpError(409,'SCRAPPA_CHECK_EXPIRED','Check superseded; reload before staging');
  return {...profile,cached:false};
 }catch(e){
  const err=collectionError(e);
  const preflight=['SCRAPPA_KEY_CHANGED','SCRAPPA_BUSY','SCRAPPA_CIRCUIT_OPEN','SCRAPPA_QUOTA'].includes(err.code);
  const invalidated=e instanceof Error&&['profile_unverified','scrappa_http_404'].includes(e.message);
  await query('UPDATE scrappa_profile_checks SET completed_at=now(),last_error=$3,profile=CASE WHEN $4 THEN NULL ELSE profile END,checked_at=CASE WHEN $4 THEN NULL ELSE checked_at END WHERE handle=$1 AND attempt_id=$2',[handle,attemptId,preflight?'preflight':err.code,invalidated]);
  throw err;
 }
}
/** Stage only a recent verified result; never spends a credit. */
export async function stageVerifiedCandidate(raw:string,person?:string,niche?:string){
 const handle=normalizeHandle(raw);
 return transaction(async c=>{
  const cached=(await c.query<{profile:CheckedProfile;checked_at:Date}>("SELECT profile,checked_at FROM scrappa_profile_checks WHERE handle=$1 AND profile IS NOT NULL AND checked_at>now()-interval '24 hours' FOR SHARE",[handle])).rows[0];
  if(!cached)throw new HttpError(409,'SCRAPPA_CHECK_REQUIRED','Check this creator successfully before staging (valid for 24 hours)');
  const p=cached.profile;
  if((await c.query('SELECT 1 FROM scrappa_candidates WHERE handle=$1 AND external_id<>$2',[p.handle,p.accountId])).rowCount)throw new HttpError(409,'SCRAPPA_IDENTITY_CONFLICT','This handle is already assigned to a different account; review it before staging');
  await c.query(`INSERT INTO scrappa_candidates(external_id,handle,display_name,person_name,niche,checked_at) VALUES($1,$2,$3,$4,$5,$6)
    ON CONFLICT(external_id) DO UPDATE SET published_at=CASE WHEN scrappa_candidates.handle=excluded.handle THEN scrappa_candidates.published_at ELSE NULL END,
    handle=excluded.handle,display_name=excluded.display_name,person_name=COALESCE(excluded.person_name,scrappa_candidates.person_name),niche=COALESCE(excluded.niche,scrappa_candidates.niche),checked_at=excluded.checked_at`,[p.accountId,p.handle,p.name,person||null,niche||null,cached.checked_at]);
  return {handle:p.handle};
 });
}
