// Disposable database only. The CI workflow applies the repository migrations first.
import test from 'node:test';
import assert from 'node:assert/strict';
import type pg from 'pg';
import {pool} from '../../src/lib/db.js';
import {readMigrationState,planMigrations} from '../../src/architecture/migration-safety.js';
import {readRuntimeEvidence,runtimeRoleFindings} from '../../src/architecture/runtime-audit.js';

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

// The actual PostgreSQL catalog, not a mocked permission result.
test('migration ledger is populated on the disposable migrated database',()=>isolated(async c=>{
 const state=await readMigrationState(c);
 assert.ok(state.applicationObjects.includes('public.people'));
 assert.ok(state.applied.includes('135_architecture_source_routes.sql'));
 assert.equal(planMigrations(state.applied,state).status,'ready');
}));
test('catalog evidence identifies the current runtime role and owner authority',()=>isolated(async c=>{
 const e=await readRuntimeEvidence(c);
 assert.equal(e.role.username,(await c.query('SELECT current_user AS u')).rows[0].u);
 assert.ok(e.relations.some(r=>r.schema==='public'&&r.relation==='people'));
 if(e.role.superuser)assert.match(runtimeRoleFindings(e).join(),/PCI_ARCH_ROLE_001/);
}));
test('Hub SQL contract covers valid source mappings including optional providers',()=>isolated(async c=>{
 for(const tuple of [
  ['youtube.api','account','youtube:UCfixture','followers'],
  ['instagram.http','account','instagram:123','avatar_url'],
  ['sat_eonet.api','natural_event','eonet:123','event'],
  ['sat_gpm.api','map_layer','gibs:example','latest_day'],
  ['sat_openaq.api','aq_station','openaq:123','new_parameter'],
  ['satify.api','satify_scope','lahore','school_closure_chance'],
  ['google_places.api','place','google_places:fixture','rating']
 ]) assert.equal((await c.query('SELECT public.pci_arch_hub_route_allowed($1,$2,$3,$4) AS ok',tuple)).rows[0].ok,true,tuple.join('/'));
 for(const tuple of [
  ['undeclared.api','account','youtube:UCfixture','followers'],
  ['youtube.api','account','instagram:123','followers'],
  ['sat_weather.api','city','city:lahore','followers'],
  ['satify.api','satify_scope','lahore','invented_metric'],
  ['tiktok.http','account','tiktok:123','followers'],
  ['sat_openaq.api','account','openaq:123','followers']
 ]) assert.equal((await c.query('SELECT public.pci_arch_hub_route_allowed($1,$2,$3,$4) AS ok',tuple)).rows[0].ok,false,tuple.join('/'));
}));
test('database rejects unauthorized Hub history and latest writes independently',()=>isolated(async c=>{
 await rejected(c,()=>c.query(`INSERT INTO ingest_observations(source_id,source_run_ref,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at)
 VALUES('sat_weather.api','aef-fixture','city','city:lahore','followers',1,'exact',now())`),'PCI_ARCH_DB_009');
 await rejected(c,()=>c.query(`INSERT INTO ingest_latest(source_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at)
 VALUES('sat_weather.api','account','youtube:aef-fixture','temperature_c',1,'exact',now())`),'PCI_ARCH_DB_009');
 await c.query(`INSERT INTO ingest_observations(source_id,source_run_ref,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at)
 VALUES('sat_weather.api','aef-fixture','city','city:aef-fixture','temperature_c',15,'exact',now())`);
 await c.query(`INSERT INTO ingest_latest(source_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at)
 VALUES('sat_weather.api','city','city:aef-fixture','temperature_c',15,'exact',now())`);
 assert.equal(Number((await c.query("SELECT value_numeric FROM ingest_latest WHERE entity_id='city:aef-fixture' AND metric='temperature_c'")).rows[0].value_numeric),15);
}));

test('all 74 audited production source/kind/metric combinations match representative keys',()=>isolated(async c=>{
 const tuples:string[][]=[
  ["google_places.api","place","google_places:fixture","rating"],
  ["google_places.api","place","google_places:fixture","reviews"],
  ["google_places.api","place","google_places:fixture","score"],
  ["instagram.api","account","instagram:123","avatar_url"],
  ["instagram.api","account","instagram:123","followers"],
  ["instagram.api","account","instagram:123","posts_30d"],
  ["sat_airquality.api","city","city:lahore","dust"],
  ["sat_airquality.api","city","city:lahore","no2"],
  ["sat_airquality.api","city","city:lahore","o3"],
  ["sat_airquality.api","city","city:lahore","pm10"],
  ["sat_airquality.api","city","city:lahore","pm2_5"],
  ["sat_airquality.api","city","city:lahore","us_aqi"],
  ["sat_airquality.api","city","city:lahore","uv_index"],
  ["sat_celestrak.api","orbiting_object","norad:123","orbital_elements"],
  ["sat_firms.api","region","region:pakistan","fire_hotspots_3d"],
  ["sat_flood.api","river_point","river:fixture","discharge_m3s"],
  ["sat_flood.api","river_point","river:fixture","peak_30d_m3s"],
  ["sat_gdacs.api","disaster_alert","gdacs:fixture:123","alert_score"],
  ["sat_gibs.api","map_layer","gibs:fixture","latest_day"],
  ["sat_gpm.api","map_layer","gibs:fixture","latest_day"],
  ["sat_insights.api","city","city:lahore","go_out_score"],
  ["sat_insights.api","ranking","ranking:fixture","winner_value"],
  ["sat_openaq.api","aq_station","openaq:123","co"],
  ["sat_openaq.api","aq_station","openaq:123","no"],
  ["sat_openaq.api","aq_station","openaq:123","no2"],
  ["sat_openaq.api","aq_station","openaq:123","nox"],
  ["sat_openaq.api","aq_station","openaq:123","o3"],
  ["sat_openaq.api","aq_station","openaq:123","pm1"],
  ["sat_openaq.api","aq_station","openaq:123","pm10"],
  ["sat_openaq.api","aq_station","openaq:123","pm25"],
  ["sat_openaq.api","aq_station","openaq:123","relativehumidity"],
  ["sat_openaq.api","aq_station","openaq:123","so2"],
  ["sat_openaq.api","aq_station","openaq:123","temperature"],
  ["sat_openaq.api","aq_station","openaq:123","um003"],
  ["sat_openaq.api","aq_station","openaq:123","wind_direction"],
  ["sat_openaq.api","aq_station","openaq:123","wind_speed"],
  ["sat_power.api","city","city:lahore","rainfall_mm"],
  ["sat_power.api","city","city:lahore","solar_kwh_m2"],
  ["sat_swpc.api","space","space:kp","kp_index"],
  ["sat_usgs.api","earthquake","usgs:fixture","magnitude"],
  ["sat_weather.api","city","city:lahore","feels_like_c"],
  ["sat_weather.api","city","city:lahore","heat_days_7d"],
  ["sat_weather.api","city","city:lahore","humidity_pct"],
  ["sat_weather.api","city","city:lahore","precipitation_mm"],
  ["sat_weather.api","city","city:lahore","temperature_c"],
  ["sat_weather.api","city","city:lahore","wind_kmh"],
  ["satify.api","satify_scope","lahore","aqi"],
  ["satify.api","satify_scope","lahore","aqi_forecast_max"],
  ["satify.api","satify_scope","lahore","feels_max"],
  ["satify.api","satify_scope","lahore","fog_pct"],
  ["satify.api","satify_scope","lahore","gold_tola"],
  ["satify.api","satify_scope","lahore","gold_usd_oz"],
  ["satify.api","satify_scope","lahore","pm25"],
  ["satify.api","satify_scope","lahore","rain_chance"],
  ["satify.api","satify_scope","lahore","route_visibility_km"],
  ["satify.api","satify_scope","lahore","temp_max"],
  ["satify.api","satify_scope","lahore","temp_min"],
  ["satify.api","satify_scope","lahore","temp_now"],
  ["satify.api","satify_scope","lahore","usd_pkr"],
  ["satify.api","satify_scope","lahore","uv_max"],
  ["satify.api","satify_scope","lahore","visibility_km"],
  ["scrappa.api","account","tiktok_candidate:123","followers"],
  ["scrappa.api","account","tiktok_candidate:123","following"],
  ["scrappa.api","account","tiktok_candidate:123","likes"],
  ["scrappa.api","account","tiktok_candidate:123","sample_size"],
  ["scrappa.api","account","tiktok_candidate:123","video_count"],
  ["youtube.api","account","youtube:UCfixture","channel_banner_url"],
  ["youtube.api","account","youtube:UCfixture","followers"],
  ["youtube.api","account","youtube:UCfixture","posts_30d"],
  ["youtube.api","account","youtube:UCfixture","video_count"],
  ["youtube.api","account","youtube:UCfixture","views"],
  ["youtube.api","content","youtube:fixture","comments"],
  ["youtube.api","content","youtube:fixture","likes"],
  ["youtube.api","content","youtube:fixture","views"]
 ];
 assert.equal(tuples.length,74);
 const bad=(await c.query(`SELECT source,kind,metric FROM unnest($1::text[],$2::text[],$3::text[],$4::text[]) AS t(source,kind,entity,metric)
 WHERE NOT public.pci_arch_hub_route_allowed(source,kind,entity,metric)`,[0,1,2,3].map(i=>tuples.map(t=>t[i])))).rows;
 assert.deepEqual(bad,[]);
}));
