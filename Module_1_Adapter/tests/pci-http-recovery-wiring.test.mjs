import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('Instagram HTTP pause uses actual attempt time, not periodic monitor timestamp', () => {
  const src = read('modules/ingest/avatar-fill.ts');
  assert.match(src, /SELECT s\.enabled,h\.consecutive_failures AS cf,s\.last_attempt_at FROM ingest_sources s/);
  assert.match(src, /shouldPauseSource\(row\.cf\?\?0,row\.last_attempt_at,Date\.now\(\)\)/);
  assert.doesNotMatch(src, /shouldPauseSource\([^\n]*row\.checked_at/);
});

test('HTTP source health display respects enabled kill switch immediately', () => {
  const src = read('modules/ingest/read-routes.ts');
  assert.match(src, /CASE WHEN NOT s\.enabled THEN 'disabled' WHEN h\.status='disabled' THEN 'degraded'/);
});

test('Instagram token rejection is not immediately retried', () => {
  const src = read('modules/refresh/service.ts');
  assert.match(src, /r\.detail === 'graph_code_190'/);
});
