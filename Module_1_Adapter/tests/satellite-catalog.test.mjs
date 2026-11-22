import test from 'node:test';import assert from 'node:assert/strict';
import {PROVIDERS,CITIES,parseFirmsCsv,parsePower,validateProvider} from '../src/modules/satellite/catalog.mjs';
test('providers are a strict fixed allowlist',()=>{assert.equal(Object.keys(PROVIDERS).length,13);assert.equal(validateProvider('evil'),false);assert.equal(PROVIDERS.gpm.implemented,true);});
test('FIRMS parses records and rejects non Pakistan-bounding-box detections',()=>{const x=parseFirmsCsv('latitude,longitude,acq_date,acq_time,confidence,satellite\n31.5,74.3,2026-11-20,0302,n,N\n5,5,2026-11-20,0302,h,N');assert.equal(x.length,1);assert.equal(x[0].observedAt,'2026-11-20T03:02:00Z');assert.equal(x[0].payload.status,'thermal_anomaly_not_verified_fire');});
test('POWER values keep truthful provenance and omit fill values',()=>{const x=parsePower({properties:{parameter:{PRECTOTCORR:{20261120:2.4,20261121:-999},ALLSKY_SFC_SW_DWN:{20261120:5.2,20261121:-999}}}},'lahore');assert.equal(x.length,2);assert.equal(x[0].payload.notGpm,true);assert.equal(x[1].payload.unit,'kWh/m²/day');});
test('POWER rejects unknown location',()=>assert.throws(()=>parsePower({properties:{parameter:{}}},'elsewhere')));

test('two distinct hotspots at same timestamp preserve separate keys',()=>{const d=parseFirmsCsv('latitude,longitude,acq_date,acq_time,confidence\n31.5,74.3,2026-11-20,0302,n\n31.6,74.4,2026-11-20,0302,n');assert.equal(d.length,2);assert.notEqual(d[0].observationKey,d[1].observationKey);});

test('POWER null values must never become fabricated zero measurements',()=>{
 const x=parsePower({properties:{parameter:{PRECTOTCORR:{20261120:null},ALLSKY_SFC_SW_DWN:{20261120:null}}}},'lahore');
 assert.deepEqual(x,[]);
});
