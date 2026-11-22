import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePublicEvents,filterPublicEvents,eventWazeUrl,eventCategoryLabel} from '../src/lib/event-table.mjs';
const now=Date.parse('2026-11-22T00:00:00Z');
const items=[
 {id:'e1',name:'Karachi Book Fair',start_at:'2026-12-17T00:00:00+05:00',end_at:'2026-12-22T00:00:00+05:00',all_day:true,city:'Karachi',category:'arts',venue:'Karachi Expo Centre',latitude:24.90139,longitude:67.076083,event_url:'https://example.org/event',source_name:'Official organiser'},
 {id:'e2',name:'Lahore Book Fair',start_at:'2027-01-20T00:00:00+05:00',city:'Lahore',category:'arts',venue:'Lahore Expo Centre',latitude:null,longitude:null},
 {id:'e3',name:'Islamabad Expo',start_at:'2026-11-24T00:00:00+05:00',city:'Islamabad',category:'expos',venue:'Pak China Centre'}
];
test('numbered event table is built from actual published API events, date sorted',()=>{
 const v=normalizePublicEvents(items,now);assert.equal(v.length,3);assert.deepEqual(v.map(e=>e.id),['e3','e1','e2']);
});
test('city/category/search/next 7 and 30-day filters work together',()=>{
 const v=normalizePublicEvents(items,now);
 assert.deepEqual(filterPublicEvents(v,{city:'Karachi'},now).map(e=>e.id),['e1']);
 assert.deepEqual(filterPublicEvents(v,{category:'expos'},now).map(e=>e.id),['e3']);
 assert.deepEqual(filterPublicEvents(v,{window:'week'},now).map(e=>e.id),['e3']);
 assert.deepEqual(filterPublicEvents(v,{window:'month'},now).map(e=>e.id),['e3','e1']);
 assert.deepEqual(filterPublicEvents(v,{search:'LAHORE'},now).map(e=>e.id),['e2']);
 assert.deepEqual(filterPublicEvents(v,{search:'Expo'},now).map(e=>e.id),['e3','e1','e2']);
});
test('expired, missing or malformed events are not listed',()=>{
 assert.equal(normalizePublicEvents([{id:'x',name:'Past',city:'Karachi',start_at:'2020-01-01T00:00:00Z'},null,{id:'u',name:'Bad',city:'Karachi',start_at:'missing'}],now).length,0);
});
test('ongoing multi-day events retain visibility until end',()=>{
 const v=normalizePublicEvents([{...items[0],start_at:'2026-11-18T00:00:00+05:00',end_at:'2026-11-26T00:00:00+05:00'}],now);
 assert.equal(v.length,1);assert.equal(filterPublicEvents(v,{window:'week'},now).length,1);
});
test('directions are linked only when supported by real coordinates',()=>{
 const v=normalizePublicEvents(items,now);
 assert.match(eventWazeUrl(v[1]),/^https:\/\/waze\.com\/ul\?ll=/);
 assert.equal(eventWazeUrl(v[2]),null);
});
test('no unsafe hyperlinks or invented admission details',()=>{
 const v=normalizePublicEvents([{...items[0],event_url:'javascript:alert(1)',ticket_type:'unknown'}],now);
 assert.equal(v[0].source_url,null);assert.equal(v[0].admission,'unknown');assert.equal(eventCategoryLabel('arts'),'Arts & Entertainment');
});
