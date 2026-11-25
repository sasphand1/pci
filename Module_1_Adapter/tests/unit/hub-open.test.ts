import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { evaluateSource } from '../../src/modules/ingest/monitor-rules.ts';
import { methodOf } from '../../src/modules/ingest/policy.ts';

const H = 3_600_000, now = Date.parse('2026-11-25T12:00:00Z');
const base = { id: 'google_places.api', method: 'api' as const, enabled: true, consecutiveFailures: 0, lastErrorCode: null, now, checkFreshness: true };
const ago = (h: number) => new Date(now - h * H).toISOString();

test('freshness alerts follow each source\'s own schedule', () => {
  assert.equal(evaluateSource({ ...base, lastSuccessAt: ago(100), expectedHours: 168 }).status, 'ok', 'weekly source, 4 days old');
  assert.equal(evaluateSource({ ...base, lastSuccessAt: ago(300), expectedHours: 168 }).alerts[0].kind, 'stale');
  assert.equal(evaluateSource({ ...base, lastSuccessAt: ago(600), expectedHours: 168 }).status, 'down');
  // Unchanged for daily sources (36h stale, 72h no data).
  assert.equal(evaluateSource({ ...base, lastSuccessAt: ago(40) }).alerts[0].kind, 'stale');
  assert.equal(evaluateSource({ ...base, lastSuccessAt: ago(80) }).status, 'down');
});

test('web sources are lower priority than API and admin-entry sources', () => {
  assert.equal(methodOf('youtube.http'), 'http');
  assert.equal(methodOf('google_places.api'), 'api');
  assert.equal(methodOf('commodities.manual'), 'api');
});

test('hub schema opens every category and keeps ranking history', () => {
  const ddl = readFileSync(new URL('../../src/lib/hub-schema.ts', import.meta.url), 'utf8');
  const mig = readFileSync(new URL('../../database/migrations/111_hub_open_and_history.sql', import.meta.url), 'utf8');
  assert.ok(ddl.includes(mig.trim()), 'startup DDL equals the migration');
  for (const x of ['ingest_sources_platform_fmt', 'ingest_observations_entity_kind_fmt', 'value_scale', "'google_places.api'",
    'CREATE TABLE IF NOT EXISTS rank_history', 'CREATE TRIGGER hub_rank_history', 'CREATE OR REPLACE VIEW hall_of_fame'])
    assert.ok(mig.includes(x), x);
  assert.match(mig, /person_id uuid NOT NULL REFERENCES people\(id\) ON DELETE CASCADE/);
});

test('restaurants are stored in the hub and kept no longer than 30 days there', () => {
  const c = readFileSync(new URL('../../src/modules/local/collect.ts', import.meta.url), 'utf8');
  assert.match(c, /sourceId: 'google_places.api'.*entityKind: 'place'/s);
  assert.match(c, /reportSourceResult\('google_places.api'/);
  assert.match(readFileSync(new URL('../../src/modules/refresh/retention.ts', import.meta.url), 'utf8'), /entity_kind='place' AND observed_at < now\(\) - interval '30 days'/);
});
