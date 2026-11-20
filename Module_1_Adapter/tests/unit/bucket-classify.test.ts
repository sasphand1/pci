import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyBatch, summarizeBatch, type ClassifyContext, type ResolveResult } from '../../src/modules/bucket/classify.js';
import { parseBulk } from '../../src/modules/bucket/parse.js';

const ok = (id: string, handle: string, displayName?: string): ResolveResult => ({ ok: true, externalId: id, handle, displayName });
function ctx(platform: 'youtube' | 'instagram', text: string, resolve: Record<string, ResolveResult>, over: Partial<ClassifyContext> = {}) {
  const { rows } = parseBulk(text);
  const resolutions = new Map<number, ResolveResult>();
  rows.forEach(r => { const k = r.raw.replace(/^@/, '').toLowerCase(); if (resolve[k]) resolutions.set(r.index, resolve[k]); });
  const c: ClassifyContext = { platform, resolutions, existingAccounts: new Set(), peopleByName: new Map(), peopleBySlug: new Map(), takenSlugs: new Set(), categorySlugs: new Set(['gamer', 'cooking']), ...over };
  return classifyBatch(rows, c);
}

test('a good row becomes a new person named after the provider display name', () => {
  const [r] = ctx('youtube', '@duckybhai', { duckybhai: ok('UC1', '@duckybhai', 'Ducky Bhai') });
  assert.equal(r.status, 'resolved'); assert.equal(r.addable, true);
  assert.deepEqual(r.target, { kind: 'new', displayName: 'Ducky Bhai', slug: 'ducky-bhai' });
});
test('every failure status is reachable and never addable', () => {
  const rows = ctx('youtube', 'bad handle\nmissing\nboom\ngood, , nope', {
    missing: { ok: false, reason: 'not_found' }, boom: { ok: false, reason: 'resolve_error' }, good: ok('UC9', '@good', 'Good') });
  assert.deepEqual(rows.map(r => r.status), ['invalid_format', 'not_found', 'resolve_error', 'unknown_niche']);
  assert.ok(rows.every(r => !r.addable));
  assert.ok(rows.every(r => r.hint && r.hint.length > 3));
});
test('duplicates: already in bucket and repeated inside the batch', () => {
  const rows = ctx('youtube', 'aaa\nbbb\nb2b', { aaa: ok('UC1', 'aaa'), bbb: ok('UC2', 'bbb'), b2b: ok('UC2', 'bbb') }, { existingAccounts: new Set(['youtube:UC1']) });
  assert.deepEqual(rows.map(r => r.status), ['duplicate_in_bucket', 'resolved', 'duplicate_in_batch']);
});
test('the same external id on a different platform is not a duplicate', () => {
  const [r] = ctx('instagram', 'aaa', { aaa: ok('1', 'aaa') }, { existingAccounts: new Set(['youtube:1']) });
  assert.equal(r.status, 'resolved');
});
test('typed person name links to an existing person on a missing platform (exact match only)', () => {
  const existing = { id: 'P1', platforms: new Set(['youtube' as const]) };
  const c = { peopleByName: new Map([['duckybhai', existing]]), peopleBySlug: new Map([['ducky-bhai', existing]]) };
  const [hit, near, same] = [
    ...ctx('instagram', 'aaa, Ducky Bhai', { aaa: ok('1', 'aaa') }, c),
    ...ctx('instagram', 'bbb, Ducky Bro', { bbb: ok('2', 'bbb') }, c),
    ...ctx('youtube', 'yyy, Ducky Bhai', { yyy: ok('UC7', 'yyy') }, c)];
  assert.deepEqual(hit.target, { kind: 'existing', personId: 'P1' });
  assert.equal(near.target?.kind, 'new');              // near-miss never links
  assert.equal(same.status, 'person_already_has_platform');
});
test('near-miss person names never link (prefix, suffix, extra word, typo)', () => {
  const existing = { id: 'P1', platforms: new Set(['youtube' as const]) };
  const c = { peopleByName: new Map([['duckybhai', existing]]), peopleBySlug: new Map([['ducky-bhai', existing]]) };
  for (const name of ['Ducky', 'Ducky Bhai Official', 'Ducky Bhaii', 'The Ducky Bhai', 'Duckybhai2']) {
    const [r] = ctx('instagram', `aaa, ${name}`, { aaa: ok('1', 'aaa') }, c);
    assert.equal(r.target?.kind, 'new', name);
  }
});
test('without a typed person name nothing is ever linked, even on identical display names', () => {
  const existing = { id: 'P1', platforms: new Set(['youtube' as const]) };
  const [r] = ctx('instagram', 'aaa', { aaa: ok('1', 'aaa', 'Ducky Bhai') }, { peopleByName: new Map([['duckybhai', existing]]) });
  assert.equal(r.target?.kind, 'new');
});
test('two rows naming the same new person in one batch share one person; a third on the same platform is refused', () => {
  const rows = ctx('youtube', 'aaa, Zed\nbbb, Zed', { aaa: ok('UC1', 'aaa'), bbb: ok('UC2', 'bbb') });
  assert.equal(rows[0].target?.kind, 'new'); assert.equal(rows[1].status, 'person_already_has_platform');
});
test('slugs never collide with existing people or with each other', () => {
  const rows = ctx('youtube', 'aaa\nbbb', { aaa: ok('UC1', 'aaa', 'Same Name'), bbb: ok('UC2', 'bbb', 'Same Name') }, { takenSlugs: new Set(['same-name']) });
  assert.deepEqual(rows.map(r => r.target?.kind === 'new' && r.target.slug), ['same-name-2', 'same-name-3']);
});
test('summary counts add up to the number of rows (completeness)', () => {
  const rows = ctx('youtube', 'aaa\nbad handle\nccc', { aaa: ok('UC1', 'aaa'), ccc: { ok: false, reason: 'not_found' } });
  const s = summarizeBatch(rows);
  assert.equal(Object.values(s.counts).reduce((x, y) => x + y, 0), s.total); assert.equal(s.addable, 1);
});
test('invariant (seeded random): addable rows never share an account key and every row gets exactly one status', () => {
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let n = 0; n < 200; n++) {
    const lines: string[] = []; const res: Record<string, ResolveResult> = {};
    const size = 1 + Math.floor(rnd() * 30);
    for (let i = 0; i < size; i++) {
      const h = `h${Math.floor(rnd() * 12)}abc`;
      lines.push(rnd() < 0.2 ? `${h}, Person${Math.floor(rnd() * 4)}` : h);
      res[h] = rnd() < 0.15 ? { ok: false, reason: 'not_found' } : ok(`UC${Math.floor(rnd() * 8)}`, h, `N${Math.floor(rnd() * 5)}`);
    }
    const rows = ctx('youtube', lines.join('\n'), res, { existingAccounts: new Set(rnd() < 0.5 ? ['youtube:UC1'] : []) });
    assert.equal(rows.length, lines.length);
    const keys = rows.filter(r => r.addable).map(r => r.externalId);
    assert.equal(new Set(keys).size, keys.length);
    const slugs = rows.flatMap(r => r.addable && r.target?.kind === 'new' ? [r.target.slug] : []);
    assert.equal(new Set(slugs).size, slugs.length);
  }
});
