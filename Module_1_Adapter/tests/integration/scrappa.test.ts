// Test database only. Fake fetch fixtures; no Scrappa credentials/network needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pool,query} from '../../src/lib/db.js';
import {encryptSecret} from '../../src/lib/security.js';
import {collectCandidate,ensureScrappaSchema,refreshScrappaCandidates} from '../../src/modules/scrappa/admin.js';
import {storeTikTokCandidate} from '../../src/modules/creators-bucket/tiktok-staging.js';
import {collect} from '../../src/modules/scrappa/collector.js';
if(process.env.NODE_ENV!=='test'||!/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL??''))throw new Error('Scrappa tests require a separate *_test database');
const id='998877665544332211', other='998877665544332212';
const month="date_trunc('month',now() AT TIME ZONE 'UTC')::date";
const profile={code:0,data:{user:{id,uniqueId:'pci_fixture',privateAccount:false},stats:{followerCount:123,heartCount:456,videoCount:10}}};
const videos=Array.from({length:10},(_,i)=>({video_id:String(100+i),author:{id},create_time:1700000000-i,is_ad:false,is_top:0,duration:10,play_count:100+i,digg_count:10,comment_count:2,share_count:1}));
const fixture=(partial=false):typeof fetch=>async u=>Response.json(String(u).includes('/profile')?profile:{code:0,data:{videos:partial?videos.slice(0,3):videos}});
const key='fixture-key-no-network';
const prefix='tiktok_candidate:'+id;
async function clean(){
 await query("DELETE FROM ingest_latest WHERE source_id='scrappa.api'");
 await query("DELETE FROM ingest_observations WHERE source_id='scrappa.api'");
 await query("DELETE FROM ingest_jobs WHERE source_id='scrappa.api'");
 await query('DELETE FROM scrappa_candidates');await query('DELETE FROM scrappa_admin_keys');await query('DELETE FROM scrappa_credit_month');
 await query("DELETE FROM people WHERE slug='pci-scrappa-fixture'");
 await query("DELETE FROM hub_source_health WHERE source_id='scrappa.api'");
 await query("UPDATE ingest_sources SET enabled=false,last_error=NULL,last_success_at=NULL,last_attempt_at=NULL WHERE id='scrappa.api'");
}
test.before(async()=>{await ensureScrappaSchema();await ensureScrappaSchema();await clean();});
test.beforeEach(async()=>{await clean();await query('INSERT INTO scrappa_admin_keys(label,fingerprint,ciphertext,active) VALUES($1,$2,$3,true)',['fixture','fixture',encryptSecret(key)]);await query('INSERT INTO scrappa_candidates(external_id,handle) VALUES($1,$2)',[id,'pci_fixture']);});
test.after(async()=>{await clean();await pool.end();});
test('collection persists coherent history and clears stale projected averages',async()=>{
 const first=await collectCandidate(id,'manual',null,fixture());assert.equal(first.analytics.averageViews,104.5);
 const second=await collectCandidate(id,'manual',null,fixture(true));assert.equal(second.analytics.averageViews,null);
 const jobs=(await query('SELECT status FROM ingest_jobs WHERE id=ANY($1::uuid[]) ORDER BY created_at',[[first.runId,second.runId]])).rows;assert.deepEqual(jobs.map(r=>r.status),['succeeded','partial']);
 assert.equal((await query('SELECT count(*)::int AS n FROM scrappa_snapshots WHERE external_id=$1',[id])).rows[0].n,2);
 assert.equal((await query("SELECT count(*)::int AS n FROM ingest_latest WHERE entity_id=$1 AND metric='average_views'",[prefix])).rows[0].n,0);
 assert.equal((await query("SELECT count(*)::int AS n FROM ingest_observations WHERE entity_id=$1 AND metric='average_views'",[prefix])).rows[0].n,1);
 assert.equal((await query(`SELECT used FROM scrappa_credit_month WHERE month=${month}`)).rows[0].used,4);
 assert.equal((await query("SELECT count(*)::int AS n FROM accounts WHERE platform='tiktok' AND external_id=$1",[id])).rows[0].n,0);
});
test('database lease blocks concurrent collection and rejects expired writer',async()=>{
 let entered!:()=>void,release!:()=>void;
 const started=new Promise<void>(resolve=>{entered=resolve;});const gate=new Promise<void>(resolve=>{release=resolve;});
 const first=collectCandidate(id,'manual',null,async u=>{entered();await gate;return fixture()(u);});
 await started;
 try{await assert.rejects(collectCandidate(id,'manual',null,fixture()),/Another collection is running/);}finally{release();}
 await first;
 const old=(await query("INSERT INTO ingest_jobs(source_id,trigger,status,started_at) VALUES('scrappa.api','manual','running',now()-interval '6 minutes') RETURNING id")).rows[0].id;
 const sample=await collect('pci_fixture',key,async()=>true,fixture());
 await assert.rejects(storeTikTokCandidate(old,sample),/collection_lease_expired/);
});
test('scheduled ceiling reserves manual budget and honors disabled source',async()=>{
 await query(`INSERT INTO scrappa_credit_month(month,used) VALUES(${month},397)`);
 const old=process.env.PCI_SCRAPPA_AUTO_REFRESH;process.env.PCI_SCRAPPA_AUTO_REFRESH='true';
 let calls=0;const fetcher:typeof fetch=async u=>{calls++;return fixture()(u);};
 try{
  await refreshScrappaCandidates(fetcher);assert.equal(calls,0);
  await query("UPDATE ingest_sources SET enabled=true WHERE id='scrappa.api'");await refreshScrappaCandidates(fetcher);assert.equal(calls,0);
  await query(`UPDATE scrappa_credit_month SET used=396 WHERE month=${month}`);await refreshScrappaCandidates(fetcher);assert.equal(calls,2);
  await refreshScrappaCandidates(fetcher);assert.equal(calls,2);
  await query(`UPDATE scrappa_credit_month SET used=497 WHERE month=${month}`);await assert.rejects(collectCandidate(id,'manual',null,fetcher),/Insufficient credit budget/);assert.equal(calls,2);
 }finally{if(old===undefined)delete process.env.PCI_SCRAPPA_AUTO_REFRESH;else process.env.PCI_SCRAPPA_AUTO_REFRESH=old;}
});
test('explicit one-to-one identity mapping does not publish an account',async()=>{
 const person=(await query("INSERT INTO people(slug,display_name) VALUES('pci-scrappa-fixture','Fixture') RETURNING id")).rows[0].id;
 await query('UPDATE scrappa_candidates SET person_id=$1 WHERE external_id=$2',[person,id]);
 await assert.rejects(query('INSERT INTO scrappa_candidates(external_id,handle,person_id) VALUES($1,$2,$3)',[other,'other_fixture',person]),/scrappa_candidate_person_uq/);
 await query('DELETE FROM people WHERE id=$1',[person]);assert.equal((await query('SELECT person_id FROM scrappa_candidates WHERE external_id=$1',[id])).rows[0].person_id,null);
});
