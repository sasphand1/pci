import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const local='../src/modules/local/';
test('shared quota, public listing gate and no persistence of Google photos',()=>{
 const r=read(local+'image-routes.ts'),q=read(local+'photo-policy.ts');assert.match(q,/google-preview-/);assert.match(q,/Math.min\(n,25\)/);assert.match(r,/listedWithoutCachedPhoto/);assert.match(r,/reserveGooglePhoto/);assert.match(r,/no-store/);
});
test('permanent deletion is owner-only and serializes with restaurant collector',()=>{
 const d=read(local+'place-lifecycle.ts'),c=read(local+'collect.ts'),r=read(local+'admin-routes.ts');
 for(const t of ['ingest_latest','ingest_observations','hub_discrepancies','local_place_overrides','local_places'])assert.ok(d.includes('DELETE FROM '+t));
 assert.match(c,/await lockPlace\(tx,p.id\)/);assert.match(c,/await isDeleted\(tx,p.id\)/);assert.match(r,/roles\('owner'\)/);assert.match(d,/local_place_tombstones/);
});
