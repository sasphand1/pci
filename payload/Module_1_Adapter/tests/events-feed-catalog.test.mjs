import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../src/modules/events/',import.meta.url);
const s=readFileSync(new URL('catalog.ts',root),'utf8');
const routes=readFileSync(new URL('routes.ts',root),'utf8');
test('real provider presets are documented and no synthetic events are inserted',()=>{
 assert.match(s,/thesportsdb\.com\/api\/v1\/json\/123\/eventsnextleague\.php\?id=5067/);
 assert.match(s,/thinktankcalendar\.com\/feeds\/events\.json/);
 assert.match(s,/raw\.githubusercontent\.com\/tech-conferences\/conference-data/);
 assert.doesNotMatch(s,/INSERT INTO pci_events/);
});
test('admin catalog routes require permissions, imports require review',()=>{
 assert.match(routes,/adminEventsRoutes\.use\(requireAdmin,roles\('owner','editor'\)\)/);
 assert.match(routes,/adminEventsRoutes\.post\('\/catalog\/:key\/install',roles\('owner'\)/);
 assert.match(routes,/false,false,false\)/);
});
test('public events response includes source health without publishing unapproved data',()=>{
 assert.match(routes,/approved=true AND e\.active=true/);
 assert.match(routes,/sources_enabled/);
 assert.match(routes,/awaiting_review/);
});
