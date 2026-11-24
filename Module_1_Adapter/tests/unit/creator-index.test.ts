import test from 'node:test';
import assert from 'node:assert/strict';
import { totalFollowers, latestAsOf, isStaleAsOf, parseSlugs, parseSort, parsePlatform } from '../../src/modules/public/creator-index-rules.js';

const fig = (followers: number | null, asOf: string | null) => ({ platform: 'youtube', followers, views: null, posts30d: null, asOf });

test('followers add up across accounts; no figure is null, a real zero stays zero', () => {
  assert.equal(totalFollowers([fig(10, null), fig(5, null)]), 15);
  assert.equal(totalFollowers([fig(null, null)]), null);
  assert.equal(totalFollowers([]), null);
  assert.equal(totalFollowers([fig(0, null)]), 0);
  assert.equal(totalFollowers([fig(-4, null), fig(Number.NaN, null)]), null);
});
test('the newest date wins and old figures are flagged, not hidden', () => {
  assert.equal(latestAsOf([fig(1, '2026-11-01T00:00:00Z'), fig(1, '2026-11-20T00:00:00Z')]), '2026-11-20T00:00:00Z');
  const now = Date.parse('2026-11-24T00:00:00Z');
  assert.equal(isStaleAsOf('2026-11-20T00:00:00Z', now), false);
  assert.equal(isStaleAsOf('2026-11-10T00:00:00Z', now), true);
  assert.equal(isStaleAsOf(null, now), false);
});
test('slugs: at most four, distinct, well formed', () => {
  assert.deepEqual(parseSlugs('a-b, c-d,a-b,e-f,g-h,i-j'), ['a-b', 'c-d', 'e-f', 'g-h']);
  assert.deepEqual(parseSlugs("x';drop,../y,ok-slug"), ['ok-slug']);
  assert.deepEqual(parseSlugs(undefined), []);
});
test('sort and platform only accept known values', () => {
  assert.equal(parseSort('followers'), 'followers');
  assert.equal(parseSort('name; DROP TABLE'), 'rank');
  assert.equal(parsePlatform('instagram'), 'instagram');
  assert.equal(parsePlatform('tiktok'), '');
});
