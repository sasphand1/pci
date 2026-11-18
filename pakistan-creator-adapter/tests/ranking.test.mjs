import test from 'node:test';
import assert from 'node:assert/strict';
import { rankedRows,sumCounts,compareCounts } from '../src/modules/ranking/rank.mjs';
test('BigInt sorts beyond JavaScript safe integer',()=>{
 const a=[{channelId:'UC_A',subscriberCount:'9007199254740993'},{channelId:'UC_B',subscriberCount:'9007199254740992'}];
 assert.equal(rankedRows(a)[0].channelId,'UC_A');
});
test('tie share dense rank; hidden metrics remain null and rank last',()=>{
 const rows=[{channelId:'c',subscriberCount:null},{channelId:'b',subscriberCount:'100'},{channelId:'a',subscriberCount:'100'},{channelId:'d',subscriberCount:'90'}];
 const out=rankedRows(rows);assert.deepEqual(out.map(x=>x.rank),[1,1,2,null]);assert.equal(out[0].channelId,'a');
});
test('does not mutate input',()=>{
 const data=[{channelId:'b',viewCount:'4'},{channelId:'a',viewCount:'5'}];
 rankedRows(data,'views');assert.equal(data[0].channelId,'b');
});
test('missing metrics cannot silently become 0',()=>{
 assert.equal(rankedRows([{channelId:'a',videoCount:null},{channelId:'b',videoCount:'0'}],'videos')[1].rank,null);
});
test('sum of bigints stays exact',()=>{
 assert.equal(sumCounts([{v:'9007199254740993'},{v:'9'},{v:null}],'v'),'9007199254741002');
});
test('compareCounts compares numerical not lexicographic',()=>assert.equal(compareCounts('100','99'),-1));
test('disallow arbitrary ranking metric / SQL injection',()=>assert.throws(()=>rankedRows([],';DROP TABLE creators'),/Unknown/));
