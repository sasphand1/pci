import assert from 'node:assert/strict';
import {test} from 'node:test';
import {probeInstagramAvatar} from '../../src/modules/ingest/http.ts';
import {avatarRetryHours,shouldPauseSource} from '../../src/modules/ingest/monitor-rules.ts';
const html=(body:string)=>new Response(body,{status:200,headers:{'content-type':'text/html'}});
const good='<meta property="og:url" content="https://www.instagram.com/someone/"><meta property="og:image" content="https://scontent.cdninstagram.com/v/pic.jpg">';
const fake=(r:Response|Error)=>(async()=>{if(r instanceof Error)throw r;return r;}) as unknown as typeof fetch;
process.env.PCI_INSTAGRAM_HTTP_AVATARS='true';
test('probe returns the picture for a matching profile page',async()=>{
  const r=await probeInstagramAvatar('someone',fake(html(good)));
  assert.equal(r.url,'https://scontent.cdninstagram.com/v/pic.jpg');assert.equal(r.error,undefined);
});
test('probe classifies redirects, 403/429, 404, 500 and network errors',async()=>{
  assert.equal((await probeInstagramAvatar('someone',fake(new Response(null,{status:302})))).error,'BLOCKED');
  assert.equal((await probeInstagramAvatar('someone',fake(new Response('no',{status:403})))).error,'BLOCKED');
  assert.equal((await probeInstagramAvatar('someone',fake(new Response('no',{status:429})))).error,'BLOCKED');
  assert.equal((await probeInstagramAvatar('someone',fake(new Response('no',{status:404})))).error,'SHAPE_CHANGED');
  assert.equal((await probeInstagramAvatar('someone',fake(new Response('no',{status:500})))).error,'UNAVAILABLE');
  assert.equal((await probeInstagramAvatar('someone',fake(new Error('net')))).error,'TIMEOUT');
});
test('probe: a page without the expected markup is SHAPE_CHANGED, a captcha page is BLOCKED',async()=>{
  assert.equal((await probeInstagramAvatar('someone',fake(html('<html>login</html>')))).error,'SHAPE_CHANGED');
  assert.equal((await probeInstagramAvatar('someone',fake(html('<html>unusual traffic</html>')))).error,'BLOCKED');
});
test('probe refuses another account\'s page and bad handles',async()=>{
  assert.equal((await probeInstagramAvatar('other',fake(html(good)))).url,null);
  assert.equal((await probeInstagramAvatar('bad handle!',fake(html(good)))).error,'INVALID');
});
test('probe does nothing unless the env flag is on',async()=>{
  process.env.PCI_INSTAGRAM_HTTP_AVATARS='false';
  assert.equal((await probeInstagramAvatar('someone',fake(html(good)))).error,'DISABLED');
  process.env.PCI_INSTAGRAM_HTTP_AVATARS='true';
});
test('circuit breaker rests the source after 3 failures for 6 hours',()=>{
  const now=Date.parse('2026-11-24T12:00:00Z');
  assert.equal(shouldPauseSource(2,'2026-11-24T11:00:00Z',now),false);
  assert.equal(shouldPauseSource(3,'2026-11-24T11:00:00Z',now),true);
  assert.equal(shouldPauseSource(3,'2026-11-24T05:00:00Z',now),false);
  assert.equal(shouldPauseSource(5,null,now),false);
});
test('retry window is a day, then a week after 3 tries',()=>{assert.equal(avatarRetryHours(1),24);assert.equal(avatarRetryHours(3),168);});
