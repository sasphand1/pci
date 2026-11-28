// Test database only. Fake fetch fixtures; no Scrappa credentials/network needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {pool,query} from '../../src/lib/db.js';
import {encryptSecret} from '../../src/lib/security.js';
import {collectCandidate,collectPending,registerPending,ensureScrappaSchema,refreshScrappaCandidates} from '../../src/modules/scrappa/admin.js';
import {storeTikTokCandidate} from '../../src/modules/creators-bucket/tiktok-staging.js';
import {collect} from '../../src/modules/scrappa/collector.js';
import {checkProfile,stageVerifiedCandidate} from '../../src/modules/scrappa/checks.js';
import {keyUsage,reserveFor} from '../../src/modules/scrappa/credits.js';
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
 await query('DELETE FROM scrappa_credit_ledger');await query('DELETE FROM scrappa_key_credit_month');await query('DELETE FROM scrappa_profile_checks');
 await query("DELETE FROM ingest_jobs WHERE source_id='scrappa.api'");
 await query('DELETE FROM scrappa_pending_accounts');await query('DELETE FROM scrappa_candidates');await query('DELETE FROM scrappa_admin_keys');await query('DELETE FROM scrappa_credit_month');
 await query("DELETE FROM people WHERE slug='pci-scrappa-fixture'");
 await query("DELETE FROM hub_source_health WHERE source_id='scrappa.api'");
 await query("UPDATE ingest_sources SET enabled=false,last_error=NULL,last_success_at=NULL,last_attempt_at=NULL WHERE id='scrappa.api'");
}
test.before(async()=>{await ensureScrappaSchema();await ensureScrappaSchema();await clean();});
test.beforeEach(async()=>{await clean();await query('INSERT INTO scrappa_admin_keys(label,fingerprint,ciphertext,active,monthly_cap) VALUES($1,$2,$3,true,500)',['fixture','fixture',encryptSecret(key)]);await query('INSERT INTO scrappa_candidates(external_id,handle) VALUES($1,$2)',[id,'pci_fixture']);});
test.after(async()=>{await clean();await pool.end();});
test('collection persists coherent history and clears stale projected averages',async()=>{
 const first=await collectCandidate(id,'manual',null,fixture());assert.equal(first.analytics.averageViews,104.5);
 const second=await collectCandidate(id,'manual',null,fixture(true));assert.equal(second.analytics.averageViews,null);
 const jobs=(await query('SELECT status FROM ingest_jobs WHERE id=ANY($1::uuid[]) ORDER BY created_at',[[first.runId,second.runId]])).rows;assert.deepEqual(jobs.map(r=>r.status),['succeeded','partial']);
 assert.equal((await query('SELECT count(*)::int AS n FROM scrappa_snapshots WHERE external_id=$1',[id])).rows[0].n,2);
 assert.equal((await query("SELECT count(*)::int AS n FROM ingest_latest WHERE entity_id=$1 AND metric='average_views'",[prefix])).rows[0].n,0);
 assert.equal((await query("SELECT count(*)::int AS n FROM ingest_observations WHERE entity_id=$1 AND metric='average_views'",[prefix])).rows[0].n,1);
 assert.equal((await query(`SELECT used FROM scrappa_credit_month WHERE month=${month}`)).rows[0].used,4);
 assert.equal((await keyUsage())[0].used,4);assert.equal((await query('SELECT count(*)::int n FROM scrappa_credit_ledger')).rows[0].n,4);
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
 await query(`INSERT INTO scrappa_key_credit_month(key_id,month,used) SELECT id,${month},397 FROM scrappa_admin_keys WHERE active`);
 const old=process.env.PCI_SCRAPPA_AUTO_REFRESH;process.env.PCI_SCRAPPA_AUTO_REFRESH='true';
 let calls=0;const fetcher:typeof fetch=async u=>{calls++;return fixture()(u);};
 try{
  await refreshScrappaCandidates(fetcher);assert.equal(calls,0);
  await query("UPDATE ingest_sources SET enabled=true WHERE id='scrappa.api'");await refreshScrappaCandidates(fetcher);assert.equal(calls,0);
  await query(`UPDATE scrappa_key_credit_month SET used=396 WHERE month=${month}`);await refreshScrappaCandidates(fetcher);assert.equal(calls,2);
  await refreshScrappaCandidates(fetcher);assert.equal(calls,2);
  await query(`UPDATE scrappa_key_credit_month SET used=497 WHERE month=${month}`);await assert.rejects(collectCandidate(id,'manual',null,fetcher),/Insufficient credit budget/);assert.equal(calls,2);
 }finally{if(old===undefined)delete process.env.PCI_SCRAPPA_AUTO_REFRESH;else process.env.PCI_SCRAPPA_AUTO_REFRESH=old;}
});
test('explicit one-to-one identity mapping does not publish an account',async()=>{
 const person=(await query("INSERT INTO people(slug,display_name) VALUES('pci-scrappa-fixture','Fixture') RETURNING id")).rows[0].id;
 await query('UPDATE scrappa_candidates SET person_id=$1 WHERE external_id=$2',[person,id]);
 await assert.rejects(query('INSERT INTO scrappa_candidates(external_id,handle,person_id) VALUES($1,$2,$3)',[other,'other_fixture',person]),/scrappa_candidate_person_uq/);
 await query('DELETE FROM people WHERE id=$1',[person]);assert.equal((await query('SELECT person_id FROM scrappa_candidates WHERE external_id=$1',[id])).rows[0].person_id,null);
});
test('public TikTok route exposes only approved latest snapshots and revokes visibility',async()=>{
 const {default:express}=await import('express');const {default:request}=await import('supertest');
 const {publicTikTokRoutes}=await import('../../src/modules/public/tiktok.js');
 const app=express();app.use('/tiktok',publicTikTokRoutes);
 await collectCandidate(id,'manual',null,fixture());
 assert.equal((await request(app).get('/tiktok').expect(200)).body.data.length,0);
 await query('UPDATE scrappa_candidates SET published_at=now() WHERE external_id=$1',[id]);
 const r=(await request(app).get('/tiktok?handle=pci_fixture').expect(200)).body.data;
 assert.equal(r.length,1);assert.equal(r[0].followers,123);assert.equal(r[0].rank,1);assert.equal(r[0].external_id,undefined);
 await query('UPDATE scrappa_candidates SET published_at=NULL WHERE external_id=$1',[id]);
 assert.equal((await request(app).get('/tiktok').expect(200)).body.data.length,0);
});

test('approved TikTok identity ranks through Hub projection, central gates and published pointers',async()=>{
 const {transaction}=await import('../../src/lib/db.js');
 const {registerCentralTikTokIdentity}=await import('../../src/modules/creators-bucket/tiktok-identity.js');
 const {buildBatch,publishBatch}=await import('../../src/modules/publish/service.js');
 const {readCentralTikTok}=await import('../../src/modules/creators-bucket/tiktok-central.js');
 const {default:express}=await import('express');const {default:request}=await import('supertest');
 const {publicTikTokRoutes}=await import('../../src/modules/public/tiktok.js');
 const old=process.env.PCI_TIKTOK_CENTRAL;process.env.PCI_TIKTOK_CENTRAL='prepare';
 try{
  await collectCandidate(id,'manual',null,fixture());
  await query("INSERT INTO people(slug,display_name) VALUES('pci-scrappa-fixture','Fixture')");
  // Only this fixture is approved. No creator identities or credentials are inferred.
  assert.equal((await query('SELECT count(*)::int AS n FROM public.hub_tiktok_registered')).rows[0].n,0);
  await transaction(c=>registerCentralTikTokIdentity(c,id,{mode:'existing',personSlug:'pci-scrappa-fixture',confirm:true},null));
  assert.equal((await query('SELECT count(*)::int AS n FROM public.hub_tiktok_registered')).rows[0].n,1);
  process.env.PCI_TIKTOK_CENTRAL='active';
  const app=express();app.use('/tiktok',publicTikTokRoutes);
  assert.equal((await request(app).get('/tiktok').expect(200)).body.data.length,0);
  const batch=await buildBatch('manual',null);const published=await publishBatch(batch.batchId,null);
  assert.ok(published.published.includes('tiktok.followers'));assert.ok(published.published.includes('tiktok.average_views'));
  const followers=(await request(app).get('/tiktok?metric=followers').expect(200)).body.data;
  assert.equal(followers[0].followers,123);assert.equal(followers[0].rank,1);
  const averages=await readCentralTikTok({query},'averageViews');assert.equal(averages[0].averageViews,104.5);
  await query('UPDATE scrappa_candidates SET published_at=NULL WHERE external_id=$1',[id]);
  assert.equal((await request(app).get('/tiktok').expect(200)).body.data.length,0);
 }finally{
  if(old===undefined)delete process.env.PCI_TIKTOK_CENTRAL;else process.env.PCI_TIKTOK_CENTRAL=old;
  await query("DELETE FROM published_pointers WHERE scope LIKE 'tiktok.%'");await query("DELETE FROM rank_runs WHERE scope LIKE 'tiktok.%'");
 }
});

test('Check then Stage uses exactly one credit; repeated check uses cached data',async()=>{
 let calls=0;const fetcher:typeof fetch=async u=>{calls++;return fixture()(u);};
 await assert.rejects(stageVerifiedCandidate('pci_fixture'),/Check this creator successfully/);
 assert.equal((await checkProfile('@PCI_FIXTURE',false,fetcher)).cached,false);
 assert.equal((await checkProfile('https://www.tiktok.com/@pci_fixture',false,fetcher)).cached,true);
 await stageVerifiedCandidate('pci_fixture','Fixture','tech');await stageVerifiedCandidate('@pci_fixture');
 assert.equal(calls,1);assert.equal((await keyUsage())[0].used,1);
 await query("UPDATE scrappa_profile_checks SET checked_at=now()-interval '25 hours',attempted_at=now()-interval '25 hours'");
 await assert.rejects(stageVerifiedCandidate('pci_fixture'),/Check this creator successfully/);
 assert.equal((await checkProfile('pci_fixture',false,fetcher)).cached,false);assert.equal(calls,2);
});
test('concurrent check claim prevents double spend',async()=>{
 let entered!:()=>void,release!:()=>void;const started=new Promise<void>(r=>{entered=r;});const gate=new Promise<void>(r=>{release=r;});
 const one=checkProfile('pci_fixture',false,async u=>{entered();await gate;return fixture()(u);});await started;
 try{await assert.rejects(checkProfile('@pci_fixture',false,fixture()),/in progress/);}finally{release();}
 await one;assert.equal((await keyUsage())[0].used,1);
});
test('separate authorized credential balances; stopped key and retired/readded id retain accounting',async()=>{
 const first=(await keyUsage())[0];const second=(await query("INSERT INTO scrappa_admin_keys(label,fingerprint,ciphertext,monthly_cap) VALUES('second','second',$1,2) RETURNING id",[encryptSecret(key)])).rows[0].id;
 const reservation=await reserveFor(first.id,false)('profile','pci_fixture');assert.ok(reservation&&typeof reservation==='object');await reservation.finish(429);
 await assert.rejects(reserveFor(first.id,false)('profile','pci_fixture'),/paused/);
 await query('UPDATE scrappa_admin_keys SET active=false WHERE id=$1',[first.id]);await query('UPDATE scrappa_admin_keys SET active=true WHERE id=$1',[second]);
 for(let i=0;i<2;i++){const r=await reserveFor(second,false)('profile','pci_fixture');assert.ok(r&&typeof r==='object');await r.finish(200);}
 assert.equal(await reserveFor(second,false)('profile','pci_fixture'),false);
 const balances=await keyUsage();assert.equal(balances.find(k=>k.id===first.id)?.used,1);assert.equal(balances.find(k=>k.id===second)?.used,2);
 await query("UPDATE scrappa_admin_keys SET retired_at=now(),ciphertext='' WHERE id=$1",[first.id]);assert.equal((await keyUsage()).length,1);
 await query('UPDATE scrappa_admin_keys SET retired_at=NULL,ciphertext=$2 WHERE id=$1',[first.id,encryptSecret(key)]);assert.equal((await keyUsage()).find(k=>k.id===first.id)?.used,1);
});
test('ambiguous transport remains charged, failure ledger and check cache prevent silent retries',async()=>{
 let calls=0;const fetcher:typeof fetch=async()=>{calls++;throw Error('network');};
 await assert.rejects(checkProfile('pci_fixture',false,fetcher),/reserved credit retained/);
 await assert.rejects(checkProfile('pci_fixture',false,fetcher),/recent check failed/);
 assert.equal(calls,1);assert.equal((await keyUsage())[0].used,1);assert.equal((await query('SELECT outcome FROM scrappa_credit_ledger')).rows[0].outcome,'ambiguous');
});

test('a definitive failed force recheck invalidates previous verified cache',async()=>{
 await checkProfile('pci_fixture',false,fixture());
 await assert.rejects(checkProfile('pci_fixture',true,async()=>new Response(null,{status:404})),/Profile lookup/);
 await assert.rejects(stageVerifiedCandidate('pci_fixture'),/Check this creator successfully/);
});
test('migration 132 preserves unallocated legacy usage and is idempotent',async()=>{
 const {readFile}=await import('node:fs/promises');const sql=await readFile(new URL('../../database/migrations/132_scrappa_credit_intelligence.sql',import.meta.url),'utf8');
 const client=await pool.connect();try{
  await client.query('BEGIN');await client.query('CREATE SCHEMA scrappa_migration_fixture');await client.query('SET LOCAL search_path TO scrappa_migration_fixture,pg_catalog');
  await client.query("CREATE TABLE ingest_jobs(id uuid PRIMARY KEY); CREATE TABLE scrappa_admin_keys(id uuid PRIMARY KEY DEFAULT gen_random_uuid()); CREATE TABLE scrappa_credit_month(month date PRIMARY KEY,used integer NOT NULL CHECK(used BETWEEN 0 AND 500)); INSERT INTO scrappa_admin_keys DEFAULT VALUES; INSERT INTO scrappa_admin_keys DEFAULT VALUES; INSERT INTO scrappa_credit_month VALUES('2026-01-01',42);");
  await client.query(sql);await client.query('INSERT INTO scrappa_admin_keys DEFAULT VALUES');await client.query(sql);
  const rows=(await client.query('SELECT used,legacy_used FROM scrappa_key_credit_month ORDER BY key_id')).rows;assert.deepEqual(rows,[{used:42,legacy_used:42},{used:42,legacy_used:42}]);
  await client.query("UPDATE scrappa_credit_month SET used=1000 WHERE month='2026-01-01'");
 }finally{await client.query('ROLLBACK');client.release();}
});

test('pending registration costs zero, first profile collection verifies and stores metrics once',async()=>{
 await query('DELETE FROM scrappa_candidates');
 const result=await registerPending([{account:'@PCI_FIXTURE',person:'Fixture',niche:'tech'},{account:'pci_fixture'},{account:'bad handle'}],null);
 assert.deepEqual(result.map(x=>x.status),['added','duplicate','invalid']);assert.equal((await keyUsage())[0].used,0);
 let calls=0;const fetcher:typeof fetch=async u=>{calls++;assert.match(String(u),/profile/);return fixture()(u);};
 await collectPending('pci_fixture','manual',null,fetcher);assert.equal(calls,1);assert.equal((await keyUsage())[0].used,1);
 assert.equal((await query('SELECT count(*)::int n FROM scrappa_pending_accounts')).rows[0].n,0);
 assert.equal((await query('SELECT person_name FROM scrappa_candidates WHERE external_id=$1',[id])).rows[0].person_name,'Fixture');
 assert.equal(Number((await query("SELECT value_numeric FROM ingest_latest WHERE entity_id=$1 AND metric='followers'",[prefix])).rows[0].value_numeric),123);
 assert.equal((await query('SELECT published_at FROM scrappa_candidates WHERE external_id=$1',[id])).rows[0].published_at,null);
 await assert.rejects(collectPending('pci_fixture','manual',null,fetcher),/Pending creator not found/);assert.equal(calls,1);
});
