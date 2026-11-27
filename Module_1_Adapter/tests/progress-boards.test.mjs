import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const cwd=resolve(import.meta.dirname,'..');const read=p=>readFile(resolve(cwd,p),'utf8');
test('progress boards: additive migration with slug check and optimistic version',async()=>{
 const sql=await read('database/migrations/125_progress_boards.sql');
 assert.match(sql,/CREATE TABLE IF NOT EXISTS progress_boards/);assert.match(sql,/version integer NOT NULL/);assert.doesNotMatch(sql,/\bDROP\b|DELETE FROM|TRUNCATE/i);
});
test('progress routes: admin session, owner/editor writes, stale writes refused, audited, mounted and bootstrapped',async()=>{
 const r=await read('src/modules/progress/routes.ts');const s=await read('src/server.ts');
 assert.match(r,/progressAdminRoutes\.use\('\/progress',requireAdmin\)/);
 assert.match(r,/put\('\/progress\/:slug',roles\('owner','editor'\)/);
 assert.match(r,/WHERE slug=\$1 AND version=\$4/);assert.match(r,/STALE_BOARD/);assert.match(r,/audit\(/);
 assert.match(r,/\.strict\(\)/);
 assert.match(s,/app\.use\('\/api\/v1\/admin',progressAdminRoutes\)/);assert.match(s,/ensureProgressSchema\(\)/);
});
test('Satify mirror reports its health to the Hub Monitor (no permanent "no successful collection" alert)',async()=>{
 const s=await read('src/modules/satify/service.ts');
 assert.match(s,/await writeHubReadings\('satify\.api',hub\);if\(hub\.length\)await reportSourceResult\('satify\.api',true\)/);
 assert.match(s,/reportSourceResult\('satify\.api',false/);
});
test('air quality and Satify use realistic rhythms, applied at start-up without overriding admin edits',async()=>{
 const sql=await read('database/migrations/126_hub_source_cadence.sql');
 assert.match(sql,/expected_hours=12 WHERE id='sat_airquality\.api' AND expected_hours=2/);
 assert.match(sql,/expected_hours=6 WHERE id='satify\.api' AND expected_hours=2/);
 assert.match(await read('src/server.ts'),/ensureHubCadence\(\)/);
});
