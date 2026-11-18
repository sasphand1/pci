import test from 'node:test';
import assert from 'node:assert/strict';
import {rankInstagram} from '../src/modules/instagram/ranking.mjs';
const sample=[{username:'b',followersCount:'100',mediaCount:'4'},{username:'a',followersCount:'100',mediaCount:'3'},{username:'c',followersCount:null,mediaCount:'10'},{username:'d',followersCount:'200',mediaCount:'1'}];
test('Instagram follows existing deterministic dense ranks',()=>{
 const r=rankInstagram(sample);
 assert.deepEqual(r.map(x=>x.username),['d','a','b','c']);
 assert.deepEqual(r.map(x=>x.rank),[1,2,2,null]);
});
test('posts ordering uses raw media counts, not fake scores',()=>{
 const r=rankInstagram(sample,'posts');assert.deepEqual(r.map(x=>x.username),['c','b','a','d']);
});
test('unsupported ranking metrics rejected',()=>assert.throws(()=>rankInstagram(sample,'views')));
test('does not mutate input',()=>{const before=JSON.stringify(sample);rankInstagram(sample);assert.equal(JSON.stringify(sample),before)});
