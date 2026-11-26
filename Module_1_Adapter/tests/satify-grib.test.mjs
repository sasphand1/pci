import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeGrib,valueAt} from '../src/modules/satify/grib.mjs';
const load=f=>readFileSync(new URL(`./fixtures/grib/${f}`,import.meta.url));
test('GRIB1: real ECMWF 2 m temperature decodes to plausible kelvin values',()=>{
 const [f]=decodeGrib(load('regular_ll_sfc.grib'));
 assert.equal(f.edition,1);assert.equal(f.ni,72);assert.equal(f.nj,37);assert.equal(f.di,5);
 const v=[...f.values];assert.ok(Math.min(...v)>200&&Math.max(...v)<330);
 assert.ok(Math.abs(valueAt(f,30,75)-307.9)<0.1);
});
test('GRIB1: scanning mode 64 (south to north) gives the same values at the same places',()=>{
 const [a]=decodeGrib(load('regular_ll_sfc.grib')),[b]=decodeGrib(load('scanning_mode_64.grib'));
 for(const lat of [-60,0,31.5,60])for(const lon of [0,74.3,200])assert.ok(Math.abs(valueAt(a,lat,lon)-valueAt(b,lat,lon))<0.01);
});
test('GRIB2: real ECMWF mean sea level pressure decodes in pascals with forecast time',()=>{
 const [f]=decodeGrib(load('regular_ll_msl.grib'));
 assert.equal(f.edition,2);assert.equal(f.ni,360);const v=[...f.values];
 assert.ok(Math.min(...v)>90000&&Math.max(...v)<110000);assert.ok(Date.parse(f.validTime)>Date.parse(f.refTime));
});
test('GRIB1 bitmaps: missing points become NaN, the rest stay valid',()=>{
 const fs=decodeGrib(load('fields_with_missing_values.grib'));const v=[...fs[0].values];
 assert.ok(v.some(Number.isNaN));assert.ok(v.filter(Number.isFinite).every(x=>x>150&&x<350));
});
test('unsupported content is reported by name, not silently misread',()=>{
 assert.throws(()=>decodeGrib(new Uint8Array([1,2,3,4,5,6,7,8,9])),/No GRIB messages/);
});
