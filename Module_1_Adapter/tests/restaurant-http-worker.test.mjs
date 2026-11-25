import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const worker=read('../src/modules/local/image-autofill.ts');
test('HTTP worker uses the live place table and independent retry/refresh state',()=>{
 assert.match(worker,/FROM local_places p/);assert.match(worker,/interval '30 days'/);assert.match(worker,/pg_try_advisory_xact_lock/);assert.match(worker,/lockPlace\(tx,id\)/);
 assert.match(worker,/candidate\.autoAuthorized!==true/);assert.match(worker,/hash!==p\.sha256/);assert.match(worker,/INSERT INTO restaurant_image_cache/);
 assert.doesNotMatch(worker,/fetchGooglePhoto|googleusercontent\.com|places\/[^\s]*\/photos/);
});
test('startup and 15-minute scheduling, owner/editor trigger and cascading state are wired',()=>{
 const scheduler=read('../src/modules/sync/scheduler.ts'),schema=read('../src/modules/local/image-schema.ts'),routes=read('../src/modules/local/image-routes.ts');
 const ddl=read('../database/migrations/116_restaurant_http_autofill.sql');
 assert.ok(worker.includes('`'+ddl+'`'));assert.match(ddl,/REFERENCES local_places\(place_id\) ON DELETE CASCADE/);
 assert.match(scheduler,/cron\.schedule\('5,20,35,50 \* \* \* \*',httpPhotos\)/);assert.match(scheduler,/setTimeout\(httpPhotos,30000\)/);
 assert.match(schema,/await query\(HTTP_IMAGE_STATE_SQL\)/);assert.match(routes,/post\('\/http-fill',roles\('owner','editor'\)/);
});
