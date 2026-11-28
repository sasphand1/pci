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
 assert.match(admin,/PCI_SCRAPPA_AUTO_REFRESH!=='true'/);assert.match(admin,/remainingCredits\(key.id,true\)/);assert.match(admin,/s.enabled=true/);
 assert.match(read('src/modules/sync/scheduler.ts'),/refreshScrappaCandidates\(\)/);
});

test('credit intelligence migration is additive and matches locked bootstrap',()=>{assert.ok(admin.includes(read('database/migrations/132_scrappa_credit_intelligence.sql')));const c=read('src/modules/scrappa/credits.ts');assert.match(c,/pg_advisory_xact_lock\(710329\)/);assert.match(c,/scrappa_key_credit_month.used<\$2/);assert.match(c,/INSERT INTO scrappa_credit_ledger/);assert.match(c,/scrappa_credit_month.used\+1/);});

test('pending registration does not call provider or reserve credit and is private',()=>{assert.ok(admin.includes(read('database/migrations/133_scrappa_pending_registration.sql')));const registration=admin.split('export async function registerPending')[1].split('export async function collectPending')[0];assert.match(registration,/INSERT INTO scrappa_pending_accounts/);assert.doesNotMatch(registration,/activeKey\(|reserveFor\(|collectProfile\(|fetch\(/);assert.match(admin,/router.post\('\/bucket\/scrappa\/pending',roles\('owner','editor'\)/);assert.match(admin,/await collectPending\(pending.handle,'scheduled'/);});
