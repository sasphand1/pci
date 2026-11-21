import test from 'node:test';
import assert from 'node:assert/strict';
import { pickAvatar, safeAvatarUrl } from '../../src/providers/avatar.js';
import { makeYoutubeProvider } from '../../src/providers/youtube.js';

test('only https links on known YouTube image hosts are kept', () => {
  assert.equal(safeAvatarUrl('https://yt3.ggpht.com/abc=s240'), 'https://yt3.ggpht.com/abc=s240');
  for (const bad of ['http://yt3.ggpht.com/a', 'https://evil.example/a', 'https://yt3.ggpht.com.evil.example/a', 'javascript:alert(1)', 'https://u:p@yt3.ggpht.com/a', '', null, 5, 'https://yt3.ggpht.com/' + 'a'.repeat(600)]) assert.equal(safeAvatarUrl(bad as unknown), null, String(bad));
});
test('medium is preferred, then high, then default; unsafe entries are skipped', () => {
  assert.equal(pickAvatar({ default: { url: 'https://i.ytimg.com/d' }, medium: { url: 'https://i.ytimg.com/m' } }), 'https://i.ytimg.com/m');
  assert.equal(pickAvatar({ medium: { url: 'https://evil.example/m' }, high: { url: 'https://i.ytimg.com/h' } }), 'https://i.ytimg.com/h');
  assert.equal(pickAvatar(undefined), null); assert.equal(pickAvatar({}), null);
});
test('the YouTube provider passes the picture along only for accounts that were fetched', async () => {
  const ch = (id: string, stats: any) => ({ id, snippet: { thumbnails: { medium: { url: `https://yt3.ggpht.com/${id}` } } }, statistics: stats, contentDetails: { relatedPlaylists: { uploads: 'UU' + id } } });
  const client: any = { channels: async () => [ch('A', { subscriberCount: '10', viewCount: '100', videoCount: '1' }), ch('B', { hiddenSubscriberCount: true })], uploadsPage: async () => ({ published: [], next: undefined }) };
  const out = await makeYoutubeProvider(client, () => new Date('2026-11-20T00:00:00Z')).fetch([
    { id: 'a1', platform: 'youtube', externalId: 'A', handle: 'a' }, { id: 'b1', platform: 'youtube', externalId: 'B', handle: 'b' }, { id: 'c1', platform: 'youtube', externalId: 'C', handle: 'c' }]);
  const by = Object.fromEntries(out.map(r => [r.accountId, r]));
  assert.equal(by.a1.avatarUrl, 'https://yt3.ggpht.com/A');
  assert.equal(by.b1.outcome, 'hidden'); assert.equal(by.b1.avatarUrl, undefined);
  assert.equal(by.c1.outcome, 'not_found'); assert.equal(by.c1.avatarUrl, undefined);
});
