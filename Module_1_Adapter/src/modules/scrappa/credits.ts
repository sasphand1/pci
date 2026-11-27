import type {PoolClient} from 'pg';
import {query,transaction} from '../../lib/db.js';
import {HttpError} from '../../lib/errors.js';
import {breakerReason,monthlyCap,scheduledCeiling,type CreditEvent} from './credit-policy.js';
import type {ReserveCredit} from './collector.js';
const month="date_trunc('month',now() AT TIME ZONE 'UTC')::date";
export type ActiveKey={id:string;ciphertext:string;monthly_cap:number};
export async function activeKey(client?:PoolClient):Promise<ActiveKey>{
 const sql='SELECT id,ciphertext,monthly_cap FROM scrappa_admin_keys WHERE active AND retired_at IS NULL';
 const key=(client?await client.query<ActiveKey>(sql):await query<ActiveKey>(sql)).rows[0];
 if(!key)throw new HttpError(409,'SCRAPPA_KEY_MISSING','Owner must activate a Scrappa key');
 return key;
}
export async function keyUsage(){
 return (await query<{id:string;label:string;active:boolean;cap:number;used:number;legacyUsed:number;remaining:number;lastRequestAt:string|null}>(`SELECT k.id,k.label,k.active,k.monthly_cap AS cap,COALESCE(m.used,0)::int AS used,COALESCE(m.legacy_used,0)::int AS "legacyUsed",GREATEST(0,k.monthly_cap-COALESCE(m.used,0))::int AS remaining,
 (SELECT max(l.reserved_at) FROM scrappa_credit_ledger l WHERE l.key_id=k.id) AS "lastRequestAt"
 FROM scrappa_admin_keys k LEFT JOIN scrappa_key_credit_month m ON m.key_id=k.id AND m.month=${month}
 WHERE k.retired_at IS NULL ORDER BY k.label,k.id`)).rows;
}
export async function remainingCredits(keyId:string,scheduled:boolean,client?:PoolClient){
 const sql=`SELECT k.monthly_cap AS cap,COALESCE(m.used,0)::int AS used FROM scrappa_admin_keys k LEFT JOIN scrappa_key_credit_month m ON m.key_id=k.id AND m.month=${month} WHERE k.id=$1 AND k.active AND k.retired_at IS NULL`;
 const r=(client?await client.query<{cap:number;used:number}>(sql,[keyId]):await query<{cap:number;used:number}>(sql,[keyId])).rows[0];
 return r?Math.max(0,(scheduled?scheduledCeiling(r.cap):r.cap)-r.used):0;
}
/** Reserve and journal in one transaction. No automatic refund: transport failure is ambiguous. */
export function reserveFor(keyId:string,scheduled:boolean,runId:string|null=null):ReserveCredit{
 return async(endpoint,handle)=>{
  const id=await transaction(async c=>{
   // Serializes reservations, key activation and retirement for the chosen credential.
   await c.query('SELECT pg_advisory_xact_lock(710329)');
   const key=(await c.query<{monthly_cap:number}>('SELECT monthly_cap FROM scrappa_admin_keys WHERE id=$1 AND active AND retired_at IS NULL FOR UPDATE',[keyId])).rows[0];
   if(!key)throw new HttpError(409,'SCRAPPA_KEY_CHANGED','Active credential changed; no new request sent');
   const recent=(await c.query<CreditEvent>(`WITH recent AS (SELECT id,outcome,http_status,transport_failure,reserved_at FROM scrappa_credit_ledger WHERE key_id=$1 AND reserved_at>now()-interval '24 hours' ORDER BY reserved_at DESC,id DESC LIMIT 3),
    stops AS (SELECT id,outcome,http_status,transport_failure,reserved_at FROM scrappa_credit_ledger WHERE key_id=$1 AND reserved_at>now()-interval '24 hours' AND (http_status IN (401,402,403,429) OR (outcome='reserved' AND reserved_at>now()-interval '2 minutes')) ORDER BY reserved_at DESC,id DESC LIMIT 2)
    SELECT * FROM recent UNION SELECT * FROM stops ORDER BY reserved_at DESC,id DESC`,[keyId])).rows;
   const breaker=breakerReason(recent);
   if(breaker)throw new HttpError(409,breaker==='request_in_flight'?'SCRAPPA_BUSY':'SCRAPPA_CIRCUIT_OPEN',`Scrappa requests paused: ${breaker.replace(/_/g,' ')}`);
   const cap=scheduled?scheduledCeiling(key.monthly_cap):monthlyCap(key.monthly_cap);
   if(cap===0)return null;
   const r=await c.query(`INSERT INTO scrappa_key_credit_month(key_id,month,used) VALUES($1,${month},1) ON CONFLICT(key_id,month) DO UPDATE SET used=scrappa_key_credit_month.used+1 WHERE scrappa_key_credit_month.used<$2 RETURNING used`,[keyId,cap]);
   if(!r.rowCount)return null;
   // Maintain the old shared total as a conservative rollback counter (not a new quota).
   await c.query(`INSERT INTO scrappa_credit_month(month,used) VALUES(${month},1) ON CONFLICT(month) DO UPDATE SET used=scrappa_credit_month.used+1`);
   return (await c.query<{id:string}>(`INSERT INTO scrappa_credit_ledger(key_id,run_id,month,endpoint,handle) VALUES($1,$2,${month},$3,$4) RETURNING id`,[keyId,runId,endpoint,handle])).rows[0].id;
  });
  if(!id)return false;
  return {finish:async(httpStatus:number|null,transportFailure=false)=>{
   // One durable outcome per reservation. A crashed process leaves a counted reservation.
   await query(`UPDATE scrappa_credit_ledger SET outcome=CASE WHEN $2::int IS NULL THEN 'ambiguous' ELSE 'response' END,http_status=$2,transport_failure=$3,finished_at=now() WHERE id=$1 AND outcome='reserved'`,[id,httpStatus,transportFailure]);
  }};
 };
}
export async function creditMonitor(includeKeys:boolean){
 const keys=await keyUsage(), active=keys.find(k=>k.active);
 const runs=(await query(`SELECT j.id,j.trigger,j.status,j.started_at,j.finished_at,j.error_code,
 (SELECT l.handle FROM scrappa_credit_ledger l WHERE l.run_id=j.id ORDER BY l.reserved_at LIMIT 1) AS handle,
 (SELECT count(*)::int FROM scrappa_credit_ledger l WHERE l.run_id=j.id) AS credits
 FROM ingest_jobs j WHERE j.source_id='scrappa.api' ORDER BY j.created_at DESC LIMIT 30`)).rows;
 const creators=(await query(`SELECT handle,last_attempt_at,last_success_at,last_error,
 GREATEST(COALESCE(last_success_at+interval '15 days',now()),COALESCE(last_attempt_at+interval '24 hours',now())) AS next_due_at
 FROM scrappa_candidates ORDER BY last_attempt_at DESC NULLS LAST,handle LIMIT 200`)).rows;
 const ledger=includeKeys?(await query(`SELECT l.id,k.label,l.endpoint,l.handle,l.outcome,l.http_status,l.transport_failure,l.reserved_at,l.finished_at FROM scrappa_credit_ledger l JOIN scrappa_admin_keys k ON k.id=l.key_id ORDER BY l.reserved_at DESC,l.id DESC LIMIT 100`)).rows:[];
 return {keys:includeKeys?keys:[],used:active?.used??0,limit:active?.cap??0,scheduledLimit:active?scheduledCeiling(active.cap):0,runs,creators,ledger};
}
