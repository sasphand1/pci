import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectProfileAvatar, safeAvatarUrl } from '../../src/providers/avatar.js';
import { mapInstagram } from '../../src/providers/map.js';
import { makeInstagramProvider } from '../../src/providers/instagram.js';
import { normalizeResults } from '../../src/modules/refresh/normalize.js';

const now = Date.parse('2026-11-22T12:00:00Z');
test('trusted Instagram and Facebook CDN image hosts accepted without changing YouTube images', () => {
  assert.equal(safeAvatarUrl('https://scontent.cdninstagram.com/a.jpg'), 'https://scontent.cdninstagram.com/a.jpg');
  assert.equal(safeAvatarUrl('https://scontent.xx.fbcdn.net/a.jpg'), 'https://scontent.xx.fbcdn.net/a.jpg');
  assert.equal(safeAvatarUrl('https://yt3.googleusercontent.com/a.jpg'), 'https://yt3.googleusercontent.com/a.jpg');
});
test('invalid, insecure and deceptive hosts are rejected', () => {
  for (const u of ['http://scontent.cdninstagram.com/a.jpg','https://cdninstagram.com.evil.test/a.jpg','https://fbcdn.net.evil.test/a.jpg','https://evil.test/a.jpg','https://foo@bar.cdninstagram.com/a.jpg','javascript:alert(1)']) assert.equal(safeAvatarUrl(u), null, u);
});
test('business discovery maps a trusted profile picture without affecting follower metrics', () => {
  const r = mapInstagram({ business_discovery: { id:'178', username:'rabeecakhan', followers_count:6443997, profile_picture_url:'https://scontent.cdninstagram.com/avatar.jpg' }}, 200, 'rabeecakhan', now, 50);
  assert.equal(r.outcome, 'ok'); assert.equal(r.avatarUrl, 'https://scontent.cdninstagram.com/avatar.jpg');
  assert.equal(r.metrics[0].value, 6443997);
});
test('untrusted or missing profile pictures do not prevent statistics collection', () => {
  const r = mapInstagram({ business_discovery: { username:'rabeecakhan', followers_count:20, profile_picture_url:'https://evil.test/a.jpg' }}, 200, 'rabeecakhan', now, 50);
  assert.equal(r.outcome, 'ok'); assert.equal(r.avatarUrl, undefined); assert.equal(r.metrics[0].value, 20);
});
test('provider requests profile_picture_url through Meta and returns the image', async () => {
  let url='';
  const provider = makeInstagramProvider({INSTAGRAM_GRAPH_ACCESS_TOKEN:'test', INSTAGRAM_GRAPH_OWNER_ID:'123'}, () => new Date(now), (async (u: URL) => {url=String(u); return new Response(JSON.stringify({business_discovery:{username:'rabeecakhan',followers_count:22,profile_picture_url:'https://scontent.xx.fbcdn.net/pic.jpg'}}));}) as typeof fetch);
  const [r] = await provider.fetch([{id:'a',platform:'instagram',externalId:'178',handle:'rabeecakhan'}]);
  assert.equal(new URL(url).searchParams.get('fields')?.includes('profile_picture_url'),true);
  assert.equal(r.avatarUrl, 'https://scontent.xx.fbcdn.net/pic.jpg');
});

test('legacy YouTube image length limit remains strict while signed Meta CDN URLs can be longer', () => {
  assert.equal(safeAvatarUrl('https://yt3.ggpht.com/' + 'a'.repeat(600)), null);
  const meta = 'https://scontent.xx.fbcdn.net/' + 'a'.repeat(600);
  assert.equal(safeAvatarUrl(meta), meta);
});

test('missing and rejected Meta picture fields are diagnosed without recording URLs', () => {
  const missing = mapInstagram({business_discovery: {username:'rabeecakhan', followers_count:22}},200,'rabeecakhan',now,50);
  assert.equal(missing.outcome,'ok');
  assert.equal(missing.detail,'media_unavailable,avatar_missing');
  assert.equal(missing.avatarUrl,undefined);
  const rejected = mapInstagram({business_discovery: {username:'rabeecakhan', followers_count:22, profile_picture_url:'https://untrusted.example.net/avatar.jpg'}},200,'rabeecakhan',now,50);
  assert.equal(rejected.outcome,'ok');
  assert.equal(rejected.detail,'media_unavailable,avatar_rejected');
  assert.equal(rejected.avatarUrl,undefined);
  assert.deepEqual(inspectProfileAvatar(null),{issue:'avatar_missing'});
  assert.equal(inspectProfileAvatar('https://scontent.xx.fbcdn.net/a.jpg').avatarUrl,'https://scontent.xx.fbcdn.net/a.jpg');
});

test('unified refresh normalization preserves Instagram avatar URLs and accurate metrics', () => {
  const account = {id:'acct',platform:'instagram' as const,handle:'rabeecakhan',externalId:'178'};
  const mapped = mapInstagram({business_discovery:{username:'rabeecakhan',followers_count:42,profile_picture_url:'https://scontent.xx.fbcdn.net/pic.jpg'}},200,account.handle,now,50);
  const [result] = normalizeResults([account],[{accountId:account.id,...mapped}]);
  assert.equal(result.avatarUrl,'https://scontent.xx.fbcdn.net/pic.jpg');
  assert.equal(result.outcome,'ok');
  assert.deepEqual(result.metrics,[{metric:'followers',value:42,accuracy:'exact'}]);
});
