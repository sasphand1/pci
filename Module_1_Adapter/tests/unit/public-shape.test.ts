import test from 'node:test';
import assert from 'node:assert/strict';
import { SCOPE_RE, accountUrl, categorySlug, hoursSince, isStale, likePattern, pageOf, scopeInfo, toEntries } from '../../src/modules/public/shape.js';

test('scopes: the five fixed ones and category scopes are accepted, anything else is not', () => {
  for (const s of ['wheel.subscribed', 'wheel.viewed', 'wheel.active', 'youtube.subscribed', 'instagram.followers', 'category.gamer', 'category.tech-reviews']) assert.ok(SCOPE_RE.test(s), s);
  for (const s of ['', 'wheel', 'wheel.other', 'category.', 'category.A', 'category.x', "category.a'b", 'youtube.views', 'tiktok.followers', 'wheel.subscribed ']) assert.ok(!SCOPE_RE.test(s), s);
});
test('wheel wording is fixed', () => {
  assert.equal(scopeInfo('wheel.subscribed')!.label, 'Most Subscribed');
  assert.equal(scopeInfo('wheel.viewed')!.unit, 'YouTube lifetime views');
  assert.equal(scopeInfo('wheel.active')!.unit, 'posts in the last 30 days');
  assert.equal(scopeInfo('category.gamer', 'Gamers')!.label, 'Gamers');
  assert.equal(scopeInfo('category.gamer')!.label, 'gamer');
  assert.equal(scopeInfo('nonsense'), null);
  assert.equal(categorySlug('category.gamer'), 'gamer'); assert.equal(categorySlug('wheel.viewed'), null);
});
test('account links only for well-formed ids and handles', () => {
  assert.equal(accountUrl('youtube', 'UC' + 'a'.repeat(22), 'x'), 'https://www.youtube.com/channel/UC' + 'a'.repeat(22));
  assert.equal(accountUrl('youtube', 'pending:foo', 'foo'), null);
  assert.equal(accountUrl('instagram', 'pending:foo', '@some.user_1'), 'https://www.instagram.com/some.user_1/');
  assert.equal(accountUrl('instagram', '1', 'a/b'), null); assert.equal(accountUrl('instagram', '1', 'x'.repeat(31)), null);
  assert.equal(accountUrl('tiktok', '1', 'x'), null);
});
test('search terms are matched literally', () => {
  assert.equal(likePattern('50%_off\\'), '%50\\%\\_off\\\\%'); assert.equal(likePattern('ali'), '%ali%');
});
test('freshness: 36 hours is the line', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(hoursSince('2026-11-19T12:00:00Z', now), 24);
  assert.equal(isStale('2026-11-19T12:00:00Z', now), false);
  assert.equal(isStale('2026-11-18T22:59:00Z', now), true);
  assert.equal(isStale(null, now), true); assert.equal(isStale('garbage', now), true);
});
test('paging', () => { assert.deepEqual(pageOf(2, 25, 60), { page: 2, limit: 25, total: 60, pages: 3 }); assert.equal(pageOf(1, 25, 0).pages, 1); });
test('a slot whose person cannot be found is dropped, not shown blank', () => {
  const people = new Map([['a', { slug: 'a' }]]);
  const rows = [
    { slot: 1, rank: 1, personId: 'a', value: '500', tied: false, breakdown: [{ platform: 'youtube', value: 300 }, { platform: 'instagram', value: 200 }] },
    { slot: 2, rank: 2, personId: 'gone', value: '10', tied: false, breakdown: [] }];
  const e = toEntries(rows, people);
  assert.equal(e.length, 1); assert.equal(e[0].value, 500); assert.equal(e[0].counted, 2); assert.deepEqual(e[0].contributions.map(c => c.value), [300, 200]);
});
