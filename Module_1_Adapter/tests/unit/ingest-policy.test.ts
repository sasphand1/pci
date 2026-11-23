import assert from 'node:assert/strict';
import {test} from 'node:test';
import {decideValue,due,validCount} from '../../src/modules/ingest/policy.ts';
const a='2026-11-23T09:00:00Z';const b='2026-11-23T10:00:00Z';
const now=Date.parse('2026-11-23T11:00:00Z');
const api={method:'api' as const,value:42,precision:'exact' as const,observedAt:a};
test('counts never accept negatives/fractions/null',()=>{
 assert.equal(validCount(0),true);assert.equal(validCount(-1),false);
 assert.equal(validCount(1.2),false);assert.equal(validCount(null),false);
});
test('HTTP does not overwrite fresh API values',()=>{
 assert.equal(decideValue(api,{method:'http',value:99,precision:'exact',observedAt:b},now),'reject_lower_priority');
});
test('API can improve HTTP values and stale values cannot overwrite',()=>{
 assert.equal(decideValue({...api,method:'http'},api,now),'accept');
 assert.equal(decideValue({...api,observedAt:b},api,now),'reject_stale');
});
test('invalid and unverified snapshots are rejected',()=>{
 assert.equal(decideValue(null,{...api,value:-1},now),'reject_invalid');
 assert.equal(decideValue(null,{...api,precision:'unverified'},now),'reject_unverified');
});
test('refresh due calculation has exact boundaries',()=>{
 assert.equal(due(a,24,Date.parse('2026-11-24T09:00:00Z')),true);
 assert.equal(due(a,24,Date.parse('2026-11-23T18:00:00Z')),false);
});
import {isDiscrepancy,isStale} from '../../src/modules/ingest/policy.ts';
test('HTTP fills in when the API source is down',()=>{
 assert.equal(decideValue(api,{method:'http',value:99,precision:'exact',observedAt:b},now,{apiHealthy:false}),'accept');
});
test('HTTP fills in when the stored API value is older than the max age',()=>{
 const old={...api,observedAt:'2026-11-01T00:00:00Z'};
 assert.equal(decideValue(old,{method:'http',value:99,precision:'exact',observedAt:b},now),'accept');
});
test('healthy recent API still beats HTTP',()=>{
 assert.equal(decideValue(api,{method:'http',value:99,precision:'exact',observedAt:b},now,{apiHealthy:true}),'reject_lower_priority');
});
test('discrepancy needs more than 5% difference',()=>{
 assert.equal(isDiscrepancy(1000,1040),false);
 assert.equal(isDiscrepancy(1000,1200),true);
 assert.equal(isDiscrepancy(0,0),false);
 assert.equal(isDiscrepancy(-1,5),false);
});
test('stale means older than twice the window',()=>{
 assert.equal(isStale('2026-11-23T10:00:00Z',24,now),false);
 assert.equal(isStale('2026-11-20T10:00:00Z',24,now),true);
 assert.equal(isStale('garbage',24,now),true);
});
