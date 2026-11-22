import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyProviderError, mapInstagram, mapYoutubeStatistics, toCount, windowCount } from '../../src/providers/map.js';

const NOW = Date.parse('2026-11-20T12:00:00Z');
const ago = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

test('toCount accepts safe non-negative integers and numeric strings only', () => {
  assert.equal(toCount('12345'), 12345); assert.equal(toCount(0), 0); assert.equal(toCount('0'), 0);
  for (const bad of [-1, 1.5, NaN, '1.5', '-3', '', 'abc', null, undefined, '9'.repeat(16), {}]) assert.equal(toCount(bad), null, String(bad));
});
test('windowCount counts items inside 30 days of a newest-first list and reports when it saw an older one', () => {
  assert.deepEqual(windowCount([ago(1), ago(10), ago(29.9), ago(31), ago(2)], NOW, 30), { count: 3, sawOlder: true }); // stops at the first old one
  assert.deepEqual(windowCount([ago(1), ago(2)], NOW, 30), { count: 2, sawOlder: false });
  assert.deepEqual(windowCount([], NOW, 30), { count: 0, sawOlder: false });
  assert.equal(windowCount(['junk', ago(1)], NOW, 30).count, 1);
  assert.equal(windowCount([new Date(NOW + 3_600_000).toISOString(), ago(1)], NOW, 30).count, 1); // future-dated item ignored
});
test('YouTube: normal channel gives views exact and subscribers rounded', () => {
  const r = mapYoutubeStatistics({ statistics: { subscriberCount: '1230000', viewCount: '987654321' } });
  assert.deepEqual(r, { outcome: 'ok', metrics: [{ metric: 'views', value: 987654321, accuracy: 'exact' }, { metric: 'followers', value: 1230000, accuracy: 'rounded3' }], detail: undefined });
});
test('B2 YouTube: hidden subscribers produce NO followers metric, never zero; views still count', () => {
  const r = mapYoutubeStatistics({ statistics: { hiddenSubscriberCount: true, subscriberCount: '0', viewCount: '500' } });
  assert.equal(r.outcome, 'ok'); assert.deepEqual(r.metrics.map(m => m.metric), ['views']); assert.match(r.detail ?? '', /followers_hidden/);
});
test('YouTube: hidden subscribers and no views is outcome hidden with no metrics; missing channel is not_found', () => {
  assert.deepEqual(mapYoutubeStatistics({ statistics: { hiddenSubscriberCount: true } }).outcome, 'hidden');
  assert.equal(mapYoutubeStatistics(undefined).outcome, 'not_found');
  assert.equal(mapYoutubeStatistics({ statistics: {} }).outcome, 'error');
});
test('YouTube: a real zero is stored as zero', () => {
  const r = mapYoutubeStatistics({ statistics: { subscriberCount: '0', viewCount: '0' } });
  assert.deepEqual(r.metrics.map(m => [m.metric, m.value]), [['views', 0], ['followers', 0]]);
});
const body = (over: object = {}, media?: string[]) => ({ business_discovery: { id: '178', username: 'Someone', followers_count: 5000, ...(media ? { media: { data: media.map(timestamp => ({ timestamp })) } } : {}), ...over } });
test('Instagram: followers exact, posts counted in 30 days, id learned', () => {
  const r = mapInstagram(body({}, [ago(1), ago(5), ago(40)]), 200, 'someone', NOW, 50);
  assert.equal(r.outcome, 'ok'); assert.deepEqual(r.metrics, [{ metric: 'followers', value: 5000, accuracy: 'exact' }, { metric: 'posts_30d', value: 2, accuracy: 'exact' }]); assert.equal(r.resolvedExternalId, '178');
});
test('Instagram: page cap hit with every item inside the window is flagged capped; fewer than the cap is not', () => {
  const full = Array.from({ length: 50 }, (_, i) => ago(i * 0.1));
  const r = mapInstagram(body({}, full), 200, 'someone', NOW, 50);
  assert.deepEqual(r.metrics[1], { metric: 'posts_30d', value: 50, accuracy: 'exact', capped: true }); assert.equal(r.detail, 'posts_capped,avatar_missing');
  assert.equal((mapInstagram(body({}, full.slice(0, 49)), 200, 'someone', NOW, 50).metrics[1] as any).capped, undefined);
  // 50 items but the 50th is older than 30 days: window fully covered, not capped
  assert.equal((mapInstagram(body({}, [...full.slice(0, 49), ago(45)]), 200, 'someone', NOW, 50).metrics[1] as any).capped, undefined);
});
test('Instagram: error codes map to the right outcome', () => {
  assert.equal(mapInstagram({ error: { code: 4 } }, 400, 'x', NOW, 50).outcome, 'rate_limited');
  assert.equal(mapInstagram({ error: { code: 613 } }, 400, 'x', NOW, 50).outcome, 'rate_limited');
  assert.equal(mapInstagram({ error: { code: 110 } }, 400, 'x', NOW, 50).outcome, 'unsupported');
  assert.equal(mapInstagram(null, 500, 'x', NOW, 50).outcome, 'error');
  assert.equal(mapInstagram(null, 429, 'x', NOW, 50).outcome, 'rate_limited');
  assert.equal(mapInstagram({}, 200, 'x', NOW, 50).outcome, 'unsupported');
});
test('Instagram: wrong username, missing or invalid followers are never turned into numbers', () => {
  assert.equal(mapInstagram(body({ username: 'other' }), 200, 'someone', NOW, 50).outcome, 'error');
  for (const bad of [undefined, -1, 1.5, 'abc', null]) { const r = mapInstagram(body({ followers_count: bad }), 200, 'someone', NOW, 50); assert.equal(r.outcome, 'unsupported'); assert.deepEqual(r.metrics, []); }
});
test('Instagram: no media field means no posts metric, not zero', () => {
  const r = mapInstagram(body(), 200, 'someone', NOW, 50);
  assert.deepEqual(r.metrics.map(m => m.metric), ['followers']); assert.equal(r.detail, 'media_unavailable,avatar_missing');
});
test('errors are classified: quota and rate limits are retryable rate_limited; config problems are labelled; others are errors', () => {
  assert.equal(classifyProviderError(new Error('YOUTUBE_SOFT_QUOTA_LIMIT')).outcome, 'rate_limited');
  assert.equal(classifyProviderError(new Error('YOUTUBE_403_quotaExceeded')).outcome, 'rate_limited');
  assert.equal(classifyProviderError(new Error('YOUTUBE_HTTP_429')).outcome, 'rate_limited');
  assert.deepEqual(classifyProviderError(new Error('YOUTUBE_API_KEY not configured')), { outcome: 'error', detail: 'not_configured' });
  assert.equal(classifyProviderError(new Error('boom')).outcome, 'error');
  assert.ok(classifyProviderError(new Error('x'.repeat(500))).detail.length <= 120);
});
