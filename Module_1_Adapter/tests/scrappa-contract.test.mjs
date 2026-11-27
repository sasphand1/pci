import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const admin=read('src/modules/scrappa/admin.ts'), ddl=read('database/migrations/130_scrappa_refresh.sql');
test('Scrappa runtime DDL mirrors the additive migration',()=>assert.ok(admin.includes(ddl)));
test('Scrappa routes require owner for publishing controls and keep candidate observations private',()=>{
 for(const route of ['candidates/:id/collect','candidates/:id/link','refresh-settings'])assert.ok(admin.includes(`router.post('/bucket/scrappa/${route}',roles('owner')`));
 const store=read('src/modules/creators-bucket/tiktok-staging.ts');assert.match(store,/accountId:null/);assert.match(store,/tiktok_candidate:/);assert.doesNotMatch(admin,/INSERT INTO accounts/);
});
test('scheduled refresh is gated by environment and owner-controlled source',()=>{
 assert.match(admin,/PCI_SCRAPPA_AUTO_REFRESH!=='true'/);assert.match(admin,/SCHEDULED_CREDIT_CEILING/);assert.match(admin,/s.enabled=true/);
 assert.match(read('src/modules/sync/scheduler.ts'),/refreshScrappaCandidates\(\)/);
});
