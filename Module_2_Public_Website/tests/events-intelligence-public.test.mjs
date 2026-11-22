import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('map has seven event categories and maps legacy category IDs',()=>{
 const radar=read('../public/events-radar.html');
 for(const name of ['sports','education','gaming','technology','business','arts','community'])assert.match(radar,new RegExp("id:'"+name+"'"));
 assert.match(radar,/item\.category==='expos'\?'business'/);
 assert.match(radar,/waze\.com\/ul\?ll=/);
});
test('events table uses canonical category labels without losing old source records',()=>{
 const helper=read('../src/lib/event-table.mjs');
 assert.match(helper,/gaming:'Gaming & Esports'/);
 assert.match(helper,/rawCategory==='expos'\?'business'/);
 const table=read('../src/components/EventsTable.tsx');
 assert.match(table,/events-table-section/);
 assert.match(table,/\['sports','education','gaming','technology','business','arts','community','fashion','health','food'\]/);
});
test('events stay under global shared website header and retain map/table',()=>{
 const page=read('../src/app/events/page.tsx');
 const layout=read('../src/app/layout.tsx');
 assert.match(layout,/<SiteHeader\s*\/>/);
 assert.match(page,/pci-events-frame/);
 assert.match(read('../src/components/EventsTable.tsx'),/Upcoming Events/);
});
