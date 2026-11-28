import test from 'node:test';
import assert from 'node:assert/strict';
import {matchIdentity,type IdentityAccount} from '../../src/modules/creators-bucket/identity-match.js';
const account=(slug:string,handle:string,name=handle,platform='instagram'):IdentityAccount=>({personId:slug,slug,handle,name,platform});
test('five known handle variants propose the existing identity, including repeated letter typo',()=>{
 const rows=[account('alishbahannjum','alishbahannjum'),account('areeka-haq','areeka__haq'),account('ch-zulqarnain25','ch.zulqarnain25'),account('jannatmirza','jannatmirza_'),account('kanwal-135','kanwal.135')];
 for(const [handle,name,slug] of [['alishbahanjum','Alishba Anjum','alishbahannjum'],['areeka__haq','Areeka Haq','areeka-haq'],['ch.zulqarnain25','Zulqarnain Sikandar','ch-zulqarnain25'],['jannatmirza','Jannat Mirza','jannatmirza'],['kanwal.135','Kanwal Aftab','kanwal-135']])assert.deepEqual(matchIdentity(handle,name,rows).map(x=>x.slug),[slug]);
});
test('different digits or letters do not become fuzzy matches',()=>{
 assert.deepEqual(matchIdentity('creator12345','Creator Name',[account('different','creator12346'),account('different2','creatar12345')]),[]);
});
test('multiple people stay ambiguous; multiple accounts of one person are grouped',()=>{
 const rows=[account('one','creator_name'),account('one','creator.name','Creator Name','youtube'),account('two','creatorname')];
 const m=matchIdentity('creatorname','Creator Name',rows);assert.equal(m.length,2);assert.equal(m[0].accounts.length,2);
});
test('short and unrelated handles are not matched by similarity',()=>{assert.deepEqual(matchIdentity('ana','Ana',[account('other','anna')]),[]);});
test('matching is deterministic regardless of registry row order',()=>{
 const rows=[account('b','testcreator'),account('a','test_creator')];assert.deepEqual(matchIdentity('testcreator','Test Creator',rows),matchIdentity('testcreator','Test Creator',[...rows].reverse()));
});
