import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {minimumIntervalMinutes,effectiveIntervalMinutes,isDue} from '../src/modules/satellite/policy.mjs';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
test('FIRMS limits all requests to 8 slots per 24 hours under default policy',()=>{
 assert.equal(minimumIntervalMinutes('firms'),180);
 assert.equal(effectiveIntervalMinutes('firms',60),180);
 assert.equal(isDue('2026-11-22T00:00:00.000Z','firms',60,Date.parse('2026-11-22T02:59:59.000Z')),false);
 assert.equal(isDue('2026-11-22T00:00:00.000Z','firms',60,Date.parse('2026-11-22T03:00:00.000Z')),true);
});
test('all other provider policies use conservative minimums',()=>{
 for(const id of ['power','gibs','sentinel1','sentinel2','sentinel5p'])assert.equal(minimumIntervalMinutes(id),1440);
 for(const id of ['eonet','gpm'])assert.equal(minimumIntervalMinutes(id),360);
 assert.equal(effectiveIntervalMinutes('firms',360),360);
 assert.throws(()=>minimumIntervalMinutes('unknown'));
});
test('manual refresh and scheduled jobs share atomic database cooldown',()=>{
 const routes=read('../src/modules/satellite/routes.ts');
 const service=read('../src/modules/satellite/service.ts');
 for(const code of [routes,service]){
  assert.match(code,/make_interval\(mins=>GREATEST\(refresh_minutes,\$2::int\)\)/);
  assert.match(code,/minimumIntervalMinutes\(id|p\.id\)/);
  assert.doesNotMatch(code,/last_attempt_at < now\(\)-interval '5 minutes'/);
 }
 assert.match(routes,/PROVIDER_REFRESH_INTERVAL/);
 assert.match(service,/UPDATE satellite\.providers SET last_attempt_at=now\(\)/);
 assert.match(routes,/refresh_requested_at IS NULL/);
});
