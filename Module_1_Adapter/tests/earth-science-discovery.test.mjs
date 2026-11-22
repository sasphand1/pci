import test from 'node:test';import assert from 'node:assert/strict';
import {discoveryUrl,parseDiscovery,SCIENCE_DATASETS} from '../src/modules/satellite/discovery.mjs';
import {buildObservationBatch} from '../src/modules/satellite/bulk.mjs';
const day=new Date('2026-11-22T12:00:00Z');
test('official NASA CMR and USGS STAC endpoints, fixed search bounds',()=>{
 for(const id of Object.keys(SCIENCE_DATASETS)){
  const u=new URL(discoveryUrl(id,day));assert.equal(u.protocol,'https:');
  assert.equal(u.searchParams.get(id==='landsat'?'bbox':'bounding_box'),'60,23,78,38');
  assert.ok(['landsatlook.usgs.gov','cmr.earthdata.nasa.gov'].includes(u.hostname));
 }
});
test('Landsat STAC returns honest acquisition metadata, no invented temperature',()=>{
 const out=parseDiscovery('landsat',{features:[{type:'Feature',id:'LC09_L2SP_00000_ST',bbox:[73,30,76,34],properties:{datetime:'2026-11-20T00:00:00Z'}}]},day.valueOf());
 assert.equal(out.length,1);assert.equal(out[0].payload.scientificMeasurement,null);assert.equal(out[0].payload.derivedAnalysisAvailable,false);
});
test('CMR returns verified granule metadata without interpreting file contents',()=>{
 for(const id of ['ecostress','smap','blackmarble']){
  const out=parseDiscovery(id,{feed:{entry:[{id:'G123-CMR',time_start:'2026-11-20T00:00:00Z'}]}},day.valueOf());
  assert.equal(out.length,1);assert.equal(out[0].metric,'science_scene');
  assert.equal(out[0].payload.provider,id);assert.equal(out[0].payload.scientificMeasurement,null);
  assert.equal(buildObservationBatch(id,out).values[0],id);
 }
});
test('invalid, future, empty and stale records fail closed',()=>{
 assert.throws(()=>discoveryUrl('unknown'));assert.throws(()=>parseDiscovery('smap',{}));
 assert.deepEqual(parseDiscovery('smap',{feed:{entry:[{id:'bad!',time_start:'2026-11-20T00:00:00Z'},{id:'G234-CMR',time_start:'2026-01-01T00:00:00Z'}]}},day.valueOf()),[]);
});
