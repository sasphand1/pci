import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {pool,query} from '../../src/lib/db.js';
import {ensureBroadcastSchema} from '../../src/lib/broadcast-schema.js';
import {cancelJob,claimDelivery,confirmJob,createDraft,getJob,lookupClaim,recordReceipt} from '../../src/modules/broadcast/service.js';
import type {Draft} from '../../src/modules/broadcast/model.js';
if(process.env.NODE_ENV!=='test'||!/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL??''))throw new Error('Broadcast DB tests require a separate *_test database');
let actor:string;
const draft=():Draft=>({requestId:randomUUID(),title:'Test',body:'Original payload',mediaRef:'test/asset',destinations:['youtube','instagram']});
async function clean(){await query('TRUNCATE broadcast.events,broadcast.deliveries,broadcast.jobs');await query('DELETE FROM admin_audit_logs WHERE actor_id=$1',[actor]);}
test.before(async()=>{await ensureBroadcastSchema();await ensureBroadcastSchema();actor=(await query("INSERT INTO admin_users(email,password_hash,role,totp_secret_enc) VALUES($1,'test','editor','test') RETURNING id",[`broadcast-test-${randomUUID()}@example.invalid`])).rows[0].id;await clean();});
test.beforeEach(clean);
test.after(async()=>{if(actor){await clean();await query('DELETE FROM admin_users WHERE id=$1',[actor]);}await pool.end();});
test('draft, idempotency, confirmation, cancel and history',async()=>{
 const input=draft();const a=await createDraft(actor,input);assert.equal(a.status,'draft');assert.equal(await claimDelivery('youtube',randomUUID()),null);
 assert.equal((await createDraft(actor,{...input,destinations:['instagram','youtube']})).id,a.id);
 await assert.rejects(createDraft(actor,{...input,title:'changed'}));
 assert.equal((await confirmJob(a.id,actor)).status,'queued');await confirmJob(a.id,actor);
 assert.equal((await cancelJob(a.id,actor)).status,'cancelled');assert.equal(await claimDelivery('youtube',randomUUID()),null);
 assert.equal((await getJob(a.id)).history.length,3);
});
test('concurrent claims cannot send a destination twice, receipts are idempotent',async()=>{
 const a=await createDraft(actor,draft());await confirmJob(a.id,actor);
 const claims=await Promise.all(Array.from({length:8},()=>claimDelivery('youtube',randomUUID())));
 const active=claims.filter(c=>c!==null);assert.equal(active.length,1);const c=active[0]!;
 await assert.rejects(claimDelivery('youtube',c.claimId));assert.equal((await lookupClaim(c.claimId))?.deliveryId,c.deliveryId);assert.equal(await lookupClaim(randomUUID()),null);await assert.rejects(cancelJob(a.id,actor));
 const receipt={outcome:'delivered' as const,externalId:'yt-provider-1',code:null};
 await assert.rejects(recordReceipt(c.deliveryId,randomUUID(),receipt));await recordReceipt(c.deliveryId,c.claimId,receipt);await recordReceipt(c.deliveryId,c.claimId,receipt);
 await assert.rejects(recordReceipt(c.deliveryId,c.claimId,{...receipt,externalId:'other'}));
 const i=(await claimDelivery('instagram',randomUUID()))!;await recordReceipt(i.deliveryId,i.claimId,{outcome:'failed',externalId:null,code:'REJECTED'});
 const result=await getJob(a.id);assert.equal(result.status,'partial');assert.equal(result.history.filter(e=>e.event==='receipt_delivered').length,1);
});
test('cancel and claim serialize; expired or unknown claims are not retried',async()=>{
 const a=await createDraft(actor,draft());await confirmJob(a.id,actor);
 const [claim,cancel]=await Promise.allSettled([claimDelivery('youtube',randomUUID()),cancelJob(a.id,actor)]);
 assert.equal(claim.status,'fulfilled');if(claim.status!=='fulfilled')return;
 if(!claim.value){assert.equal(cancel.status,'fulfilled');assert.equal((await getJob(a.id)).status,'cancelled');return;}
 assert.equal(cancel.status,'rejected');const c=claim.value;
 await query("UPDATE broadcast.deliveries SET claim_deadline=now()-interval '1 minute' WHERE id=$1",[c.deliveryId]);
 assert.equal((await getJob(a.id)).status,'attention');assert.equal(await claimDelivery('youtube',randomUUID()),null);
 await recordReceipt(c.deliveryId,c.claimId,{outcome:'uncertain',externalId:null,code:'TIMEOUT'});
 await recordReceipt(c.deliveryId,c.claimId,{outcome:'delivered',externalId:'reconciled-provider-id',code:null});
 assert.equal((await getJob(a.id)).deliveries.find(d=>d.id===c.deliveryId)?.state,'delivered');
});
