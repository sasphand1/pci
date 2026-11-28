import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {SCRAPPA_METRICS} from '../../src/architecture/contracts.ts';
const root=new URL('../../',import.meta.url);
const sql=readFileSync(new URL('database/migrations/134_architecture_integrity.sql',root),'utf8');
const ci=readFileSync(new URL('../.github/workflows/ci.yml',root),'utf8');
test('SQL and application Scrappa metric allowlists agree',()=>{
 for(const kind of ['account','content']){
   const match=sql.match(new RegExp(`WHEN '${kind}' THEN[^\n]*\\n\\s+AND metric_name IN \\(([^)]+)\\)`));
   assert.ok(match,`SQL allowlist missing: ${kind}`);
   const metrics=[...match[1].matchAll(/'([^']+)'/g)].map(x=>x[1]);
   assert.deepEqual(metrics.sort(),[...SCRAPPA_METRICS[kind]].sort());
 }
});
test('migration number is unique and DB tests are in CI',()=>{
 assert.deepEqual(readdirSync(new URL('database/migrations/',root)).filter(x=>/^134_.*\.sql$/.test(x)),['134_architecture_integrity.sql']);
 assert.ok(ci.includes('tests/integration/architecture-db.test.ts'));
});
test('publication integrity is deferred to preserve atomic pointer swaps',()=>{
 for(const name of ['pci_arch_pointer_guard','pci_arch_run_guard']){
   assert.match(sql,new RegExp(`CREATE CONSTRAINT TRIGGER ${name}[^\\n]*\\nDEFERRABLE INITIALLY DEFERRED`));
 }
});
