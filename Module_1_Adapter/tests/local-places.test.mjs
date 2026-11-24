import test from 'node:test';
import assert from 'node:assert/strict';
import { placeScore, eligible, topPlaces, isFresh, searchPlan, parseCity, CITY_SLUGS, MIN_REVIEWS } from '../src/modules/local/rules.mjs';

test('score: many reviews beat a perfect rating from a few', () => {
  assert.ok(placeScore(4.6, 4000) > placeScore(5, 3));
  assert.equal(placeScore(0, 100), null);
  assert.equal(placeScore('x', 100), null);
  assert.equal(placeScore(4.5, -1), null);
});
test('eligibility: needs rating, enough reviews, and to be open; missing is never zero', () => {
  const ok = { id: 'a', name: 'A', rating: 4.5, reviews: MIN_REVIEWS };
  assert.equal(eligible(ok), true);
  assert.equal(eligible({ ...ok, reviews: MIN_REVIEWS - 1 }), false);
  assert.equal(eligible({ ...ok, rating: NaN }), false);
  assert.equal(eligible({ ...ok, reviews: undefined }), false);
  assert.equal(eligible({ ...ok, status: 'CLOSED_PERMANENTLY' }), false);
  assert.equal(eligible({ ...ok, status: 'OPERATIONAL' }), true);
  assert.equal(eligible(null), false);
});
test('top list: sorted, de-duplicated, capped, ties by reviews then name', () => {
  const list = [
    { id: 'x', name: 'Xylo', rating: 4.5, reviews: 500 }, { id: 'x', name: 'Xylo again', rating: 4.9, reviews: 9000 },
    { id: 'b', name: 'Beta', rating: 4.5, reviews: 500 }, { id: 'tiny', name: 'Tiny', rating: 5, reviews: 3 },
    { id: 'big', name: 'Big', rating: 4.6, reviews: 4000 },
  ];
  const t = topPlaces(list, 20);
  assert.deepEqual(t.map(p => p.id), ['big', 'b', 'x']);
  assert.equal(topPlaces(list, 2).length, 2);
  assert.deepEqual(topPlaces([], 20), []);
});
test('freshness: hidden after 30 days', () => {
  const now = Date.parse('2026-11-25T00:00:00Z');
  assert.equal(isFresh('2026-11-01T00:00:00Z', now), true);
  assert.equal(isFresh('2026-10-01T00:00:00Z', now), false);
  assert.equal(isFresh('nonsense', now), false);
});
test('search plan: spread across the three cities, capped by budget', () => {
  const p = searchPlan(30);
  assert.equal(p.length, 30);
  for (const c of CITY_SLUGS) assert.equal(p.filter(x => x.city === c).length, 10);
  const small = searchPlan(4);
  assert.equal(small.length, 4);
  assert.deepEqual([...new Set(small.map(x => x.city))].sort(), ['islamabad', 'karachi', 'lahore']);
  assert.ok(searchPlan(1000).length <= 30);
});
test('city parsing only accepts the three cities', () => {
  assert.equal(parseCity('karachi'), 'karachi');
  assert.equal(parseCity("x';--"), '');
  assert.equal(parseCity(undefined), '');
});

import { isPlaceId, isAllowedMapsUrl, extractMapsName, looksLikeUrl, parseMode } from '../src/modules/local/rules.mjs';
test('admin input: only safe place ids, Google Maps links and known modes', () => {
  assert.equal(isPlaceId('ChIJN1t_tDeuEmsRUsoyG83frY4'), true);
  assert.equal(isPlaceId("x'; DROP"), false);
  assert.equal(isPlaceId('short'), false);
  assert.equal(isAllowedMapsUrl('https://www.google.com/maps/place/Butt+Karahi/@31.5,74.3,17z'), true);
  assert.equal(isAllowedMapsUrl('https://maps.app.goo.gl/abc123'), true);
  assert.equal(isAllowedMapsUrl('http://www.google.com/maps/place/x'), false);
  assert.equal(isAllowedMapsUrl('https://evil.example.com/maps/place/x'), false);
  assert.equal(isAllowedMapsUrl('https://google.com@evil.example.com/'), false);
  assert.equal(isAllowedMapsUrl('https://user:pw@www.google.com/maps'), false);
  assert.equal(isAllowedMapsUrl('file:///etc/passwd'), false);
  assert.equal(extractMapsName('https://www.google.com/maps/place/Butt+Karahi+Tikka/@31.5,74.3,17z/data=!3m1'), 'Butt Karahi Tikka');
  assert.equal(extractMapsName('https://www.google.com/maps/place/Caf%C3%A9+Aylanto/@31.5,74.3'), 'Café Aylanto');
  assert.equal(extractMapsName('https://www.google.com/maps/@31.5,74.3,12z'), null);
  assert.equal(extractMapsName('https://www.google.com/maps/place/31.5,74.3'), null);
  assert.equal(looksLikeUrl('https://maps.app.goo.gl/x'), true);
  assert.equal(looksLikeUrl('Butt Karahi'), false);
  assert.equal(parseMode('pick'), 'pick'); assert.equal(parseMode('hide'), 'hide'); assert.equal(parseMode('delete'), '');
});
