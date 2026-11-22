import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('public map and table expose fashion, health and food filters',()=>{
 const radar=read('../public/events-radar.html'),table=read('../src/components/EventsTable.tsx');
 for(const category of ['fashion','health','food']){assert.match(radar,new RegExp("id:'"+category+"'"));assert.ok(table.includes("'"+category+"'"));}
 assert.match(table,/fetch\('\/api\/events'/);
});
test('frontend cannot resurrect deleted editorial fallback',()=>{
 const route=read('../src/app/api/events/route.ts');
 assert.match(route,/const entries=upstreamEvents/);
 assert.doesNotMatch(route,/mergePublicEvents\(upstreamEvents\)/);
 assert.match(route,/EVENTS_BACKEND_UNAVAILABLE/);
});
