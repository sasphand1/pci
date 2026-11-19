import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankPeople} from '../src/modules/unified/metrics.mjs';
const person=(id,subs,category='vloggers')=>({id,slug:id,displayName:id,enabled:true,humanReviewStatus:'approved',categories:[{slug:category,label:category}],youtube:{url:'https://www.youtube.com/channel/UCtest',subscribers:subs,views:'100',videos:'4'},instagram:null});
test('rank positions follow the current eligible population after add/delete',()=>{
 const a=person('a','100'),b=person('b','300'),c=person('c','200');
 assert.deepEqual(rankPeople([a,b],{metric:'subscribers'}).data.map(x=>[x.id,x.rank]),[['b',1],['a',2]]);
 assert.deepEqual(rankPeople([a,b,c],{metric:'subscribers'}).data.map(x=>[x.id,x.rank]),[['b',1],['c',2],['a',3]]);
 assert.deepEqual(rankPeople([a,c],{metric:'subscribers'}).data.map(x=>[x.id,x.rank]),[['c',1],['a',2]]);
});
test('missing metric and category exclusion never create fake ranks',()=>{
 const a=person('a',null),b=person('b','30'),c=person('c','100','gaming');
 const result=rankPeople([a,b,c],{metric:'subscribers',category:'vloggers'});
 assert.equal(result.total,2);assert.equal(result.known,1);
 assert.deepEqual(result.data.map(x=>[x.id,x.rank]),[['b',1]]);
});
test('bulk import queues data sync and snapshots are before optional video processing',()=>{
 const admin=readFileSync('src/modules/admin/routes.ts','utf8');
 const sync=readFileSync('src/modules/sync/service.ts','utf8');
 const worker=readFileSync('src/worker.ts','utf8');
 assert.match(admin,/PCI_AUTO_INITIAL_SYNC_V2/);
 assert.match(sync,/PCI_EARLY_CHANNEL_SNAPSHOTS_V2/);
 assert.ok(sync.indexOf('PCI_EARLY_CHANNEL_SNAPSHOTS_V2')<sync.indexOf('const videoIdsByChannel='));
 assert.match(sync,/videoFetchFailed/);
 assert.match(worker,/PCI_BACKFILL_UNSYNCED_V2/);
});
