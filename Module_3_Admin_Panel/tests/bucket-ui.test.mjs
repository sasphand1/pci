import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('.');
const read=(p)=>readFileSync(join(root,p),'utf8');

test('People (the bucket) and Pipeline screens exist and are in the navigation for owner and editor',()=>{
 for(const p of ['bucket','pipeline'])assert.ok(existsSync(join(root,`src/app/${p}/page.tsx`)),p);
 const nav=read('src/lib/nav.ts');
 assert.match(nav,/title:'People',href:'\/bucket',icon:'people',roles:\['owner','editor'\]/);assert.match(nav,/title:'Pipeline',href:'\/pipeline',icon:'pipeline',roles:\['owner','editor'\]/);
});
test('the old creator, Instagram, unified, cross-platform, ranking and sync screens left the navigation (files stay until the cutover)',()=>{
 const nav=read('src/lib/nav.ts');
 for(const href of ['/creators','/unified','/instagram','/cross-platform','/sync','/rankings'])assert.ok(!nav.includes(`href:'${href}'`),href);
 for(const route of ['creators','unified','instagram','cross-platform','sync','rankings'])assert.ok(existsSync(join(root,`src/app/${route}/page.tsx`)),`${route} page must still exist`);
});
test('bucket page: existing bulk platforms and TikTok authorization on People, Check before Add',()=>{
 const s=read('src/app/bucket/page.tsx');
 assert.match(s,/YouTube/);assert.match(s,/Instagram/);assert.match(s,/TikTok \(connect below\)/);assert.match(s,/Connect TikTok/);assert.match(s,/Disconnect TikTok/);assert.match(s,/\/admin\/tiktok\/oauth\/start/);
 assert.match(s,/'single'\|'bulk'/);assert.match(s,/\/admin\/bucket\/preview/);assert.match(s,/\/admin\/bucket\/people/);
 for(const status of ['resolved','invalid_format','not_found','duplicate_in_bucket','duplicate_in_batch','unknown_niche','person_already_has_platform'])assert.ok(s.includes(status),status);
});
test('bucket delete is owner-only, needs a typed DELETE and a browser confirmation, and sends CSRF',()=>{
 const s=read('src/app/bucket/page.tsx');
 assert.match(s,/identity\?\.role==='owner'/);assert.match(s,/confirmText!=='DELETE'/);assert.match(s,/window\.confirm/);assert.match(s,/method:'DELETE',csrf:identity\?\.csrfToken/);
 assert.match(s,/This cannot be undone/);
});
test('pipeline page: Refresh, Rank, Publish, Run all, draft review, live rankings and rollback all call the new endpoints',()=>{
 const s=read('src/app/pipeline/page.tsx');
 for(const p of ["'/admin/refresh'","'/admin/rank'","/admin/rank/${b.batchId}/publish","'/admin/pipeline/run'","/admin/publications/${scope}/rollback","/admin/pipeline/status","/admin/rank/latest"])assert.ok(s.includes(p),p);
 assert.match(s,/window\.confirm/);assert.match(s,/csrf/);
});
test('pipeline page shows the fixed wheel wording, the stale warning at 36 hours and the unranked reasons',()=>{
 const s=read('src/app/pipeline/page.tsx');
 for(const t of ['Combined followers across platforms','YouTube lifetime views','Posts in the last 30 days','stale (over 36 h)','no fresh number'])assert.ok(s.includes(t),t);
});
test('new screens use no browser storage, inline styles or direct backend access',()=>{
 for(const f of ['src/app/bucket/page.tsx','src/app/pipeline/page.tsx']){const s=read(f);
  assert.doesNotMatch(s,/localStorage|sessionStorage|\bstyle\s*=|<style\b|dangerouslySetInnerHTML|ioredis|\bpg\b|googleapis/,f);}
});
test('api client allows PUT for the niche editor and still sends CSRF on every write',()=>{
 const s=read('src/lib/api.ts');assert.match(s,/'PUT'/);assert.match(s,/X-CSRF-Token/);
});

test('pipeline page offers a read-only comparison with the old YouTube ranking',()=>{
 const s=read('src/app/pipeline/page.tsx');
 assert.match(s,/\/admin\/shadow\/youtube/);assert.match(s,/Compare with the old site/);assert.match(s,/Only in the old list/);
 assert.doesNotMatch(s,/shadow[^;]*method:'(POST|PUT|DELETE)'/);
});
