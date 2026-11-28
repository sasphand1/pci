import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MIGRATIONS,targetToken,verifiedMigrations,checkPending,checkReceipt,runRelease} from '../scripts/architecture-release.mjs';
const files=MIGRATIONS.map(([name,hash])=>({name,hash,sql:`TEST MIGRATION ${name}`}));
const time=new Date('2026-11-28T17:00:00Z');
const opts={token:'target-a',clock:()=>time,load:async()=>files};
const relations=['accounts','ingest_jobs','ingest_latest','ingest_observations','people','published_pointers','rank_runs','rank_slots','schema_migrations','scrappa_candidates','scrappa_snapshots'];
const expected=[['ingest_latest','pci_arch_latest_guard'],['ingest_latest','pci_arch_z_hub_route_guard'],['ingest_observations','pci_arch_observation_guard'],['ingest_observations','pci_arch_z_hub_route_guard'],['published_pointers','pci_arch_pointer_guard'],['rank_runs','pci_arch_run_guard']];
function fake({bad=0,fail=false,ledger=[],missing=false,missingGuard=false}={}){
  const log=[];let applied=[...ledger],active=false;
  return {log,async query(sql,params=[]){log.push(sql);
    let rows=[];
    if(sql.startsWith('SELECT current_database'))rows=[{database:'test',role:'owner',ledger_count:applied.length}];
    else if(sql.startsWith('SELECT version'))rows=applied.map(version=>({version}));
    else if(sql.startsWith('SELECT c.relname AS relation,a.attname'))rows=relations.filter(r=>!missing||r!=='accounts').map(relation=>({relation,column:'id'}));
    else if(sql.startsWith('SELECT c.relname AS relation,t.tgname'))rows=active?expected.slice(missingGuard?1:0).map(([relation,name])=>({relation,name,enabled:'O'})):[];
    else if(sql.startsWith('SELECT\n    (SELECT count'))rows=[{invalid_pointers:bad,missing_history:0,unregistered_public_tiktok:5}];
    else if(sql.startsWith('TEST MIGRATION')){if(fail&&sql.includes('135_'))throw Error('migration failed');if(sql.includes('135_'))active=true;}
    else if(sql.startsWith('INSERT INTO public.schema_migrations'))applied.push(params[0]);
    else if(sql==='ROLLBACK'){active=false;applied=[...ledger];}
    return {rows};
  }};
}
test('exact migration payload hashes match repository and only approved files load',async()=>{
 const m=await verifiedMigrations();assert.deepEqual(m.map(x=>x.name),MIGRATIONS.map(x=>x[0]));
 assert.ok(m.every(x=>!x.name.includes('128')));
});
test('modified payload rejected',async()=>{await assert.rejects(verifiedMigrations(async()=> 'SELECT 1'),/PCI_RELEASE_002/);});
test('target identity never includes credentials; Neon pooler and direct endpoint match',()=>{
 const a=targetToken('postgresql://owner:secret@ep-test-pooler.neon.tech/neondb?sslmode=require');
 const b=targetToken('postgresql://other:other@ep-test.neon.tech/neondb');
 assert.equal(a,b);assert.notEqual(a,targetToken('postgresql://owner:secret@ep-other.neon.tech/neondb'));assert.match(a,/^[a-f0-9]{64}$/);
});
test('plan is read only and reports unresolved TikTok',async()=>{
 const db=fake(),r=await runRelease(db,opts);assert.equal(r.readyForRehearsal,true);assert.equal(r.findings.unregistered_public_tiktok,5);assert.equal(r.historicalLedgerReconciled,false);
 assert.match(db.log[0],/READ ONLY/);assert.equal(db.log.at(-1),'ROLLBACK');assert.ok(!db.log.some(s=>s.startsWith('INSERT')||s.startsWith('TEST MIGRATION')));
});
test('rehearsal checks and rolls back both actual migration records',async()=>{
 const db=fake(),r=await runRelease(db,{...opts,mode:'rehearse'});assert.equal(r.result,'rolled_back_successfully');assert.equal(db.log.filter(s=>s.startsWith('INSERT INTO public.schema_migrations')).length,2);assert.equal(db.log.at(-1),'ROLLBACK');assert.ok(!db.log.includes('COMMIT'));
});
test('apply refuses without explicit opt-in before touching database',async()=>{
 const db=fake();await assert.rejects(runRelease(db,{...opts,mode:'apply',confirmation:opts.token}),/PCI_RELEASE_008/);assert.deepEqual(db.log,[]);
});
test('valid distinct clone receipt permits a single atomic apply',async()=>{
 const receipt=await runRelease(fake(),{...opts,token:'clone',mode:'rehearse'});const db=fake();
 const r=await runRelease(db,{...opts,mode:'apply',allowApply:true,confirmation:opts.token,receipt});assert.equal(r.result,'committed');assert.equal(db.log.at(-1),'COMMIT');assert.equal(db.log.filter(s=>s==='COMMIT').length,1);assert.equal(r.historicalLedgerReconciled,false);
});
test('same target, mismatched schema, migration hash, expired and future receipts rejected',async()=>{
 const receipt=await runRelease(fake(),{...opts,token:'clone',mode:'rehearse'});const evidence={schemaHash:receipt.schemaHash};
 for(const bad of [{...receipt,target:opts.token},{...receipt,schemaHash:'wrong'},{...receipt,migrations:[]},{...receipt,checkedAt:'2026-11-26T17:00:00Z'},{...receipt,checkedAt:'2026-11-29T17:00:00Z'}]) assert.throws(()=>checkReceipt(bad,opts.token,evidence,files,time.getTime()),/PCI_RELEASE_007/);
});
test('migration failure rolls back without committing or writing a false success receipt',async()=>{
 const db=fake({fail:true});await assert.rejects(runRelease(db,{...opts,mode:'rehearse'}),/migration failed/);assert.equal(db.log.at(-1),'ROLLBACK');assert.ok(!db.log.includes('COMMIT'));
});
test('invalid pointer, missing prerequisite table and incomplete guards fail closed',async()=>{
 for(const [state,error] of [[{bad:1},/PCI_RELEASE_006/],[{missing:true},/PCI_RELEASE_003/],[{missingGuard:true},/PCI_RELEASE_009/]]){
 const db=fake(state);await assert.rejects(runRelease(db,{...opts,mode:'rehearse'}),error);assert.equal(db.log.at(-1),'ROLLBACK');}
});
test('historical or partially activated ledgers are not replayed',()=>{
 const e={ledger:[],activeTriggers:[],findings:{invalid_pointers:0,missing_history:0}};
 assert.doesNotThrow(()=>checkPending(e));assert.throws(()=>checkPending({...e,ledger:['128_tiktok_creator_purge.sql']}),/PCI_RELEASE_004/);
 assert.throws(()=>checkPending({...e,ledger:[files[0].name]}),/PCI_RELEASE_005/);assert.throws(()=>checkPending({...e,activeTriggers:['rank_runs:pci_arch_run_guard']}),/PCI_RELEASE_005/);
 assert.throws(()=>checkPending({...e,existingTriggers:['rank_runs:pci_arch_run_guard']}),/PCI_RELEASE_005/);
});
