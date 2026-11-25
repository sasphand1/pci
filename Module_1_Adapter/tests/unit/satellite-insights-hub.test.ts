import test from 'node:test';
import assert from 'node:assert/strict';
import {insightReadings,hubSourceId,KIND} from '../../src/modules/satellite/hub-map.js';
test('scores map to hub readings under sat_insights',()=>{
 const r=insightReadings({lahore:{goOut:{score:42,level:'limit'}},karachi:{goOut:null}},[{id:'cleanest_air',winner:{city:'quetta',value:41.5}},{id:'most_rain',winner:null}],'2026-11-25T12:00:00.000Z');
 assert.deepEqual(r.map(x=>[x.entityKind,x.entityId,x.metric,x.value,x.text]),[['city','city:lahore','go_out_score',42,'limit'],['ranking','ranking:cleanest_air','winner_value',41.5,'quetta']]);
 assert.ok(r.every(x=>KIND.test(x.entityKind)));assert.equal(hubSourceId('insights'),'sat_insights.api');
});
