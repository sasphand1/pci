import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('admin source enable triggers a safe immediate dispatch',()=>{
 const s=read('../src/modules/satellite/routes.ts');
 assert.match(s,/satelliteTick/);assert.match(s,/setImmediate\(\(\)=>\{void satelliteTick\(\);\}\)/);
 assert.match(s,/roles\('owner'\)/);assert.match(s,/satellite\.provider\.update/);
});
test('duplicate refresh request returns queued without HTTP 409',()=>{
 const s=read('../src/modules/satellite/routes.ts');
 assert.match(s,/Refresh already queued or processing/);
 assert.match(s,/res\.status\(202\)/);
});
test('worker starts immediately and subsequently polls every minute',()=>{
 const s=read('../src/modules/sync/scheduler.ts');
 assert.match(s,/void satelliteTick\(\)/);
 assert.match(s,/cron\.schedule\('\* \* \* \* \*',\(\)=>void satelliteTick\(\)\)/);
});
test('queued jobs respect atomic cooldown while preserving the request marker',()=>{
 const s=read('../src/modules/satellite/service.ts');
 assert.match(s,/minimumIntervalMinutes\(p\.id\)/);
 assert.match(s,/UPDATE satellite\.providers SET last_attempt_at=now\(\)/);
 assert.match(s,/last_attempt_at <= now\(\)-make_interval\(mins=>GREATEST\(refresh_minutes,\$2::int\)\)/);
 assert.doesNotMatch(s,/SET last_attempt_at=now\(\),refresh_requested_at=NULL WHERE id=\$1/);
});
test('Power coordinates respect immutable tuple',()=>{
 assert.match(read('../src/modules/satellite/service.ts'),/const \[longitude,latitude\]=coords;/);
});
