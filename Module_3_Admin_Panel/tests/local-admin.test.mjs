import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('restaurants admin page: role-gated, uses the admin API, confirms removal, no inline styles',()=>{
 const s=read('src/app/local/page.tsx');
 assert.match(s,/RoleGate roles=\{\['owner','editor'\]\}/);
 for(const p of ['/admin/local/status','/admin/local/search','/admin/local/places','/admin/ingest/local/collect'])assert.ok(s.includes(p),p);
 assert.match(s,/ConfirmButton/);
 assert.doesNotMatch(s,/style=\{/);
 assert.doesNotMatch(s,/dangerouslySetInnerHTML/);
});
test('restaurants page is in the navigation for owner and editor only',()=>{
 const n=read('src/lib/nav.ts');
 assert.match(n,/title:'Restaurants',href:'\/local',icon:'tag',roles:\['owner','editor'\]/);
});
