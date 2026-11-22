import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/events-radar.html',import.meta.url),'utf8');
test('tiny 10px round red blinking markers replace giant diamonds',()=>{
 assert.match(source,/PCI_EVENTS_COMPACT_RED_PIN_V1/);
 assert.match(source,/width:10px!important;height:10px!important;border-radius:50%/);
 assert.match(source,/@keyframes pciSmallRedBlink/);
 assert.match(source,/\.event-marker__title\{display:none!important/);
});
test('all 10 visible category tabs preserve published-event filtering',()=>{
 for(const id of ['all','sports','education','gaming','technology','business','arts','community','fashion','health','food'])
  assert.ok(source.includes(`{id:'${id}',label:`),id);
 assert.match(source,/categoryMatches\(event\)/);
 assert.match(source,/state\.category=cat\.id;state\.pinnedId=null;refresh\(\);focusMap\(\)/);
});
test('published events only and Pakistan-bounded real coordinates',()=>{
 assert.match(source,/fetch\('\/api\/events'/);
 assert.match(source,/PUBLIC_EVENTS=body\.data\.map\(asPublishedEvent\)\.filter\(Boolean\)/);
 assert.match(source,/lat<23\|\|lat>38\|\|lng<60\|\|lng>78/);
 assert.match(source,/setLngLat\(\[event\.lng,event\.lat\]\)/);
});
