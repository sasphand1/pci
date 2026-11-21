import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankScope, removePerson, inputHash, type RankInput, type RankResult } from '../../src/engine/index.js';
import { runGates, minCoverageFrom } from '../../src/modules/publish/gates.js';
import { diffRankings } from '../../src/modules/publish/diff.js';

const fx = JSON.parse(readFileSync(new URL('../fixtures/ranking-basic.json', import.meta.url), 'utf8'));
const input: RankInput = { now: fx.now, people: fx.people, observations: fx.observations };
const known = new Set<string>(fx.people.map((p: any) => p.id));
const opt = { knownPersonIds: known, minCoverage: 0.5, checkCoverage: true };
const good = () => rankScope('wheel.subscribed', input);
const clone = (r: RankResult): RankResult => JSON.parse(JSON.stringify(r));
const names = (r: RankResult) => runGates(r, opt).map(f => f.gate);

test('every fixture ranking passes every gate', () => { for (const s of Object.keys(fx.expected)) assert.deepEqual(runGates(rankScope(s, input), opt), [], s); });
test('gate: negative or fractional values are refused', () => {
  const r = clone(good()); r.entries[0].value = -1; assert.ok(names(r).includes('non_negative_integers'));
  const q = clone(good()); q.entries[0].breakdown[0].value = 1.5; assert.ok(names(q).includes('non_negative_integers'));
});
test('gate: a value that is not the sum of its contributions is refused', () => { const r = clone(good()); r.entries[2].value += 1; assert.ok(names(r).includes('non_negative_integers')); });
test('gate: a person listed twice, or both ranked and unranked, is refused', () => {
  const r = clone(good()); r.entries[1].personId = r.entries[0].personId; assert.ok(names(r).includes('unique_people'));
  const q = clone(good()); q.unranked.push({ personId: q.entries[0].personId, reason: 'no_valid_value', linked: 1 }); assert.ok(names(q).includes('unique_people'));
});
test('gate: references to people that do not exist are refused', () => { assert.ok(runGates(good(), { ...opt, knownPersonIds: new Set(['p1']) }).some(f => f.gate === 'valid_references')); });
test('gate: gaps or duplicates in slots are refused', () => {
  const r = clone(good()); r.entries[1].slot = 5; assert.ok(names(r).includes('slots_gap_free'));
  const q = clone(good()); q.entries.splice(1, 1); assert.ok(names(q).includes('slots_gap_free'));
});
test('gate: entries listed out of value order are refused even when each rank is individually correct', () => {
  const r = clone(good()); const k = r.entries.findIndex((e, i) => i > 0 && e.value < r.entries[i - 1].value);
  assert.ok(k > 0); [r.entries[k - 1], r.entries[k]] = [r.entries[k], r.entries[k - 1]];
  r.entries.forEach((e, i) => { e.slot = i + 1; e.rank = 1 + r.entries.filter(x => x.value > e.value).length; });
  assert.ok(names(r).includes('rank_consistent'));
});
test('gate: ranks that disagree with value order are refused', () => { const r = clone(good()); r.entries[3].rank = 1; assert.ok(names(r).includes('rank_consistent')); });
test('gate: coverage below 50% blocks; exactly 50% passes; off for deletes; population 0 never blocks', () => {
  const low = clone(good()); low.population = 20; assert.ok(names(low).includes('coverage'));
  const half = clone(good()); half.population = half.covered * 2; assert.ok(!names(half).includes('coverage'));
  assert.ok(!runGates(low, { ...opt, checkCoverage: false }).some(f => f.gate === 'coverage'));
  const empty = rankScope('category.nobody', input); assert.deepEqual(runGates(empty, opt), []);
});
test('gate: the input hash must reproduce; any tampering is caught', () => {
  const r = clone(good()); r.entries[0].breakdown[0].observedAt = '2026-01-01T00:00:00Z'; assert.ok(names(r).includes('input_hash'));
  const q = clone(good()); q.unranked = []; assert.ok(names(q).includes('input_hash'));
  const w = clone(good()); w.inputHash = 'x'; assert.ok(names(w).includes('input_hash'));
});
test('gate: policy version must match the scope', () => { const r = clone(good()); r.policyVersion = 'wheel.subscribed@v0'; assert.ok(names(r).includes('policy_version')); });
test('D2 a person moving from slot 40 to slot 1 is NOT a gate failure; only the diff shows it', () => {
  const live = Array.from({ length: 50 }, (_, i) => ({ personId: `p${i}`, slot: i + 1, value: 1000 - i }));
  const draft = [{ personId: 'p39', slot: 1, value: 5000 }, ...live.filter(e => e.personId !== 'p39').map((e, i) => ({ ...e, slot: i + 2 }))];
  const d = diffRankings(live, draft);
  assert.deepEqual(d.moved[0], { personId: 'p39', from: 40, to: 1, delta: 39 });
  assert.equal(d.valueChanged, 1);
  // the gates have no movement rule at all
  const people = Array.from({ length: 50 }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, createdAt: '2026-01-01T00:00:00Z', accounts: [{ id: `a${i}`, platform: 'youtube' as const }], categories: [] }));
  const obs = (shift: number) => people.map((p, i) => ({ accountId: `a${i}`, metric: 'followers' as const, value: i === 39 ? shift : 100000 - i, observedAt: fx.now, accuracy: 'exact' as const }));
  const big = rankScope('wheel.subscribed', { now: fx.now, people, observations: obs(999999) });
  assert.equal(big.entries[0].personId, 'p39'); assert.deepEqual(runGates(big, { knownPersonIds: new Set(people.map(p => p.id)), minCoverage: 0.5, checkCoverage: true }), []);
});
test('minCoverage reads PCI_MIN_COVERAGE (0..1) and ignores nonsense', () => {
  assert.equal(minCoverageFrom({}), 0.5); assert.equal(minCoverageFrom({ PCI_MIN_COVERAGE: '0.8' }), 0.8);
  for (const bad of ['2', '-1', 'abc', '']) assert.equal(minCoverageFrom({ PCI_MIN_COVERAGE: bad }), bad === '' ? 0 : 0.5, bad);
});
test('diff: entered, left, moved, value changes, unchanged; no live ranking means everyone entered', () => {
  const live = [{ personId: 'a', slot: 1, value: 10 }, { personId: 'b', slot: 2, value: 9 }, { personId: 'c', slot: 3, value: 8 }];
  const draft = [{ personId: 'b', slot: 1, value: 11 }, { personId: 'a', slot: 2, value: 10 }, { personId: 'd', slot: 3, value: 5 }];
  const d = diffRankings(live, draft);
  assert.deepEqual(d.entered, [{ personId: 'd', to: 3 }]); assert.deepEqual(d.left, [{ personId: 'c', from: 3 }]);
  assert.deepEqual(d.moved.map(m => [m.personId, m.from, m.to]), [['a', 1, 2], ['b', 2, 1]]); assert.equal(d.valueChanged, 1); assert.equal(d.unchanged, 0);
  assert.equal(diffRankings(null, draft).entered.length, 3);
  assert.equal(diffRankings(live, live).unchanged, 3);
});
test('D3 helper: removing a person closes slots, recomputes ranks, keeps everyone else’s value, and still passes the gates', () => {
  for (const scope of Object.keys(fx.expected)) {
    const before = rankScope(scope, input);
    for (const victim of [...before.entries.map(e => e.personId), ...before.unranked.map(u => u.personId)]) {
      const after = removePerson(before, victim);
      const rest = new Set([...known].filter(id => id !== victim));
      assert.deepEqual(runGates(after, { knownPersonIds: rest, minCoverage: 0, checkCoverage: false }), [], `${scope} minus ${victim}`);
      assert.ok(!after.entries.some(e => e.personId === victim) && !after.unranked.some(u => u.personId === victim));
      const was = new Map(before.entries.map(e => [e.personId, e.value])); for (const e of after.entries) assert.equal(e.value, was.get(e.personId));
      assert.deepEqual(after.entries.map(e => e.personId), before.entries.filter(e => e.personId !== victim).map(e => e.personId)); // order is preserved
      assert.equal(after.inputHash, inputHash(after.scope, after.policyVersion, after.entries, after.unranked));
    }
  }
  // a person with a 1,1,3 tie: removing one of the tied closes the rank gap to 1,2
  const r = rankScope('wheel.subscribed', input); const gone = removePerson(r, 'p3');
  assert.deepEqual(gone.entries.map(e => [e.personId, e.slot, e.rank]), [['p1', 1, 1], ['p4', 2, 1], ['p2', 3, 3], ['p6', 4, 4]]);
  assert.equal(gone.population, r.population - 1);
});

test('a ranking with data for nobody (0 of 7) is rejected: every wheel needs its own fresh metric, or an alert is raised', () => {
  const none = clone(good()); none.population = 7; none.covered = 0; none.entries = []; none.unranked = [];
  assert.ok(names(none).includes('coverage'));
});
