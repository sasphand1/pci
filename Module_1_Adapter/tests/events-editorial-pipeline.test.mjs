import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CURATED_EVENTS,publishedCuratedEvents,mergePublicEvents} from '../../Module_2_Public_Website/src/lib/curated-events.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const source=p=>readFileSync(resolve(root,p),'utf8');
test('curated notices have official evidence, complete venues, valid future intervals and credible locations',()=>{
 assert.ok(CURATED_EVENTS.length>=3);
 for(const e of CURATED_EVENTS){
  assert.match(e.event_url,/^https:\/\//);assert.ok(e.name.length>5);assert.ok(e.venue.length>5);
  assert.ok(Date.parse(e.start_at)<Date.parse(e.end_at));
  assert.ok(Number.isFinite(e.latitude)&&Number.isFinite(e.longitude));
  assert.ok(['Karachi','Lahore','Islamabad'].includes(e.city));
  assert.equal(e.ticket_type,'unknown','do not invent pricing');
 }
});
test('expired notices disappear automatically',()=>{
 assert.equal(publishedCuratedEvents(Date.parse('2027-12-01T00:00:00+05:00')).length,0);
 assert.equal(publishedCuratedEvents(Date.parse('2026-11-22T00:00:00+05:00')).length,3);
});
test('approved backend records take precedence when events overlap',()=>{
 const original=CURATED_EVENTS[0];const newer={...original,id:'verified-owner-version'};
 const combined=mergePublicEvents([newer],Date.parse('2026-11-22T00:00:00+05:00'));
 assert.equal(combined.filter(x=>x.name===newer.name&&x.city===newer.city).length,1);
 assert.equal(combined.find(x=>x.name===newer.name)?.id,'verified-owner-version');
});
test('frontend uses backend authority and cannot resurrect deleted notices',()=>{
 const api=source('Module_2_Public_Website/src/app/api/events/route.ts');
 assert.match(api,/const entries=upstreamEvents/);
 assert.doesNotMatch(api,/mergePublicEvents\(upstreamEvents\)/);
 assert.match(api,/backend_status/);
 assert.match(api,/approved/i);
 assert.ok(existsSync(resolve(root,'Module_1_Adapter/database/migrations/098_editorial_events.sql')));
});
test('owner editorial endpoints must validate source and coordinates and support unpublish',()=>{
 const routes=source('Module_1_Adapter/src/modules/events/routes.ts');
 assert.match(routes,/adminEventsRoutes\.post\('\/editorial'/);
 assert.match(routes,/roles\('owner'\)/);
 assert.match(routes,/SOURCE_URL_REQUIRED|source_url/);
 assert.match(routes,/VENUE_COORDINATES/);
 assert.match(routes,/editorial\/\:id\/visibility/);
 const schema=source('Module_1_Adapter/src/lib/events-schema.ts');
 assert.match(schema,/098_editorial_events/);
});
test('map displays server data in static preview even when MapLibre is unavailable',()=>{
 const html=source('Module_2_Public_Website/public/events-radar.html');
 assert.match(html,/renderPreviewPins\(\)/);
 assert.match(html,/VERIFIED EVENT LOCATIONS/);
 assert.match(html,/end_at/);
 assert.match(html,/waze\.com\/ul\?ll=/);
});
