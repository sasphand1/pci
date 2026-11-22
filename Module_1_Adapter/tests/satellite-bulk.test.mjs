import test from 'node:test';import assert from 'node:assert/strict';
import {buildObservationBatch,SATELLITE_BATCH_SIZE} from '../src/modules/satellite/bulk.mjs';
const one={metric:'fire',location:'bounding-box',observationKey:'31.1,74.1',observedAt:'2026-11-22T04:00:00Z',payload:{confidence:'n'}};
test('database writes are parameterized not interpolated',()=>{
 const a=buildObservationBatch('firms',[{...one,observationKey:"');DROP TABLE observations;--"}]);
 assert.equal(a.values[3],"');DROP TABLE observations;--");
 assert.ok(!a.sql.includes('DROP TABLE'));
 assert.equal(a.values.length,6);
});
test('200 records per batch prevents unbounded SQL parameter payload',()=>{
 const a=buildObservationBatch('firms',Array.from({length:SATELLITE_BATCH_SIZE},()=>one));
 assert.equal(a.values.length,1200);assert.match(a.sql,/\$1200::jsonb/);
 assert.throws(()=>buildObservationBatch('firms',Array.from({length:201},()=>one)),/out of bounds/);
});
test('reject unsupported providers and invalid records',()=>{
 assert.throws(()=>buildObservationBatch('evil',[one]),/Unsupported/);
 assert.throws(()=>buildObservationBatch('firms',[{...one,metric:'meteor'}]),/Invalid/);
 assert.throws(()=>buildObservationBatch('firms',[]),/out of bounds/);
});
