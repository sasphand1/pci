import type {PoolClient} from 'pg';
import {query,transaction} from '../../lib/db.js';
import {HttpError} from '../../lib/errors.js';
import {canCancel,effectiveDeliveryState,sameDraft,sameReceipt,summarize,type Delivery,type Destination,type Draft,type JobState,type Receipt} from './model.js';

type Job={id:string;title:string;body:string;media_ref:string|null;state:JobState;created_at:Date;confirmed_at:Date|null;cancelled_at:Date|null};
const fields='id,title,body,media_ref,state,created_at,confirmed_at,cancelled_at';
const deliveryFields='id,destination,state,claim_deadline,external_id,result_code';
const conflict=(message:string)=>new HttpError(409,'BROADCAST_CONFLICT',message);
async function event(c:PoolClient,jobId:string,name:string,actor:string|null,deliveryId:string|null=null,metadata:object={}){
 await c.query('INSERT INTO broadcast.events(job_id,delivery_id,actor_id,event,metadata) VALUES($1,$2,$3,$4,$5::jsonb)',[jobId,deliveryId,actor,name,JSON.stringify(metadata)]);
 if(actor)await c.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[actor,`broadcast.${name}`,jobId,JSON.stringify(metadata)]);
}
async function lockedJob(c:PoolClient,id:string):Promise<Job>{
 const r=await c.query<Job>(`SELECT ${fields} FROM broadcast.jobs WHERE id=$1 FOR UPDATE`,[id]);
 if(!r.rows[0])throw new HttpError(404,'BROADCAST_NOT_FOUND','Broadcast not found');
 return r.rows[0];
}
async function deliveries(c:PoolClient,id:string){return (await c.query<Delivery>(`SELECT ${deliveryFields} FROM broadcast.deliveries WHERE job_id=$1 ORDER BY destination`,[id])).rows;}
function present(job:Job,items:Delivery[]){
 const now=Date.now();return {...job,status:summarize(job.state,items,now),deliveries:items.map(d=>({...d,status:effectiveDeliveryState(d,now)}))};
}
export async function getJob(id:string){
 // Lock for a consistent snapshot across the job, deliveries and event log.
 return transaction(async c=>{
  const job=await lockedJob(c,id);const items=await deliveries(c,id);
  const history=(await c.query('SELECT id,event,delivery_id,actor_id,created_at,metadata FROM broadcast.events WHERE job_id=$1 ORDER BY id DESC LIMIT 100',[id])).rows;
  return {...present(job,items),history};
 });
}
export async function listJobs(){
 // Single SQL snapshot; return only the latest 50, not unbounded history.
 const rows=(await query<Job & {items:Delivery[]}>(`SELECT j.*,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',d.id,'destination',d.destination,'state',d.state,'claim_deadline',d.claim_deadline,'external_id',d.external_id,'result_code',d.result_code) ORDER BY d.destination) FROM broadcast.deliveries d WHERE d.job_id=j.id),'[]'::jsonb) AS items FROM (SELECT ${fields} FROM broadcast.jobs ORDER BY created_at DESC,id DESC LIMIT 50) j ORDER BY j.created_at DESC,j.id DESC`)).rows;
 return rows.map(({items,...job})=>present(job,items));
}
export async function createDraft(actor:string,draft:Draft){
 return transaction(async c=>{
  const r=await c.query<Job>(`INSERT INTO broadcast.jobs(request_id,created_by,title,body,media_ref) VALUES($1,$2,$3,$4,$5) ON CONFLICT(created_by,request_id) DO NOTHING RETURNING ${fields}`,[draft.requestId,actor,draft.title,draft.body,draft.mediaRef]);
  if(!r.rows[0]){
   const old=(await c.query<Job>(`SELECT ${fields} FROM broadcast.jobs WHERE created_by=$1 AND request_id=$2 FOR UPDATE`,[actor,draft.requestId])).rows[0];
   const items=await deliveries(c,old.id);
   if(!sameDraft({title:old.title,body:old.body,mediaRef:old.media_ref,destinations:items.map(d=>d.destination)},draft))throw conflict('Request identifier already belongs to a different draft');
   return present(old,items);
  }
  const job=r.rows[0];
  for(const destination of draft.destinations)await c.query('INSERT INTO broadcast.deliveries(job_id,destination) VALUES($1,$2)',[job.id,destination]);
  await event(c,job.id,'draft_created',actor,null,{destinations:draft.destinations});
  return present(job,await deliveries(c,job.id));
 });
}
export async function confirmJob(id:string,actor:string){
 return transaction(async c=>{
  let job=await lockedJob(c,id);const items=await deliveries(c,id);
  if(job.state==='confirmed')return present(job,items);
  if(job.state!=='draft'||!items.length)throw conflict('Only a nonempty draft can be confirmed');
  job=(await c.query<Job>(`UPDATE broadcast.jobs SET state='confirmed',confirmed_by=$2,confirmed_at=now() WHERE id=$1 RETURNING ${fields}`,[id,actor])).rows[0];
  await event(c,id,'confirmed',actor);
  return present(job,items);
 });
}
export async function cancelJob(id:string,actor:string){
 return transaction(async c=>{
  let job=await lockedJob(c,id);const items=await deliveries(c,id);
  if(job.state==='cancelled')return present(job,items);
  if(!canCancel(job.state,items.map(d=>d.state)))throw conflict('Dispatch has begun; cancellation cannot revoke external delivery');
  await c.query("UPDATE broadcast.deliveries SET state='cancelled',finished_at=now() WHERE job_id=$1 AND state='pending'",[id]);
  job=(await c.query<Job>(`UPDATE broadcast.jobs SET state='cancelled',cancelled_by=$2,cancelled_at=now() WHERE id=$1 RETURNING ${fields}`,[id,actor])).rows[0];
  await event(c,id,'cancelled',actor);
  return present(job,await deliveries(c,id));
 });
}
// The caller generates a fresh UUID per poll. Retrying the same UUID never leases another delivery.
// A replay returns no work: the first response might already have started external delivery.
export async function claimDelivery(destination:Destination,claimId:string){
 return transaction(async c=>{
  // Serializes simultaneous requests reusing the same UUID, independent of job locks.
  await c.query('SELECT pg_advisory_xact_lock(710442,hashtext($1))',[claimId]);
  const previous=await c.query('SELECT id FROM broadcast.deliveries WHERE claim_id=$1',[claimId]);
  if(previous.rowCount)throw conflict('Claim already issued; do not send again');
  // Lock the parent before the delivery, matching confirm/cancel/receipt lock order.
  const job=(await c.query<Job>(`SELECT ${fields} FROM broadcast.jobs j WHERE j.state='confirmed' AND EXISTS(SELECT 1 FROM broadcast.deliveries d WHERE d.job_id=j.id AND d.destination=$1 AND d.state='pending') ORDER BY j.confirmed_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`,[destination])).rows[0];
  if(!job)return null;
  const item=(await c.query<{id:string;claim_deadline:Date}>(`UPDATE broadcast.deliveries SET state='claimed',claim_id=$3,claimed_at=now(),claim_deadline=now()+interval '15 minutes' WHERE job_id=$1 AND destination=$2 AND state='pending' RETURNING id,claim_deadline`,[job.id,destination,claimId])).rows[0];
  if(!item)return null;
  await event(c,job.id,'claimed',null,item.id,{destination});
  return {jobId:job.id,deliveryId:item.id,claimId,destination,idempotencyKey:item.id,deadline:item.claim_deadline,title:job.title,body:job.body,mediaRef:job.media_ref};
 });
}
// Read-only recovery for a lost claim response: does not disclose a payload or authorize a resend.
export async function lookupClaim(claimId:string){
 const d=(await query<Delivery & {job_id:string}>(`SELECT ${deliveryFields},job_id FROM broadcast.deliveries WHERE claim_id=$1`,[claimId])).rows[0];
 return d?{jobId:d.job_id,deliveryId:d.id,destination:d.destination,status:effectiveDeliveryState(d),deadline:d.claim_deadline,externalId:d.external_id,code:d.result_code}:null;
}
export async function recordReceipt(deliveryId:string,claimId:string,receipt:Receipt){
 return transaction(async c=>{
  const found=(await c.query<{job_id:string}>('SELECT job_id FROM broadcast.deliveries WHERE id=$1',[deliveryId])).rows[0];
  if(!found)throw new HttpError(404,'BROADCAST_NOT_FOUND','Delivery not found');
  await lockedJob(c,found.job_id);
  const d=(await c.query<Delivery & {claim_id:string|null}>(`SELECT ${deliveryFields},claim_id FROM broadcast.deliveries WHERE id=$1 FOR UPDATE`,[deliveryId])).rows[0];
  if(d.claim_id!==claimId)throw conflict('Claim does not match delivery');
  if(d.state!=='claimed'){
   if(sameReceipt({outcome:d.state as Receipt['outcome'],externalId:d.external_id,code:d.result_code},receipt))return {deliveryId,state:d.state};
   // An unknown result may be reconciled by a later definitive provider receipt; never re-dispatch.
   if(d.state!=='uncertain'||receipt.outcome==='uncertain')throw conflict('A different terminal receipt is already recorded');
  }
  await c.query('UPDATE broadcast.deliveries SET state=$2,external_id=$3,result_code=$4,finished_at=now() WHERE id=$1',[deliveryId,receipt.outcome,receipt.externalId,receipt.code]);
  await event(c,found.job_id,`receipt_${receipt.outcome}`,null,deliveryId,{code:receipt.code,externalId:receipt.externalId});
  return {deliveryId,state:receipt.outcome};
 });
}
