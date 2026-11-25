import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=p=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');

const readers=['modules/refresh/summary.ts','modules/publish/overview.ts','modules/creator-analytics/data.ts',
  'modules/public/creator-index.ts','modules/public/queries.ts','modules/ingest/monitor.ts','modules/ingest/read-routes.ts'];

test('every reader uses the hub, not the old metric table', ()=>{
  for(const f of readers){
    const s=src(f);
    assert.ok(!/\bmetric_observations\b/.test(s),`${f} still reads metric_observations`);
    assert.ok(s.includes('hub_account_metrics'),`${f} reads hub_account_metrics`);
  }
});

test('rankings read the hub unless explicitly rolled back', ()=>{
  const s=src('modules/publish/service.ts');
  assert.ok(s.includes("process.env.PCI_INGEST_RANKING!=='false'"));
  assert.ok(s.includes('FROM ingest_latest l JOIN accounts a'));
});

test('hub schema mirrors old writes, copies history once and exposes the readers view', ()=>{
  const ddl=src('lib/hub-schema.ts');
  const mig=readFileSync(new URL('../database/migrations/110_hub_readers.sql',import.meta.url),'utf8');
  for(const s of [ddl,mig]){
    assert.ok(s.includes('CREATE TRIGGER hub_mirror_metric_observations AFTER INSERT ON metric_observations'));
    assert.ok(s.includes("key='legacy_history_v1'"));
    assert.ok(s.includes('CREATE OR REPLACE VIEW hub_account_metrics'));
    assert.ok(s.includes("s.method='api' OR NOT EXISTS"),'API-first rule in the view');
  }
  assert.ok(ddl.includes(mig.trim()),'startup DDL equals the migration');
});

test('deleting a person also clears hub rows that do not cascade', ()=>{
  const s=src('modules/bucket/service.ts');
  assert.ok(s.includes('clearHubRecords(client, personId, has)'));
  for(const t of ['ingest_latest','hub_discrepancies','ingest_content'])assert.ok(s.includes(`DELETE FROM ${t}`),t);
});

test('hub copies follow the same retention as the old table', ()=>{
  assert.ok(src('modules/refresh/retention.ts').includes('export async function runHubRetention'));
  assert.ok(src('modules/sync/scheduler.ts').includes('runHubRetention()'));
});
