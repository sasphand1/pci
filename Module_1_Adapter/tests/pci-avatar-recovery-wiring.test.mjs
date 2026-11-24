import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source = p=>readFileSync(new URL(`../src/${p}`,import.meta.url),'utf8');

test('avatar-only recovery uses a different endpoint and attempt table from public HTTP',()=>{
  const routes=source('modules/ingest/routes.ts');
  const graph=source('modules/ingest/graph-avatar-fill.ts');
  assert.match(routes,/\/ingest\/instagram\/avatars\/graph\/fill/);
  assert.match(graph,/hub_graph_avatar_attempts/);
  assert.doesNotMatch(graph,/probeInstagramAvatar|instagram\.com\/\$\{/);
  assert.match(graph,/pg_try_advisory_lock/);
  assert.match(graph,/graphAvatarNextAllowedAt/);
  assert.match(graph,/avatar_url IS NULL/);
  assert.match(graph,/last_result='rate_limited'/);
});

test('all refresh paths mirror official metrics and report separate avatar outcomes',()=>{
  const service=source('modules/refresh/service.ts');
  assert.match(service,/INSTAGRAM_ACCOUNT_SELECTION_SQL/);
  assert.match(service,/avatarsRecovered/);
  assert.match(service,/mirrorApiRefresh\(runId\)/);
});

test('automatic Graph recovery requires explicit opt-in; web fallback retains safety breaker',()=>{
  const scheduler=source('modules/sync/scheduler.ts');
  assert.match(scheduler,/PCI_INSTAGRAM_GRAPH_AVATARS_AUTOFILL/);
  const web=source('modules/ingest/avatar-fill.ts');
  assert.match(web,/shouldPauseSource/);
  const ddl=source('lib/hub-schema.ts');
  assert.match(ddl,/CREATE TABLE IF NOT EXISTS hub_graph_avatar_attempts/);
});
