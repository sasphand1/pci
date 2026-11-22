import test from 'node:test';
import assert from 'node:assert/strict';
import {SATELLITE_MAX_UPSTREAM_BYTES,isPublicSatelliteRead,readLimitedText,satellitePermission} from '../src/modules/satellite/guard.mjs';

test('satellite path allowlist is exact; admin is never treated as public',()=>{
 assert.equal(isPublicSatelliteRead('/api/v1/satellite/fires/latest','GET'),true);
 assert.equal(isPublicSatelliteRead('/api/v1/satellite/sources','HEAD'),true);
 for(const path of ['/api/v1/satellites','/api/v1/admin/satellite/providers','/api/v1/satelliteevil'])assert.equal(isPublicSatelliteRead(path,'GET'),false);
 assert.equal(isPublicSatelliteRead('/api/v1/satellite/sources','POST'),false);
});
test('bounded reader accepts small legitimate NASA payload',async()=>{
 const r=new Response('latitude,longitude\n31,74',{headers:{'content-type':'text/csv'}});
 assert.equal(await readLimitedText(r),'latitude,longitude\n31,74');
});
test('bounded reader rejects malicious advertised payload size',async()=>{
 const r=new Response('not read',{headers:{'content-length':String(SATELLITE_MAX_UPSTREAM_BYTES+1)}});
 await assert.rejects(readLimitedText(r),/too large/);
});
test('bounded reader rejects oversized streaming payload even without content-length',async()=>{
 const r=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(200));controller.close();}}));
 await assert.rejects(readLimitedText(r,100),/too large/);
});
test('bounded reader fails on non-success upstream status',async()=>{
 await assert.rejects(readLimitedText(new Response('oops',{status:503})),/Upstream HTTP 503/);
});
test('bounded reader fails for malformed UTF-8',async()=>{
 const r=new Response(new Uint8Array([255,254]));
 await assert.rejects(readLimitedText(r),/encoded data|valid/);
});
test('server must preserve existing PCI rate limiter and use strict satellite-specific guard',async()=>{
 const {readFileSync}=await import('node:fs');
 const text=readFileSync(new URL('../src/server.ts',import.meta.url),'utf8');
 assert.match(text,/boundedLimit\(key,300,60\)/);
 assert.match(text,/satellitePermission\(boundedLimit,key\)/);
 assert.match(text,/SATELLITE_UNAVAILABLE/);
 assert.match(text,/SATELLITE_RATE_LIMIT/);
});

test('public satellite read queries use shared Redis cache instead of repeatedly hitting PostgreSQL',async()=>{
 const {readFileSync}=await import('node:fs');const content=readFileSync(new URL('../src/modules/satellite/routes.ts',import.meta.url),'utf8');
 assert.match(content,/cacheRead\(`satellite:observations:v1:/);
 assert.match(content,/satellite:epoch/);
 assert.match(content,/},30\)/);
});

test('simulated 1000 requests: cap at 60 and block excess independently from main site',async()=>{
 let requests=0;const limiter=async(_key,max,window)=>{assert.equal(max,60);assert.equal(window,60);return ++requests<=max;};
 const decisions=await Promise.all(Array.from({length:1000},()=>satellitePermission(limiter,'test-ip')));
 assert.equal(decisions.filter(x=>x==='allow').length,60);
 assert.equal(decisions.filter(x=>x==='rate_limited').length,940);
});
test('Redis failure fails closed for satellite API, rather than crashing creator routes',async()=>{
 const decision=await satellitePermission(async()=>{throw Error('Redis down');},'test-ip');
 assert.equal(decision,'unavailable');
});
