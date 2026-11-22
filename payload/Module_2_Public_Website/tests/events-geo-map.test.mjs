import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import vm from 'node:vm';
const root=join(dirname(fileURLToPath(import.meta.url)),'../');
const html=readFileSync(join(root,'public/events-radar.html'),'utf8');
const api=readFileSync(join(root,'src/app/api/events/route.ts'),'utf8');
const backend=readFileSync(join(root,'../Module_1_Adapter/src/modules/events/routes.ts'),'utf8');
function block(start,end){const a=html.indexOf(start);assert(a>=0,start);const b=html.indexOf(end,a+start.length);assert(b>a,end);return html.slice(a,b);}
const code=block('const GEO_REFERENCE','function asPublishedEvent');
const context={Math,Map,Number,String,Object,Array,CENTERS:{Karachi:{lat:24.8936,lng:67.0529},Lahore:{lat:31.5204,lng:74.3587},Islamabad:{lat:33.6844,lng:73.0479}},console};
vm.createContext(context);
vm.runInContext(code,context);
const check=item=>vm.runInContext('isPhysicalVenue('+JSON.stringify(item)+')',context);
const project=(lng,lat)=>JSON.parse(JSON.stringify(vm.runInContext('projectedVenue('+lng+','+lat+')',context)));
const group=(events)=>JSON.parse(JSON.stringify(vm.runInContext('eventVenueGroups('+JSON.stringify(events)+')',context)));
const valid=(city,venue,latitude,longitude)=>({city,venue,latitude,longitude});
test('accurate geographic Mercator replaces invented city anchor offsets',()=>{
 assert.match(html,/const GEO_REFERENCE=\{west:59,east:78,south:20,north:39\}/);
 assert.doesNotMatch(html,/EVENTS_CITY_ANCHOR/);assert.doesNotMatch(html,/anchor\.x\+\(lng-center\.lng\)/);
 const l=project(74.259,31.464),k=project(67.076083,24.90139),i=project(73.08298,33.69726);
 assert(l.x>k.x);assert(i.y<l.y);assert(k.y>l.y);assert(l.x>0&&l.x<100&&k.y>0&&k.y<100);
});
test('verified Karachi, Lahore and Islamabad named venues accept exact physical coordinates',()=>{
 assert(check(valid('Lahore','Lahore Expo Centre',31.464,74.259)));
 assert(check(valid('Karachi','Karachi Expo Centre',24.90139,67.076083)));
 assert(check(valid('Islamabad','Pak-China Friendship Centre',33.69726,73.08298)));
});
test('online, placeholder, absent, city-centre and out-of-city coordinates fail closed',()=>{
 assert(!check(valid('Lahore','Online webinar',31.464,74.259)));
 assert(!check(valid('Lahore','Zoom meeting',31.464,74.259)));
 assert(!check(valid('Lahore','TBA',31.464,74.259)));
 assert(!check(valid('Lahore','Lahore Expo Centre',null,null)));
 assert(!check(valid('Lahore','Lahore Expo Centre',31.5204,74.3587)));
 assert(!check(valid('Karachi','Karachi Expo Centre',31.464,74.259)));
 assert(!check({...valid('Lahore','Lahore Expo Centre',31.464,74.259),location_verified:false}));
});
test('one venue pin represents 26 colocated events; different venues stay separate',()=>{
 const events=Array.from({length:26},(_,i)=>({id:'l'+i,city:'Lahore',venue:'Lahore Expo Centre',lat:31.464,lng:74.259}));
 events.push({id:'k1',city:'Karachi',venue:'Karachi Expo Centre',lat:24.90139,lng:67.076083});
 const grouped=group(events);assert.equal(grouped.length,2);assert.equal(grouped.find(x=>x.city==='Lahore').events.length,26);
 assert.equal(new Set(grouped.map(x=>x.id)).size,2);
});
test('map pins use only exact event coordinates in MapLibre and Google',()=>{
 assert.match(html,/\.setLngLat\(\[venue\.lng,venue\.lat\]\)/);
 assert.match(html,/fromLatLngToDivPixel\(new google\.maps\.LatLng\(this\.event\.lat,this\.event\.lng\)\)/);
 assert.match(html,/venueGroups\(\)\.forEach/);assert.match(html,/pci-venue-pin/);
 assert.doesNotMatch(html,/<span class="event-marker__title"/);
});
test('only georeferenced fallback rather than invented city-offset pins',()=>{
 assert.match(html,/pci-geo-reference\.svg/);assert.match(html,/GEOREFERENCED MAP/);
 assert.match(html,/const approx=projectedVenue\(lng,lat\)/);
});
test('event API no-cache and browser refresh loads current admin publication',()=>{
 assert.match(api,/no-store, no-cache, must-revalidate/);
 assert.match(html,/fetch\('\/api\/events\?fresh='\+Date\.now\(\)/);
});
test('backend excludes online and placeholder venues from public map API',()=>{
 assert.match(backend,/lower\(trim\(e\.venue\)\) NOT IN/);
 assert.match(backend,/venue !~\* '\(webinar/);
});
test('small pulsing marker, collision-free venue counts and grouped card',()=>{
 assert.match(html,/pciPinPulse/);assert.match(html,/pci-venue-count/);
 assert.match(html,/data-group-item/);assert.match(html,/venueGroups\(\)\.forEach/);
 assert.match(html,/prefers-reduced-motion/);
});
