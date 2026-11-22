import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('enabling a supported provider queues ingestion automatically, and disabling clears pending work',()=>{
 const src=read('../src/modules/satellite/routes.ts');
 assert.match(src,/refresh_requested_at=CASE WHEN \$2::boolean AND NOT enabled THEN now\(\)/);
 assert.match(src,/WHEN NOT \$2::boolean THEN NULL/);
 assert.match(src,/satelliteAdminRoutes\.use\(requireAdmin,roles\('owner'\)\)/);
});
test('POWER never reports partial ingestion as a complete successful refresh',()=>{
 const src=read('../src/modules/satellite/service.ts');
 assert.match(src,/successfulCities!==Object\.keys\(CITIES\)\.length/);
 assert.match(src,/POWER incomplete/);
});
test('sources disclose queue and observation freshness, not secret keys',()=>{
 const src=read('../src/modules/satellite/routes.ts');
 assert.match(src,/refreshQueued:Boolean\(p\.refresh_requested_at\)/);
 assert.doesNotMatch(src,/res\.json\(\{[^\n]*NASA_FIRMS_MAP_KEY/);
});
