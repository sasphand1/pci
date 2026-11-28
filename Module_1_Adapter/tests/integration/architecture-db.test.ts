// Disposable database only. The CI workflow applies the repository migrations first.
import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {pool} from '../../src/lib/db.js';

if(process.env.NODE_ENV!=='test'||!/\/[^/]*_test(?:\?|$)/.test(process.env.DATABASE_URL??'')) {
 throw new Error('Architecture DB tests require a separate *_test database.');
}
const external='987654321098765432109876543210';
const key=`tiktok_candidate:${external}`;
const date='2026-11-28T00:00:00.000Z';
const metadata=JSON.stringify({stage:'candidate',candidateId:external});
async function isolated(fn:(c:pg.PoolClient)=>Promise<void>){
 const c=await pool.connect();
 try{await c.query('BEGIN');await fn(c);}finally{try{await c.query('ROLLBACK');}finally{c.release();}}
}
async function rejected(c:pg.PoolClient,fn:()=>Promise<unknown>,code:string){
 await c.query('SAVEPOINT violation');
 try{await assert.rejects(fn,(e:unknown)=>{
   const err=e as {code?:string;message?:string;hint?:string};
   return err.code==='23514'&&!!err.message?.includes(code)&&!!err.hint;
 });}finally{await c.query('ROLLBACK TO SAVEPOINT violation');await c.query('RELEASE SAVEPOINT violation');}
}
async function stage(c:pg.PoolClient){
 await c.query("INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label) VALUES('scrappa.api','tiktok','api',false,'creators',360,'Scrappa') ON CONFLICT(id) DO NOTHING");
 await c.query('INSERT INTO scrappa_candidates(external_id,handle) VALUES($1,$2)',[external,'pci_arch_fixture']);
 return (await c.query('INSERT INTO ingest_jobs(source_id,trigger,status,started_at) VALUES($1,$2,$3,now()) RETURNING id',['scrappa.api','manual','running'])).rows[0].id as string;
}
async function observation(c:pg.PoolClient,run:string,opts:{source?:string;entity?:string;metric?:string;metadata?:string;value?:number}={}){
 return c.query(`INSERT INTO ingest_observations(source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,value_scale,accuracy,observed_at,raw_metadata)
 VALUES($1,$2,NULL,'account',$3,$4,$5,0,'exact',$6,$7::jsonb)`,[opts.source??'scrappa.api',run,opts.entity??key,opts.metric??'followers',opts.value??123,date,opts.metadata??metadata]);
}
async function latest(c:pg.PoolClient,value=123){
 return c.query(`INSERT INTO ingest_latest(entity_kind,entity_id,metric,source_id,value_numeric,value_scale,accuracy,observed_at)
 VALUES('account',$1,'followers','scrappa.api',$2,0,'exact',$3)`,[key,value,date]);
}
async function run(c:pg.PoolClient,scope:string,status='published'){
 return (await c.query(`INSERT INTO rank_runs(batch_id,scope,policy_version,input_hash,status,trigger,published_at) VALUES(gen_random_uuid(),$1,'fixture','fixture',$2,'system',CASE WHEN $2='published' THEN now() ELSE NULL END) RETURNING id`,[scope,status])).rows[0].id as string;
}
const pointer=(c:pg.PoolClient,scope:string,id:string)=>c.query('INSERT INTO published_pointers(scope,run_id) VALUES($1,$2)',[scope,id]);
const flush=(c:pg.PoolClient)=>c.query('SET CONSTRAINTS ALL IMMEDIATE');
test.after(async()=>{await pool.end();});
test('valid staged history and projection are accepted',()=>isolated(async c=>{
 const id=await stage(c);await observation(c,id);await latest(c);
 assert.equal(Number((await c.query('SELECT value_numeric FROM ingest_latest WHERE entity_id=$1',[key])).rows[0].value_numeric),123);
}));
test('candidate namespace cannot be impersonated by another provider',()=>isolated(async c=>{
 const id=await stage(c);await rejected(c,()=>observation(c,id,{source:'youtube.api'}),'PCI_ARCH_DB_001');
}));
test('missing metadata, wrong entity and unapproved metric rejected by SQL',()=>isolated(async c=>{
 const id=await stage(c);
 for(const opts of [{metadata:'{}'},{entity:`tiktok:${external}`},{metric:'arbitrary'}])await rejected(c,()=>observation(c,id,opts),'PCI_ARCH_DB_002');
}));
test('invented, expired and completed collection leases are rejected',()=>isolated(async c=>{
 const id=await stage(c);
 await rejected(c,()=>observation(c,'invented'),'PCI_ARCH_DB_003');
 await c.query("UPDATE ingest_jobs SET started_at=now()-interval '6 minutes' WHERE id=$1",[id]);
 await rejected(c,()=>observation(c,id),'PCI_ARCH_DB_003');
 await c.query("UPDATE ingest_jobs SET started_at=now(),status='succeeded' WHERE id=$1",[id]);
 await rejected(c,()=>observation(c,id),'PCI_ARCH_DB_003');
}));
test('unregistered candidate rejected even with a valid lease',()=>isolated(async c=>{
 const id=await stage(c);await c.query('DELETE FROM scrappa_candidates WHERE external_id=$1',[external]);
 await rejected(c,()=>observation(c,id),'PCI_ARCH_DB_004');
}));
test('projection cannot invent a value or bypass history',()=>isolated(async c=>{
 const id=await stage(c);await rejected(c,()=>latest(c),'PCI_ARCH_DB_006');
 await observation(c,id);await rejected(c,()=>latest(c,999),'PCI_ARCH_DB_006');await latest(c);
}));
test('publication refuses draft and mismatched scope pointers at transaction boundary',()=>isolated(async c=>{
 const draft=await run(c,'category.pci-arch-draft','draft');
 await rejected(c,async()=>{await pointer(c,'category.pci-arch-draft',draft);await flush(c);},'PCI_ARCH_DB_007');
 const pub=await run(c,'category.pci-arch-one');
 await rejected(c,async()=>{await pointer(c,'category.pci-arch-two',pub);await flush(c);},'PCI_ARCH_DB_007');
}));
test('existing atomic publish/supersede sequence remains valid',()=>isolated(async c=>{
 const scope='category.pci-arch-swap',old=await run(c,scope),next=await run(c,scope,'draft');
 await pointer(c,scope,old);await c.query("UPDATE rank_runs SET status='superseded' WHERE id=$1",[old]);
 await c.query("UPDATE rank_runs SET status='published',published_at=now() WHERE id=$1",[next]);
 await c.query('UPDATE published_pointers SET run_id=$2 WHERE scope=$1',[scope,next]);await flush(c);
 assert.equal((await c.query('SELECT run_id FROM published_pointers WHERE scope=$1',[scope])).rows[0].run_id,next);
}));
test('a direct status downgrade cannot leave an invalid public pointer',()=>isolated(async c=>{
 const scope='category.pci-arch-status',id=await run(c,scope);await pointer(c,scope,id);await flush(c);
 await rejected(c,()=>c.query("UPDATE rank_runs SET status='draft' WHERE id=$1",[id]),'PCI_ARCH_DB_007');
}));
