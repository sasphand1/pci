import test from 'node:test';
import assert from 'node:assert/strict';
import {grantsFor,checkTarget,verifyGrants} from '../../scripts/provision-runtime.mjs';
import {targetToken} from '../../scripts/architecture-release.mjs';
import {REQUIRED_RELATIONS,REQUIRED_GUARDS} from '../../src/architecture/managed-runtime.ts';
const url='postgresql://owner:fake@ep-test.example.com/db';
test('explicit target required; pooled maintenance endpoints refused',()=>{
 assert.doesNotThrow(()=>checkTarget(url,targetToken(url)));
 assert.throws(()=>checkTarget(url,'wrong'),/incorrect confirmed/);
 const pooled=url.replace('ep-test.','ep-test-pooler.');assert.throws(()=>checkTarget(pooled,targetToken(pooled)),/direct/);
});
test('migration ledger and views receive read-only grants, no OAuth access',()=>{
 assert.equal(grantsFor('public.schema_migrations','r').access,'SELECT');
 assert.equal(grantsFor('public.hub_tiktok_registered','v').access,'SELECT');
 assert.equal(grantsFor('public.accounts','r').access,'SELECT,INSERT,UPDATE,DELETE');
 assert.equal(grantsFor('tiktokingest.connections','r'),null);
 assert.throws(()=>grantsFor('public.accounts','S'),/unexpected relation/);
});
test('actual login evidence catches missing table write grants',()=>{
 const e={role:{username:'pci_runtime',session_role:'pci_runtime'},privilegedMemberships:[],schemas:[],relations:REQUIRED_RELATIONS.map(n=>{const [schema,relation]=n.split('.');return {schema,relation,can_read:true,can_insert:false,can_update:false,can_delete:false};})};
 const ledger=['134_architecture_integrity.sql','135_architecture_source_routes.sql','136_tiktok_central_projection.sql'];
 assert.ok(verifyGrants(e,REQUIRED_GUARDS,ledger,[grantsFor('public.accounts','r')]).some(x=>x.includes('PCI_RUNTIME_GRANT')));
 assert.deepEqual(verifyGrants(e,REQUIRED_GUARDS,ledger,[grantsFor('public.schema_migrations','r')]),[]);
});
