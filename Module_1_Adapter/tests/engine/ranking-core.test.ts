import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rankScope, rankAll, inputHash, FIXED_SCOPES, type RankInput, type PersonIn, type Observation } from '../../src/engine/index.js';

const fx = JSON.parse(readFileSync(new URL('../fixtures/ranking-basic.json', import.meta.url), 'utf8'));
const input: RankInput = { now: fx.now, people: fx.people, observations: fx.observations };
const shape = (r: ReturnType<typeof rankScope>) => ({ population: r.population, covered: r.covered, entries: r.entries.map(e => ({ personId: e.personId, slot: e.slot, rank: e.rank, value: e.value, counted: e.counted, linked: e.linked })), unranked: r.unranked.map(u => ({ personId: u.personId, reason: u.reason })) });

// seeded helpers
function rng(seed: number) { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
function shuffle<T>(a: T[], r: () => number): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

test('C1 hand-calculated fixtures match exactly, for every scope', () => {
  for (const scope of Object.keys(fx.expected)) assert.deepEqual(shape(rankScope(scope, input)), fx.expected[scope], scope);
});
test('C2 shuffling people, accounts and observations never changes the output (including the hash)', () => {
  const r = rng(7);
  for (const scope of Object.keys(fx.expected)) {
    const base = rankScope(scope, input);
    for (let n = 0; n < 50; n++) {
      const people = shuffle(fx.people as PersonIn[], r).map(p => ({ ...p, accounts: shuffle(p.accounts, r), categories: shuffle(p.categories, r) }));
      const again = rankScope(scope, { ...input, people, observations: shuffle(fx.observations as Observation[], r) });
      assert.deepEqual(again, base, scope);
    }
  }
});
test('C3 adding or removing a person changes nobody else’s value (property, seeded random worlds)', () => {
  const r = rng(99);
  for (let w = 0; w < 100; w++) {
    const people: PersonIn[] = []; const observations: Observation[] = [];
    const n = 2 + Math.floor(r() * 12);
    for (let i = 0; i < n; i++) {
      const accounts = [] as PersonIn['accounts'];
      for (const platform of ['youtube', 'instagram'] as const) if (r() < 0.6) accounts.push({ id: `a${i}${platform[0]}`, platform });
      people.push({ id: `p${String(i).padStart(2, '0')}`, createdAt: new Date(Date.UTC(2026, 0, 1 + Math.floor(r() * 5))).toISOString(), accounts, categories: r() < 0.5 ? ['gamer'] : [] });
      for (const a of accounts) for (const metric of ['followers', 'views', 'posts_30d'] as const) if (r() < 0.8)
        observations.push({ accountId: a.id, metric, value: Math.floor(r() * 5000), observedAt: new Date(Date.parse(fx.now) - Math.floor(r() * 12 * 86400000)).toISOString(), accuracy: 'exact' });
    }
    const drop = people[Math.floor(r() * people.length)].id;
    for (const scope of [...FIXED_SCOPES, 'category.gamer']) {
      const full = rankScope(scope, { now: fx.now, people, observations });
      const less = rankScope(scope, { now: fx.now, people: people.filter(p => p.id !== drop), observations });
      const v = (x: typeof full) => new Map(x.entries.map(e => [e.personId, e.value]));
      const vf = v(full), vl = v(less);
      for (const [id, val] of vl) assert.equal(vf.get(id), val, `${scope} ${id}`);
      for (const [id, val] of vf) if (id !== drop) assert.equal(vl.get(id), val, `${scope} ${id}`);
      // structural invariants on every ranking
      const slots = full.entries.map(e => e.slot);
      assert.deepEqual(slots, slots.map((_, i) => i + 1));                                   // unique, gap-free
      full.entries.forEach((e, i) => assert.equal(e.rank, 1 + full.entries.filter(x => x.value > e.value).length));
      assert.equal(full.entries.length + full.unranked.length, people.filter(p => !(scope === 'youtube.subscribed' && !p.accounts.some(a => a.platform === 'youtube')) && !(scope === 'instagram.followers' && !p.accounts.some(a => a.platform === 'instagram')) && !(scope === 'category.gamer' && !p.categories.includes('gamer'))).length); // completeness
    }
  }
});
test('C4 equal values share a rank while slots stay unique (1, 1, 3 style)', () => {
  const people: PersonIn[] = ['x', 'y', 'z'].map((id, i) => ({ id, createdAt: `2026-01-0${i + 1}T00:00:00Z`, accounts: [{ id: `${id}1`, platform: 'youtube' }], categories: [] }));
  const mk = (a: string, v: number): Observation => ({ accountId: a, metric: 'followers', value: v, observedAt: fx.now, accuracy: 'exact' });
  const r = rankScope('wheel.subscribed', { now: fx.now, people, observations: [mk('x1', 500), mk('y1', 500), mk('z1', 100)] });
  assert.deepEqual(r.entries.map(e => [e.personId, e.slot, e.rank]), [['x', 1, 1], ['y', 2, 1], ['z', 3, 3]]);
});
test('C5 a 10-day-old observation is missing; a person with only such accounts is unranked with a reason', () => {
  const r = rankScope('wheel.subscribed', input);
  assert.ok(!r.entries.some(e => e.personId === 'p5'));
  assert.deepEqual(r.unranked.find(u => u.personId === 'p5'), { personId: 'p5', reason: 'no_valid_value', linked: 1 });
  // p6's stale Instagram account is not counted, but its fresh YouTube account is: "1 of 2 accounts counted"
  const p6 = r.entries.find(e => e.personId === 'p6')!; assert.equal(p6.counted, 1); assert.equal(p6.linked, 2); assert.equal(p6.value, 900);
});
test('freshness boundary: exactly 7 days counts, one second more does not; no fallback to older values', () => {
  const people: PersonIn[] = [{ id: 'q', createdAt: '2026-01-01T00:00:00Z', accounts: [{ id: 'q1', platform: 'youtube' }], categories: [] }];
  const at = (iso: string, v: number): Observation => ({ accountId: 'q1', metric: 'followers', value: v, observedAt: iso, accuracy: 'exact' });
  const now = '2026-11-20T12:00:00Z';
  assert.equal(rankScope('wheel.subscribed', { now, people, observations: [at('2026-11-13T12:00:00Z', 5)] }).entries.length, 1);
  assert.equal(rankScope('wheel.subscribed', { now, people, observations: [at('2026-11-13T11:59:59Z', 5)] }).entries.length, 0);
  // newest is stale (no entry) even though an older, equally stale value exists; and a fresh one wins over an old one
  assert.equal(rankScope('wheel.subscribed', { now, people, observations: [at('2026-11-19T12:00:00Z', 7), at('2026-11-01T12:00:00Z', 99)] }).entries[0].value, 7);
});
test('a real zero is a real value; a missing metric is not zero', () => {
  const people: PersonIn[] = [{ id: 'q', createdAt: '2026-01-01T00:00:00Z', accounts: [{ id: 'q1', platform: 'youtube' }], categories: [] }, { id: 'r', createdAt: '2026-01-02T00:00:00Z', accounts: [{ id: 'r1', platform: 'youtube' }], categories: [] }];
  const r = rankScope('wheel.active', { now: fx.now, people, observations: [{ accountId: 'q1', metric: 'posts_30d', value: 0, observedAt: fx.now, accuracy: 'exact' }] });
  assert.deepEqual(r.entries.map(e => [e.personId, e.value]), [['q', 0]]);
  assert.deepEqual(r.unranked.map(u => u.personId), ['r']);
});
test('invalid or future observations are ignored, never zeroed or trusted', () => {
  const people: PersonIn[] = [{ id: 'q', createdAt: '2026-01-01T00:00:00Z', accounts: [{ id: 'q1', platform: 'youtube' }], categories: [] }];
  const bad = (v: number, t: string): Observation => ({ accountId: 'q1', metric: 'followers', value: v, observedAt: t, accuracy: 'exact' });
  const r = rankScope('wheel.subscribed', { now: fx.now, people, observations: [bad(-5, fx.now), bad(1.5, fx.now), bad(Number.NaN, fx.now), bad(9, 'not a date'), bad(9, '2027-01-01T00:00:00Z')] });
  assert.equal(r.entries.length, 0);
});
test('TikTok accounts never count in v1', () => {
  const people: PersonIn[] = [{ id: 'q', createdAt: '2026-01-01T00:00:00Z', accounts: [{ id: 't1', platform: 'tiktok' }], categories: [] }];
  const r = rankScope('wheel.subscribed', { now: fx.now, people, observations: [{ accountId: 't1', metric: 'followers', value: 10, observedAt: fx.now, accuracy: 'exact' }] });
  assert.deepEqual(r.unranked, [{ personId: 'q', reason: 'no_supported_account', linked: 0 }]);
});
test('input hash: stable for the same inputs, changes when any contributing value or population changes, and recomputes from the result', () => {
  const base = rankScope('wheel.subscribed', input);
  assert.equal(base.inputHash, inputHash(base.scope, base.policyVersion, base.entries, base.unranked));
  const changed = rankScope('wheel.subscribed', { ...input, observations: input.observations.map(o => o.accountId === 'a1' && o.metric === 'followers' ? { ...o, value: 1001 } : o) });
  assert.notEqual(changed.inputHash, base.inputHash);
  assert.notEqual(rankScope('wheel.subscribed', { ...input, people: input.people.slice(1) }).inputHash, base.inputHash);
  assert.notEqual(rankScope('wheel.active', input).inputHash, base.inputHash);
});
test('unknown scopes are refused; category slugs are validated', () => {
  assert.throws(() => rankScope('wheel.nope', input)); assert.throws(() => rankScope('category.Bad Slug', input));
  assert.doesNotThrow(() => rankScope('category.some-niche', input));
});
test('rankAll returns one result per scope in the order requested', () => {
  assert.deepEqual(rankAll(['wheel.active', 'wheel.viewed'], input).map(r => r.scope), ['wheel.active', 'wheel.viewed']);
});
test('policy versions are stored on every result', () => {
  assert.equal(rankScope('wheel.subscribed', input).policyVersion, 'wheel.subscribed@v1');
  assert.equal(rankScope('category.gamer', input).policyVersion, 'category.subscribed@v1');
});
