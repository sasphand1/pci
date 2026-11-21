import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionItems, changePct, compact, systemState, toSeries } from '../../src/modules/publish/overview-shape.js';

const base = { accountsTotal: 10, accountsFresh: 10, peopleTotal: 8, peopleWithoutCategory: 0, openAlerts: 0, staleScopes: 0 };

test('nothing needs attention when everything is fresh', () => { assert.deepEqual(attentionItems(base), []); });
test('accounts without recent numbers are counted and linked to the bucket', () => {
  const [a] = attentionItems({ ...base, accountsFresh: 7 });
  assert.equal(a.key, 'no_numbers'); assert.equal(a.count, 3); assert.equal(a.href, '/bucket'); assert.match(a.message, /^accounts have no recent numbers$/);
});
test('singular wording', () => {
  assert.match(attentionItems({ ...base, accountsFresh: 9 })[0].message, /^account has no recent numbers$/);
  assert.match(attentionItems({ ...base, peopleWithoutCategory: 1 })[0].message, /^person has no niche$/);
  assert.match(attentionItems({ ...base, openAlerts: 1 })[0].message, /^pipeline alert is waiting/);
});
test('order: alerts, stale, no numbers, then niche', () => {
  const keys = attentionItems({ ...base, accountsFresh: 5, peopleWithoutCategory: 2, openAlerts: 1, staleScopes: 2 }).map(a => a.key);
  assert.deepEqual(keys, ['alerts', 'stale', 'no_numbers', 'no_category']);
});
test('fresh count above total never produces a negative count', () => { assert.deepEqual(attentionItems({ ...base, accountsFresh: 99 }), []); });

const ok = { workerHealthy: true, dailyEnabled: true, openAlerts: 0, staleScopes: 0, lastPipelineStatus: 'succeeded', published: true };
test('healthy system', () => { assert.deepEqual(systemState(ok), { level: 'ok', label: 'All systems ok', reasons: [] }); });
test('worker never seen while the daily run is on means down', () => {
  const s = systemState({ ...ok, workerHealthy: null }); assert.equal(s.level, 'down'); assert.match(s.reasons[0], /not been seen/);
});
test('worker not needed when the daily run is switched off', () => { assert.equal(systemState({ ...ok, workerHealthy: null, dailyEnabled: false }).level, 'ok'); });
test('alerts, failures and nothing published are attention, not down', () => {
  assert.equal(systemState({ ...ok, openAlerts: 2 }).level, 'attention');
  assert.equal(systemState({ ...ok, lastPipelineStatus: 'failed' }).level, 'attention');
  assert.equal(systemState({ ...ok, published: false }).level, 'attention');
});

test('series aligns platforms by day and uses null, never zero, for a missing reading', () => {
  const s = toSeries([{ day: '2026-11-02', platform: 'youtube', value: 5 }, { day: '2026-11-01', platform: 'youtube', value: 4 }, { day: '2026-11-02', platform: 'instagram', value: 2 }]);
  assert.deepEqual(s.days, ['2026-11-01', '2026-11-02']); assert.deepEqual(s.youtube, [4, 5]); assert.deepEqual(s.instagram, [null, 2]);
});
test('change percentage', () => {
  assert.equal(changePct([100, null, 110]), 10); assert.equal(changePct([200, 150]), -25); assert.equal(changePct([100]), null); assert.equal(changePct([0, 5]), null); assert.equal(changePct([]), null);
});
test('compact figures', () => {
  assert.equal(compact(0), '0'); assert.equal(compact(999), '999'); assert.equal(compact(9999), '9,999'); assert.equal(compact(12400), '12.4K');
  assert.equal(compact(8_900_000), '8.9M'); assert.equal(compact(1_234_000_000), '1.2B'); assert.equal(compact(-5), '0'); assert.equal(compact(NaN), '0');
});
