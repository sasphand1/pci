import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(here,'..');
const sql=readFileSync(resolve(root,'database/migrations/101_official_events_2026_2027.sql'),'utf8');
const records=JSON.parse(readFileSync(resolve(here,'events-official-population-v3-data.json'),'utf8'));
const schema=readFileSync(resolve(root,'src/lib/events-schema.ts'),'utf8');
const publicRoot=resolve(root,'../Module_2_Public_Website');
const adminRoot=resolve(root,'../Module_3_Admin_Panel');
test('30 unique primary venue dated notices for supported cities',()=>{
 assert.equal(records.length,30);
 assert.equal(new Set(records.map(e=>`${e.name}|${e.start}|${e.city}`)).size,30);
 assert.ok(records.every(e=>['Karachi','Lahore','Islamabad'].includes(e.city)));
 assert.ok(records.every(e=>Date.parse(e.end)>=Date.parse(e.start)));
 assert.ok(records.every(e=>e.url.startsWith('https://www.pakexcel.com/')||e.url.startsWith('https://pakexcel.com/')||e.url.startsWith('https://tdap.gov.pk/')));
});
test('10 category IDs and no fabricated gaming or sports entries',()=>{
 const ids=['sports','education','gaming','technology','business','arts','community','fashion','health','food'];
 assert.ok(records.every(e=>ids.includes(e.category)));
 assert.ok(records.some(e=>e.category==='health'));
 assert.ok(records.some(e=>e.category==='food'));
 assert.ok(records.some(e=>e.category==='fashion'));
 assert.equal(records.filter(e=>e.category==='gaming').length,0);
});
test('SQL seed is idempotent and cannot resurrect a deleted or owner-edited event',()=>{
 assert.match(sql,/ON CONFLICT \(name,start_at,city\) DO NOTHING;/);
 assert.doesNotMatch(sql,/DO UPDATE|UPDATE pci_editorial_events/i);
 assert.match(sql,/approved,review_decision,all_day/);
 assert.doesNotMatch(sql,/ticket_type|price_text/i);
});
test('production backend bootstraps the official notices after existing event schema',()=>{
 assert.match(schema,/100_events_intelligence_integrations\.sql/);
 assert.match(schema,/101_official_events_2026_2027\.sql/);
 assert.ok(schema.indexOf('100_events_intelligence_integrations.sql')<schema.indexOf('101_official_events_2026_2027.sql'));
});
test('all 10 categories exist in public map and table',()=>{
 const map=readFileSync(resolve(publicRoot,'public/events-radar.html'),'utf8');
 const table=readFileSync(resolve(publicRoot,'src/lib/event-table.mjs'),'utf8');
 for(const category of ['sports','education','gaming','technology','business','arts','community','fashion','health','food']){
  assert.ok(map.includes(`id:'${category}'`),`map missing ${category}`);
  assert.ok(table.includes(`${category}:`),`table missing ${category}`);
 }
 assert.match(map,/item\.all_day\?'Time: see organiser'/);
});
test('admin defaults to all records, including already published editorials',()=>{
 const admin=readFileSync(resolve(adminRoot,'src/app/events/intelligence/page.tsx'),'utf8');
 assert.match(admin,/\[category,setCategory\]=useState\('all'\),\[status,setStatus\]=useState\('all'\)/);
 assert.match(admin,/\['Feed imports',counts\?\.total\?\?0\]/);
 assert.match(admin,/\} records · \{/);
});
test('soft-delete and public deletion guards remain in place',()=>{
 const v2=readFileSync(resolve(root,'database/migrations/100_events_intelligence_integrations.sql'),'utf8');
 const routes=readFileSync(resolve(root,'src/modules/events/routes.ts'),'utf8');
 assert.match(v2,/deleted_at/);
 assert.match(routes,/deleted_at IS NULL/);
 assert.match(v2,/pci_event_action_log/);
});
