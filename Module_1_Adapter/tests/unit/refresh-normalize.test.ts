import test from 'node:test';
import assert from 'node:assert/strict';
import { backoffMs, isRetryable, normalizeResults, retentionDays, summarizeRun } from '../../src/modules/refresh/normalize.js';
import type { AccountRef, FetchResult } from '../../src/providers/types.js';

const acc = (id: string, platform: 'youtube' | 'instagram' = 'youtube'): AccountRef => ({ id, platform, externalId: id, handle: id });
const ok = (accountId: string, ...m: Array<[any, number]>): FetchResult => ({ accountId, outcome: 'ok', metrics: m.map(([metric, value]) => ({ metric, value, accuracy: 'exact' as const })) });

test('exactly one result per account, in request order; missing become errors; extras ignored; duplicates: first wins', () => {
  const out = normalizeResults([acc('a'), acc('b'), acc('c')], [ok('c', ['followers', 3]), ok('a', ['followers', 1]), ok('a', ['followers', 999]), ok('zzz', ['followers', 5])]);
  assert.deepEqual(out.map(r => r.accountId), ['a', 'b', 'c']);
  assert.equal(out[0].metrics[0].value, 1); assert.equal(out[1].outcome, 'error'); assert.equal(out[1].detail, 'provider_returned_nothing');
});
test('bad values are dropped, never stored as zero; an ok result with nothing valid becomes an error', () => {
  const out = normalizeResults([acc('a'), acc('b')], [ok('a', ['followers', -4], ['views', 1.5], ['posts_30d', 7]), ok('b', ['followers', NaN])]);
  assert.deepEqual(out[0].metrics.map(m => [m.metric, m.value]), [['posts_30d', 7]]);
  assert.equal(out[1].outcome, 'error'); assert.deepEqual(out[1].metrics, []);
});
test('metrics not allowed for the platform are dropped (Instagram has no views); duplicates of a metric keep the first', () => {
  const out = normalizeResults([acc('i', 'instagram')], [ok('i', ['followers', 10], ['views', 99], ['followers', 11])]);
  assert.deepEqual(out[0].metrics.map(m => [m.metric, m.value]), [['followers', 10]]);
});
test('only ok results carry metrics', () => {
  const out = normalizeResults([acc('a')], [{ accountId: 'a', outcome: 'hidden', metrics: [{ metric: 'followers', value: 0, accuracy: 'exact' }] }]);
  assert.deepEqual(out[0].metrics, []);
});
test('retry policy: only rate_limited and error are retried; the rest are final', () => {
  for (const o of ['rate_limited', 'error'] as const) assert.equal(isRetryable(o), true);
  for (const o of ['ok', 'hidden', 'not_found', 'private', 'unsupported'] as const) assert.equal(isRetryable(o), false);
});
test('run status: no accounts succeeded; none ok failed; all ok succeeded; mixed partial', () => {
  assert.equal(summarizeRun(0, {}), 'succeeded'); assert.equal(summarizeRun(5, { error: 5 }), 'failed');
  assert.equal(summarizeRun(5, { ok: 5 }), 'succeeded'); assert.equal(summarizeRun(50, { ok: 45, error: 5 }), 'partial');
});
test('backoff doubles and is capped; retention defaults to 90 and ignores nonsense', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(backoffMs), [1000, 2000, 4000, 8000, 8000, 8000]);
  assert.equal(retentionDays('youtube', {}), 90); assert.equal(retentionDays('youtube', { PCI_RETENTION_DAYS_YOUTUBE: '30' }), 30);
  for (const bad of ['0', '7', '-5', 'abc', '99999', '1.5']) assert.equal(retentionDays('instagram', { PCI_RETENTION_DAYS_INSTAGRAM: bad }), 90, bad);
});
