import test from 'node:test';import assert from 'node:assert/strict';
import {observedSeries,intervalRates,hasChange,windowChange,sparkPoints,profileViews} from '../src/fifi/pages/creator-chart-data.mjs';
test('sorts and deduplicates observations; rejects invalid and future readings',()=>{assert.deepEqual(observedSeries([{at:'2020-11-02',value:12},{at:'2020-11-01',value:10},{at:'2020-11-02',value:13},{at:'bad',value:5},{at:'2999-01-01',value:10}],7).map(p=>p.value),[10,13]);assert.deepEqual(observedSeries(undefined,7),[]);});
test('flat and sparse series are not charted',()=>{assert.equal(hasChange([]),false);assert.equal(hasChange([{value:1},{value:1}]),false);assert.equal(hasChange([{value:1},{value:2}]),true);});
test('rates use actual elapsed time; skip resets and long gaps',()=>{const d=86400000;assert.deepEqual(intervalRates([{time:0,value:10},{time:d*2,value:30},{time:d*3,value:20},{time:d*7,value:40}]),[{time:d*2,value:10}]);});
test('window change and sparkline geometry',()=>{assert.equal(windowChange([{time:0,value:5}]),null);assert.equal(windowChange([{time:0,value:5},{time:1,value:9}]),4);
 assert.equal(sparkPoints([]),'');assert.equal(sparkPoints([{time:0,value:1},{time:10,value:1}],100,28),'2.0,14.0 98.0,14.0');
 const s=sparkPoints([{time:0,value:0},{time:10,value:10}],100,28,2).split(' ');assert.deepEqual(s,['2.0,26.0','98.0,2.0']);});
test('platform views: All only when there is more than one platform; unknown requests fall back',()=>{
 assert.deepEqual(profileViews(['instagram','youtube'],'instagram'),{views:['all','youtube','instagram'],initial:'instagram'});
 assert.deepEqual(profileViews(['youtube'],'instagram'),{views:['youtube'],initial:'youtube'});
 assert.deepEqual(profileViews([],null),{views:['all'],initial:'all'});
 assert.equal(profileViews(['youtube','instagram'],'<script>').initial,'all');});
