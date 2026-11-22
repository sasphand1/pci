import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/app/page.tsx');
const snapshot=read('src/components/SnapshotStatus.tsx');
const entry=read('packages/ui/src/styles.css');

test('the three wheel sorts and the 100 rows are the published scopes',()=>{
 const lib=read('src/lib/public.ts');
 for(const s of ['wheel.subscribed','wheel.viewed','wheel.active'])assert.ok(lib.includes(s),s);
 assert.match(read('src/components/PublishedTop100.tsx'),/\/api\/v1\/public\/rankings\//);
});
test('top 100 offers wheel sorts, both platforms and categories, and checks the scope before fetching',()=>{
 const t=read('src/components/PublishedTop100.tsx');
 for(const s of ['wheel.subscribed','wheel.viewed','wheel.active','youtube.subscribed','instagram.followers','category.'])assert.ok(t.includes(s),s);
 assert.match(t,/SCOPE_PATTERN\.test\(scope\)/);
});
test('updated-at display uses the snapshot component',()=>{assert.match(snapshot,/Last updated:/);});
