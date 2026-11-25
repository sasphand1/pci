import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {compareDailySeries,summarizeThermalDetections} from '../src/lib/satelliteScience.mjs';
const source=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('real daily comparisons require seven fresh distinct valid observations',()=>{
 const now=Date.parse('2026-11-22T12:00:00Z');
 const obs=Array.from({length:8},(_,i)=>({value:i===0?15:5,observedAt:new Date(now-i*86400000).toISOString()}));
 const result=compareDailySeries(obs,'rainfall',now);assert.equal(result.status,'ready');assert.equal(result.days,8);assert.equal(result.latest,15);
 assert.equal(compareDailySeries(obs.slice(0,6),'rainfall',now).status,'insufficient');
 assert.equal(compareDailySeries(obs.map(o=>({...o,observedAt:obs[0].observedAt})),'rainfall',now).status,'insufficient');
 assert.equal(compareDailySeries(obs.map(o=>({...o,value:-1})),'rainfall',now).status,'insufficient');
 assert.equal(compareDailySeries(obs.map(o=>({...o,observedAt:'2026-09-01T00:00:00Z'})),'rainfall',now).status,'insufficient');
});
test('thermal records are geolocated observations, not fires',()=>{
 const now=Date.parse('2026-11-22T12:00:00Z');
 assert.equal(summarizeThermalDetections([{latitude:31.5,longitude:74.3,observedAt:'2026-11-22T09:00:00Z'},{latitude:51,longitude:1,observedAt:'2026-11-22T09:00:00Z'}],now).count,1);
 assert.match(summarizeThermalDetections([],now).explanation,/does not establish/);
});
test('five decision tools, no inline React styles, and original NOT GPM disclaimer',()=>{
 const s=source('../src/components/SatelliteDashboard.tsx');
 for(const [id,title] of [['farm','Farm Doctor'],['safety','Safety Watch'],['water','Water Guardian'],['solar','Solar Advisor'],['city','City Health']]){
  assert.match(s,new RegExp(`id:'${id}'`));
  assert.ok(s.includes(`title:'${title}'`));
 }
 assert.doesNotMatch(s,/style=\{/);assert.match(s,/NOT GPM/);assert.match(s,/satelliteScience\.mjs/);
 assert.match(source('../src/app/api/satellite/route.ts'),/rainfall-history/);
});
test('fixed Pakistan map, category overlays, and no new public analysis endpoint',()=>{
 const s=source('../public/satellite-map.html');
 for(const x of ['interactive:false','dragPan:false','scrollZoom:false','fitBounds','layerSets','category'])assert.ok(s.includes(x),x);
 assert.ok(!source('../src/app/api/satellite/route.ts').includes('intelligence'));
});
