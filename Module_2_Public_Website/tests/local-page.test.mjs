import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {flattenPlaces,filterPlaces,splitPicks,placeKey,asOfShort,LOCAL_SORTS} from '../src/lib/local.mjs';
import {vsPercent,vsLeader} from '../src/fifi/components/explorer-kit.helpers.mjs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const cities=[
 {slug:'karachi',label:'Karachi',picks:[{placeId:'p1',name:'Pick One',rank:null,rating:4.9,reviewCount:80,area:'Clifton'}],places:[{placeId:'a',name:'Alpha',rank:1,rating:4.6,reviewCount:900,area:'DHA'},{placeId:'b',name:'Beta',rank:2,rating:4.7,reviewCount:100,area:null}]},
 {slug:'lahore',label:'Lahore',picks:[],places:[{placeId:'c',name:'Cafe C',rank:1,rating:4.5,reviewCount:5000,area:'Gulberg'}]}];
test('flatten marks picks and keeps city',()=>{
 const all=flattenPlaces(cities);assert.equal(all.length,4);
 const {picks,ranked}=splitPicks(all);assert.equal(picks.length,1);assert.equal(ranked.length,3);
 assert.equal(placeKey(all[0]),'karachi:p1');
});
test('filter by city, query and sort',()=>{
 const all=flattenPlaces(cities);
 assert.deepEqual(filterPlaces(all,{city:'lahore'}).map(p=>p.name),['Cafe C']);
 assert.deepEqual(filterPlaces(all,{query:'dha'}).map(p=>p.name),['Alpha']);
 assert.equal(filterPlaces(all,{sort:'rating'})[0].name,'Pick One');
 assert.equal(filterPlaces(all,{sort:'reviews'})[0].name,'Cafe C');
 assert.deepEqual(filterPlaces(all,{sort:'rank'}).map(p=>p.name).slice(0,3),['Alpha','Cafe C','Beta']);
 assert.equal(LOCAL_SORTS.length,4);
 assert.equal(asOfShort('nope'),'');
});
test('bar helpers never show a missing value as zero',()=>{
 assert.equal(vsPercent(null,5),null);assert.equal(vsPercent(-1,5),null);
 assert.equal(vsPercent(2,4),50);assert.equal(vsPercent(4.5,4.8,5),90);
 assert.equal(vsLeader(1,2),1);assert.equal(vsLeader(2,2),-1);assert.equal(vsLeader(null,3),1);assert.equal(vsLeader(null,null),-1);
});
test('Restaurants page uses the shared kit, real data and no sample content or inline styles',()=>{
 const ui=read('../src/fifi/pages/local.tsx'),page=read('../src/app/local/page.tsx'),kit=read('../src/fifi/components/explorer-kit.tsx');
 assert.match(page,/pubLocal/);assert.match(ui,/explorer-kit/);assert.match(ui,/HeadToHeadCard/);assert.match(ui,/VsDialog/);
 assert.doesNotMatch(ui,/fifi-data|businesses/);
 for(const s of [ui,kit])assert.doesNotMatch(s,/style=\{/);
 assert.match(ui,/Google Maps/);
});
