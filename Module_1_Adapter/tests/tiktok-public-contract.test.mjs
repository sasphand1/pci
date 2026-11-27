import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
test('public route requires explicit approval and migration matches startup',()=>{
 const a=read('src/modules/scrappa/admin.ts');assert.ok(a.includes(read('database/migrations/131_scrappa_publication.sql')));assert.match(a,/router.post\('\/bucket\/scrappa\/candidates\/:id\/publish',roles\('owner'\)/);assert.match(a,/confirm:z.literal\(true\)/);assert.match(a,/published_at=NULL/);
 const r=read('src/modules/public/tiktok.ts');assert.match(r,/WHERE s.published_at IS NOT NULL/);assert.match(r,/no-store/);assert.match(r,/projectTikTok/);assert.match(read('src/server.ts'),/app.use\('\/api\/v1\/public\/tiktok',publicTikTokRoutes\)/);
});

test('credential rename and delete are owner-only, locked and audited',()=>{const s=readFileSync(new URL('../src/modules/scrappa/admin.ts',import.meta.url),'utf8');for(const action of ['rename','delete']){const part=s.split("router.post('/bucket/scrappa/keys/:id/"+action+"'")[1].split('router.post(')[0];assert.match(part,/roles\('owner'\)/);assert.match(part,/pg_advisory_xact_lock\(710329\)/);assert.ok(part.includes('scrappa.key.'+action));}assert.match(s,/if\(key.active\)throw new HttpError/);});
