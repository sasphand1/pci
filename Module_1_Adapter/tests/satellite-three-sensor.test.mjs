import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('FIRMS checks 3 NASA VIIRS sensors over 3 days with a bounded batch',()=>{
 const s=read('../src/modules/satellite/service.ts');
 for(const sensor of ['VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','VIIRS_SNPP_NRT'])assert.ok(s.includes(sensor));
 assert.match(s,/FIRMS_DAYS=3/);
 assert.match(s,/for\(const sensor of FIRMS_SENSORS\)/);
 assert.match(s,/FIRMS incomplete/);
 assert.match(s,/sourceSensor:sensor/);
 assert.match(s,/observationKey:`\$\{sensor\}:/);
 assert.doesNotMatch(s,/\/VIIRS_SNPP_NRT\/60,23,78,38\/1/);
});
test('FIRMS uses strict PostgreSQL cooldown, including manual dispatch',()=>{
 const s=read('../src/modules/satellite/service.ts');
 const policy=read('../src/modules/satellite/policy.mjs');
 assert.match(policy,/firms:180/);
 assert.match(s,/GREATEST\(refresh_minutes,\$2::int\)/);
 assert.match(s,/last_attempt_at <= now\(\)-make_interval/);
});
test('FIRMS public latest includes full 3-day acquisition period',()=>{
 const s=read('../src/modules/satellite/routes.ts');
 assert.match(s,/list\('fire','bounding-box',q,4\)/);
});
test('FIRMS UI handles empty observations without inventing hotspots',async()=>{
 const s=read('../../Module_2_Public_Website/src/components/SatelliteDashboard.tsx');
 const {summarizeThermalDetections}=await import('../../Module_2_Public_Website/src/lib/satelliteScience.mjs');
 const empty=summarizeThermalDetections([]);
 assert.equal(empty.count,0);
 assert.match(empty.explanation,/No qualifying records/i);
 assert.match(empty.explanation,/does not establish that no fires occurred/i);
 assert.match(s,/fireInsight=summarizeThermalDetections\(fireRows\)/);
 assert.match(s,/Finding title="Thermal observations" detail=\{fireInsight\.explanation\}/);
 assert.match(s,/<details className=\{styles\.mapDisclosure\}>/);
 assert.match(s,/fireRows\.filter\(p=>typeof p\.latitude/);
 assert.doesNotMatch(s,/Thermal hotspots \(last 3 days\)/);
 assert.doesNotMatch(s,/No current records/);
});
