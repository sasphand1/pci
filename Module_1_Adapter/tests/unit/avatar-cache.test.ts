import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffImage, cachedAvatarUrl, avatarRetryDue, cacheHasRoom, looksBlocked } from '../../src/modules/ingest/avatar-cache-rules.js';
import { downloadAvatar } from '../../src/modules/ingest/avatar-download.js';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const ID = '123e4567-e89b-12d3-a456-426614174000';

test('sniffImage trusts bytes, not headers', () => {
  assert.equal(sniffImage(jpeg)?.contentType, 'image/jpeg');
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))?.contentType, 'image/png');
  assert.equal(sniffImage(new TextEncoder().encode('RIFF0000WEBPVP8 '))?.contentType, 'image/webp');
  assert.equal(sniffImage(new TextEncoder().encode('<html>login</html>')), null);
});
test('cachedAvatarUrl needs an https base and a valid id', () => {
  assert.match(cachedAvatarUrl('https://api.example.com/', ID, '2026-11-24T10:00:00Z')!, /^https:\/\/api\.example\.com\/api\/v1\/public\/avatars\/123e4567-.*\?v=\d+$/);
  assert.equal(cachedAvatarUrl(undefined, ID, new Date()), null);
  assert.equal(cachedAvatarUrl('http://api.example.com', ID, new Date()), null);
  assert.equal(cachedAvatarUrl('https://api.example.com', 'x/../y', new Date()), null);
});
test('retry windows: 6h after success, 24h after failure', () => {
  const now = Date.parse('2026-11-24T12:00:00Z');
  assert.equal(avatarRetryDue(null, null, now), true);
  assert.equal(avatarRetryDue('2026-11-24T10:00:00Z', 'http_403', now), false);
  assert.equal(avatarRetryDue('2026-11-23T10:00:00Z', 'http_403', now), true);
});
test('downloadAvatar refuses untrusted hosts without any request', async () => {
  let called = false;
  const r = await downloadAvatar('https://evil.example.com/a.jpg', (async () => { called = true; return new Response('x'); }) as typeof fetch);
  assert.equal(r.ok, false); assert.equal(called, false);
});
test('downloadAvatar stops at the size cap and does not follow redirects', async () => {
  const big = new Response(new Uint8Array(500_000));
  assert.equal((await downloadAvatar('https://scontent.cdninstagram.com/a.jpg', (async () => big) as typeof fetch)).status, 413);
  let opts: RequestInit | undefined;
  const ok = await downloadAvatar('https://scontent.cdninstagram.com/a.jpg', (async (_u: unknown, o?: RequestInit) => { opts = o; return new Response(jpeg); }) as typeof fetch);
  assert.equal(ok.ok, true); assert.equal(opts?.redirect, 'manual');
});

test('storage ceiling and blocked-host detection', () => {
  assert.equal(cacheHasRoom(49_600_000, 400_000), true);
  assert.equal(cacheHasRoom(49_600_000, 400_001), false);
  assert.equal(looksBlocked(['http_403', 'http_403', 'http_403']), true);
  assert.equal(looksBlocked(['http_403', 'ok', 'http_403']), false);
  assert.equal(looksBlocked(['http_403']), false);
});
