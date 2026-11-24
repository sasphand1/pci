import test from 'node:test';
import assert from 'node:assert/strict';
import { instagramAvatarPrioritySlots, INSTAGRAM_ACCOUNT_SELECTION_SQL } from '../../src/modules/refresh/avatar-selection.js';
import { graphAvatarNextAllowedAt, GRAPH_AVATAR_RUN_LIMIT } from '../../src/modules/ingest/graph-avatar-policy.js';
import { fetchGraphInstagramAvatar } from '../../src/providers/instagram-avatar.js';

const stamp = Date.parse('2026-11-24T22:00:00.000Z');
const env = { INSTAGRAM_GRAPH_ACCESS_TOKEN: 'fake-test-token', INSTAGRAM_GRAPH_OWNER_ID: '123456' };
const result = (body: unknown, status = 200) => (async (_url: URL, _init?: RequestInit) =>
  new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})) as typeof fetch;

test('Instagram refresh reserves image recovery slots but retains regular rotation', () => {
  assert.equal(instagramAvatarPrioritySlots(1),1);
  assert.equal(instagramAvatarPrioritySlots(5),3);
  assert.equal(instagramAvatarPrioritySlots(12),6);
  assert.equal(instagramAvatarPrioritySlots(35),18);
  assert.match(INSTAGRAM_ACCOUNT_SELECTION_SQL,/avatar_url IS NULL OR btrim\(avatar_url\)=''/);
  assert.match(INSTAGRAM_ACCOUNT_SELECTION_SQL,/regular_rotation/);
  assert.match(INSTAGRAM_ACCOUNT_SELECTION_SQL,/LIMIT GREATEST/);
  assert.match(INSTAGRAM_ACCOUNT_SELECTION_SQL,/\$3::int/);
});

test('Meta recovery has a strict batch maximum and a persistent refresh cooldown', () => {
  assert.equal(GRAPH_AVATAR_RUN_LIMIT,5);
  assert.equal(graphAvatarNextAllowedAt({last_refresh:new Date(stamp-5*60_000),last_graph:null,last_limited:null},stamp),
    new Date(stamp+55*60_000).toISOString());
  assert.equal(graphAvatarNextAllowedAt({last_refresh:null,last_graph:new Date(stamp-61*60_000),last_limited:null},stamp),null);
  assert.equal(graphAvatarNextAllowedAt({last_refresh:null,last_graph:null,last_limited:new Date(stamp-5*3_600_000)},stamp),
    new Date(stamp+3_600_000).toISOString());
  assert.equal(graphAvatarNextAllowedAt({last_refresh:null,last_graph:null,last_limited:null},stamp),null);
});

test('official Meta picture request uses authorized Business Discovery and saves trusted URLs', async () => {
  let reqUrl='';let authorization='';
  const probe=await fetchGraphInstagramAvatar('rabeecakhan',env,(async (url: URL, init?: RequestInit)=>{
    reqUrl=String(url); authorization=new Headers(init?.headers).get('Authorization')??'';
    return new Response(JSON.stringify({business_discovery:{username:'rabeecakhan',profile_picture_url:'https://scontent.xx.fbcdn.net/real.jpg'}}));
  }) as typeof fetch);
  assert.equal(probe.status,'ok');
  assert.equal(probe.url,'https://scontent.xx.fbcdn.net/real.jpg');
  assert.equal(new URL(reqUrl).hostname,'graph.facebook.com');
  assert.match(new URL(reqUrl).searchParams.get('fields')??'',/profile_picture_url/);
  assert.equal(authorization,'Bearer fake-test-token');
});

test('Meta missing, unsafe, mismatch and failed authentication are distinguishable', async () => {
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,result({business_discovery:{username:'rabeecakhan'}})),{status:'missing'});
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,result({business_discovery:{username:'rabeecakhan',profile_picture_url:'https://evil.test/bad.jpg'}})),{status:'rejected'});
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,result({business_discovery:{username:'other',profile_picture_url:'https://scontent.xx.fbcdn.net/a.jpg'}})),{status:'identity_mismatch'});
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,result({error:{code:190}},400)),{status:'token_invalid'});
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,result({error:{code:4}},429)),{status:'rate_limited'});
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',{},result({})),{status:'not_configured'});
  assert.deepEqual(await fetchGraphInstagramAvatar('invalid handle',env,result({})),{status:'unsupported'});
});

test('Meta failures never expose tokens in errors or accept spoofed image domains', async () => {
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,result({business_discovery:{username:'rabeecakhan',profile_picture_url:'https://x.fbcdn.net.evil.test/a.jpg'}})),{status:'rejected'});
  const badFetch=(async()=>{throw new Error('fake-test-token');}) as typeof fetch;
  assert.deepEqual(await fetchGraphInstagramAvatar('rabeecakhan',env,badFetch),{status:'unavailable'});
});
