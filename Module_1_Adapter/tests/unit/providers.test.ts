import test from 'node:test';
import assert from 'node:assert/strict';
import { makeYoutubeProvider } from '../../src/providers/youtube.js';
import { makeInstagramProvider } from '../../src/providers/instagram.js';
import { tiktokProvider } from '../../src/providers/tiktok.js';
import type { AccountRef } from '../../src/providers/types.js';

const NOW = new Date('2026-11-20T12:00:00Z');
const ago = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const UC = (n: number) => 'UC' + String(n).padStart(22, '0');
const yt = (n: number): AccountRef => ({ id: `acc${n}`, platform: 'youtube', externalId: UC(n), handle: `@h${n}` });
const chan = (n: number, over: any = {}) => ({ id: UC(n), statistics: { subscriberCount: '1000', viewCount: '5000', videoCount: '10' }, contentDetails: { relatedPlaylists: { uploads: `UU${String(n).padStart(22, '0')}` } }, ...over });

test('YouTube: channel statistics survive even when the uploads lookup fails (they are independent)', async () => {
  const p = makeYoutubeProvider({ channels: async () => [chan(1)], uploadsPage: async () => { throw new Error('YOUTUBE_HTTP_500'); } }, () => NOW);
  const [r] = await p.fetch([yt(1)]);
  assert.equal(r.outcome, 'ok'); assert.deepEqual(r.metrics.map(m => m.metric).sort(), ['followers', 'views']); assert.match(r.detail ?? '', /posts_unavailable/);
});
test('YouTube: posts_30d counts uploads inside 30 days across pages and stops at the first older one', async () => {
  const pages: Record<string, { published: string[]; next?: string }> = { first: { published: [ago(1), ago(2)], next: 'second' }, second: { published: [ago(20), ago(29), ago(31), ago(1)] } };
  const requested: Array<string | undefined> = [];
  const p = makeYoutubeProvider({ channels: async () => [chan(1)], uploadsPage: async (_pl, token) => { requested.push(token); return pages[token ?? 'first']; } }, () => NOW);
  const [r] = await p.fetch([yt(1)]);
  assert.equal(r.metrics.find(m => m.metric === 'posts_30d')?.value, 4); assert.deepEqual(requested, [undefined, 'second']);
  assert.equal(r.metrics.find(m => m.metric === 'posts_30d')?.capped, undefined);
});
test('YouTube: paging stops as soon as an upload older than 30 days is seen (saves quota), even if more pages exist', async () => {
  const requested: Array<string | undefined> = [];
  const p = makeYoutubeProvider({ channels: async () => [chan(1)], uploadsPage: async (_pl, token) => { requested.push(token); return { published: [ago(1), ago(40)], next: 'never' }; } }, () => NOW);
  const [r] = await p.fetch([yt(1)]);
  assert.deepEqual(requested, [undefined]); assert.equal(r.metrics.find(m => m.metric === 'posts_30d')?.value, 1);
});
test('YouTube: the page cap is recorded when every page is still inside the window', async () => {
  let n = 0;
  const p = makeYoutubeProvider({ channels: async () => [chan(1)], uploadsPage: async () => { n++; return { published: Array.from({ length: 50 }, () => ago(1)), next: 'more' }; } }, () => NOW);
  const [r] = await p.fetch([yt(1)]);
  assert.equal(n, 4); const m = r.metrics.find(x => x.metric === 'posts_30d')!; assert.equal(m.value, 200); assert.equal(m.capped, true);
});
test('YouTube: batches of 50, one result per account, missing channels are not_found, hidden subscribers give no followers', async () => {
  const seen: number[] = [];
  const accounts = Array.from({ length: 120 }, (_, i) => yt(i + 1));
  const p = makeYoutubeProvider({
    channels: async ids => { seen.push(ids.length); return ids.filter(id => id !== UC(7)).map(id => { const n = Number(id.slice(2)); return n === 3 ? chan(n, { statistics: { hiddenSubscriberCount: true, subscriberCount: '0', viewCount: '9' } }) : chan(n); }); },
    uploadsPage: async () => ({ published: [] })
  }, () => NOW);
  const out = await p.fetch(accounts);
  assert.deepEqual(seen, [50, 50, 20]); assert.equal(out.length, 120); assert.deepEqual(out.map(r => r.accountId), accounts.map(a => a.id));
  assert.equal(out[6].outcome, 'not_found');
  assert.deepEqual(out[2].metrics.map(m => m.metric).sort(), ['posts_30d', 'views']);
  assert.equal(out[0].metrics.find(m => m.metric === 'posts_30d')?.value, 0); // a real zero when the channel has no recent uploads
});
test('YouTube: if a whole batch fails, every account in it gets the same outcome and the other batches still run', async () => {
  let call = 0;
  const p = makeYoutubeProvider({ channels: async ids => { if (++call === 1) throw new Error('YOUTUBE_SOFT_QUOTA_LIMIT'); return ids.map(id => chan(Number(id.slice(2)))); }, uploadsPage: async () => ({ published: [] }) }, () => NOW);
  const out = await p.fetch(Array.from({ length: 60 }, (_, i) => yt(i + 1)));
  assert.ok(out.slice(0, 50).every(r => r.outcome === 'rate_limited')); assert.ok(out.slice(50).every(r => r.outcome === 'ok'));
});
const igEnv = { INSTAGRAM_GRAPH_ACCESS_TOKEN: 'tok', INSTAGRAM_GRAPH_OWNER_ID: '123' };
const igAcc = (u: string): AccountRef => ({ id: `ig-${u}`, platform: 'instagram', externalId: 'x', handle: u });
const reply = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
test('Instagram: not configured gives an error per account and makes no request', async () => {
  let hit = false;
  const out = await makeInstagramProvider({}, () => NOW, (async () => { hit = true; return new Response('{}'); }) as any).fetch([igAcc('a')]);
  assert.equal(out[0].detail, 'not_configured'); assert.equal(hit, false);
});
test('Instagram: only a fixed host is ever called, the token goes in a header, and bad usernames never reach the network', async () => {
  const urls: string[] = []; const headers: Array<Record<string, string>> = [];
  const f = (async (u: URL, init: any) => { urls.push(String(u)); headers.push(init.headers); return new Response(JSON.stringify({ business_discovery: { id: '9', username: 'good_one', followers_count: 10 } })); }) as any;
  const out = await makeInstagramProvider(igEnv, () => NOW, f).fetch([igAcc('good_one'), igAcc('bad name);drop')]);
  assert.equal(urls.length, 1); assert.ok(urls[0].startsWith('https://graph.facebook.com/')); assert.ok(!urls[0].includes('tok')); assert.equal(headers[0].Authorization, 'Bearer tok');
  assert.equal(out[1].detail, 'invalid_username'); assert.equal(out[0].resolvedExternalId, '9');
});
test('Instagram: after a rate-limit answer the remaining accounts are skipped as rate_limited (to be retried later)', async () => {
  let n = 0;
  const out = await makeInstagramProvider(igEnv, () => NOW, (async () => { n++; return n === 1 ? new Response(JSON.stringify({ business_discovery: { username: 'a', followers_count: 1 } })) : new Response(JSON.stringify({ error: { code: 4 } }), { status: 400 }); }) as any).fetch([igAcc('a'), igAcc('b'), igAcc('c'), igAcc('d')]);
  assert.deepEqual(out.map(r => r.outcome), ['ok', 'rate_limited', 'rate_limited', 'rate_limited']); assert.equal(n, 2);
});
test('Instagram: a non-professional account is unsupported, not zero', async () => {
  const out = await makeInstagramProvider(igEnv, () => NOW, reply({ error: { code: 110, message: 'x' } }, 400) as any).fetch([igAcc('private_one')]);
  assert.equal(out[0].outcome, 'unsupported'); assert.deepEqual(out[0].metrics, []);
});
test('TikTok is a stub: unsupported for everyone', async () => {
  const out = await tiktokProvider.fetch([{ id: 't', platform: 'tiktok', externalId: 'x', handle: 'x' }]);
  assert.deepEqual(out, [{ accountId: 't', outcome: 'unsupported', metrics: [], detail: 'tiktok_not_enabled' }]);
});

test('YouTube: 30 PKT calendar dates include local midnight and exclude the previous date and future uploads', async () => {
  const now = new Date('2026-11-26T20:00:00Z'); // 27 Nov, 01:00 PKT; cutoff 29 Oct, 00:00 PKT
  const p = makeYoutubeProvider({ channels: async () => [chan(1)], uploadsPage: async () => ({ published: ['2026-11-26T20:00:01Z', '2026-11-26T19:00:00Z', '2026-10-28T19:00:00Z', '2026-10-28T18:59:59Z'] }) }, () => now);
  const [r] = await p.fetch([yt(1)]);
  assert.equal(r.metrics.find(m => m.metric === 'posts_30d')?.value, 2);
});
