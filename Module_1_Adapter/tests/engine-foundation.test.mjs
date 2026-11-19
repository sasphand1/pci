import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyCreator,summarize,EXCLUSION_REASONS} from '../src/modules/engine/status.mjs';

const NOW=new Date('2026-11-19T12:00:00Z');
const hoursAgo=h=>new Date(NOW.getTime()-h*36e5).toISOString();
const base={enabled:true,humanReviewStatus:'approved',fetchedAt:hoursAgo(2),subscriberCount:'1200',subscriberHidden:false,lastOutcome:'ok'};

// ---- behavioural tests of the pure diagnostics
test('a fresh, approved creator with a subscriber count is eligible',()=>{
  const r=classifyCreator(base,{now:NOW});
  assert.deepEqual(r,{eligible:true,reasons:[],primary:null});
});
test('pending approval is reported even when data exists; approval is never inferred',()=>{
  assert.deepEqual(classifyCreator({...base,humanReviewStatus:'pending'},{now:NOW}).reasons,['not_approved']);
  assert.deepEqual(classifyCreator({...base,humanReviewStatus:'rejected'},{now:NOW}).reasons,['rejected']);
});
test('never-synchronized creators are explained, not silently dropped',()=>{
  const none={...base,fetchedAt:null,subscriberCount:null,lastOutcome:null};
  assert.equal(classifyCreator(none,{now:NOW}).primary,'no_snapshot');
  assert.equal(classifyCreator({...none,lastOutcome:'not_returned'},{now:NOW}).primary,'not_returned_by_youtube');
  assert.equal(classifyCreator({...none,lastOutcome:'failed'},{now:NOW}).primary,'sync_failed');
});
test('hidden or missing subscriber counts are never treated as zero',()=>{
  assert.deepEqual(classifyCreator({...base,subscriberHidden:true,subscriberCount:null},{now:NOW}).reasons,['metric_hidden']);
  assert.deepEqual(classifyCreator({...base,subscriberCount:null},{now:NOW}).reasons,['metric_hidden']);
  assert.equal(classifyCreator({...base,subscriberCount:'0'},{now:NOW}).eligible,true); // a real zero is a real value
});
test('stale statistics are flagged after the freshness window',()=>{
  assert.equal(classifyCreator({...base,fetchedAt:hoursAgo(35)},{now:NOW}).eligible,true);
  assert.deepEqual(classifyCreator({...base,fetchedAt:hoursAgo(37)},{now:NOW}).reasons,['stale']);
  assert.deepEqual(classifyCreator({...base,fetchedAt:'not a date'},{now:NOW}).reasons,['stale']);
});
test('disabled creators are never eligible',()=>{
  assert.equal(classifyCreator({...base,enabled:false},{now:NOW}).primary,'disabled');
});
test('every emitted reason is a documented code',()=>{
  const samples=[{...base,enabled:false,humanReviewStatus:'rejected',fetchedAt:null,lastOutcome:'failed'},{...base,subscriberCount:null,fetchedAt:hoursAgo(99),lastOutcome:'not_returned'}];
  for(const s of samples)for(const reason of classifyCreator(s,{now:NOW}).reasons)assert.ok(EXCLUSION_REASONS.includes(reason),reason);
});
test('production diagnosis scenario: 49 enabled, 0 approved, 10 synced',()=>{
  const rows=Array.from({length:49},(_,i)=>i<10?{...base,humanReviewStatus:'pending'}:{...base,humanReviewStatus:'pending',fetchedAt:null,subscriberCount:null,lastOutcome:null});
  const s=summarize(rows,{now:NOW});
  assert.equal(s.total,49);assert.equal(s.eligible,0);
  assert.equal(s.byReason.not_approved,49);assert.equal(s.byReason.no_snapshot,39);
  // after a human approves everyone, only the 10 synchronized creators become eligible
  const approved=summarize(rows.map(r=>({...r,humanReviewStatus:'approved'})),{now:NOW});
  assert.equal(approved.eligible,10);assert.equal(approved.byPrimaryReason.no_snapshot,39);
});

// ---- consistency tests (structural: verify wiring that cannot run without PostgreSQL here)
test('migration 091 and the runtime schema bridge contain identical DDL',()=>{
  const strip=s=>s.split('\n').filter(l=>!l.trim().startsWith('--')).join(' ').replace(/\s+/g,' ').trim();
  const migration=strip(readFileSync('database/migrations/091_engine_foundation.sql','utf8'));
  const ts=readFileSync('src/lib/engine-schema.ts','utf8');
  const open=ts.indexOf('ENGINE_SCHEMA_SQL=`')+'ENGINE_SCHEMA_SQL=`'.length;
  const sql=strip(ts.slice(open,ts.indexOf('`;',open)));
  assert.equal(sql,migration);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS sync_account_results/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS worker_heartbeats/);
});
test('new runtime module is listed for the production build',()=>{
  assert.match(readFileSync('scripts/copy-assets.mjs','utf8'),/modules\/engine\/status\.mjs/);
});
test('worker and API share one scheduler; embedded mode is opt-in',()=>{
  const worker=readFileSync('src/worker.ts','utf8'),server=readFileSync('src/server.ts','utf8'),sched=readFileSync('src/modules/sync/scheduler.ts','utf8');
  assert.match(worker,/startScheduler\(\{embedded:false\}\)/);
  assert.match(server,/RUN_WORKER_IN_API==='true'/);
  assert.match(sched,/worker_heartbeats/);
  assert.match(readFileSync('src/lib/config.ts','utf8'),/RUN_WORKER_IN_API: z\.enum\(\['true','false'\]\)\.default\('false'\)/);
});
test('Redis outage no longer takes down public reads or channel sync',()=>{
  const server=readFileSync('src/server.ts','utf8'),yt=readFileSync('src/modules/youtube/client.ts','utf8');
  assert.match(server,/Global rate limiter unavailable; allowing request/);
  assert.match(yt,/withinBudget=true/);
  assert.match(server,/retrying/); // startup retries instead of staying in 503 forever
});
test('freshness check cannot create a quota-burning loop',()=>{
  const svc=readFileSync('src/modules/sync/service.ts','utf8');
  assert.match(svc,/export async function ensureFreshness/);
  assert.match(svc,/recent_run_exists/);
  assert.match(svc,/interval '20 minutes'/);
});
test('bulk review requires explicit human confirmation and a matching count',()=>{
  const routes=readFileSync('src/modules/unified/routes.ts','utf8');
  assert.match(routes,/unified\/creators\/bulk-review/);
  assert.match(routes,/body\.decision==='approved'&&!body\.humanConfirmed/);
  assert.match(routes,/ids\.length!==body\.expectedCount/);
});
