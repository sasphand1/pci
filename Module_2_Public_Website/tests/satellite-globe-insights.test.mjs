import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');

test('orbit propagation keeps the ISS in a valid low orbit and geostationary objects fixed',()=>{
 const ctx={};vm.runInNewContext(read('../public/satellite-orbits.js'),ctx);const O=ctx.PCIOrbits;
 const iss={meanMotion:15.5,eccentricity:0.0005,inclination:51.64,raOfAscNode:200,argOfPericenter:90,meanAnomaly:270,epoch:'2026-11-25T00:00:00Z'};
 const t0=Date.parse('2026-11-25T06:00:00Z');
 for(let m=0;m<190;m+=7){const p=O.position(iss,t0+m*60000);assert.ok(p.altitudeKm>380&&p.altitudeKm<460);assert.ok(Math.abs(p.latitude)<=51.7);assert.ok(Math.abs(p.longitude)<=180);}
 const geo={meanMotion:1.0027,eccentricity:0.0001,inclination:0.05,raOfAscNode:0,argOfPericenter:0,meanAnomaly:0,epoch:'2026-11-25T00:00:00Z'};
 const a=O.position(geo,t0),b=O.position(geo,t0+12*3600000);assert.ok(Math.abs(a.longitude-b.longitude)<0.5);
 assert.equal(O.position({meanMotion:'x'},t0),null);assert.ok(O.track(iss,t0).length>=1);
});
test('globe map: rotating Earth, live satellites, zoom to fixed Pakistan view, validated inputs',()=>{
 const map=read('../public/satellite-map.html');
 for(const x of ["setProjection({type:'globe'})",'/satellite-orbits.js','Zoom to Pakistan','Back to globe','prefers-reduced-motion','satellite-labels','iss-track','fitPakistan','interactive:false','quakes','alerts'])assert.ok(map.includes(x),x);
 assert.match(map,/orbits=\(Array\.isArray\(d\.orbits\)\?d\.orbits:\[\]\)\.slice\(0,80\)/);
 assert.match(map,/event\.origin!==location\.origin/);
});
test('dashboard shows Go-Out Score, safety, smog watch, industry cards and weekly rankings from the proxy',()=>{
 const dash=read('../src/components/SatelliteDashboard.tsx');
 for(const x of ["get('insights',city)","'rankings'","'orbits'",'GO-OUT SCORE','IS MY AREA SAFE TODAY','SMOG AND HEATWAVE WATCH','Risk and planning cards','City rankings','Insurers and banks','Power (DISCOs)','Telecom, GPS, drones','Not an official PMD warning','Spray window','Irrigation'])assert.ok(dash.includes(x),x);
 assert.doesNotMatch(dash,/style=\{/);
 const api=read('../src/app/api/satellite/route.ts');
 assert.match(api,/'insights':c=>`insights\?city=\$\{c\}`/);assert.match(api,/'rankings':'rankings\/weekly'/);
});
