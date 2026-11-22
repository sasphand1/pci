import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('events management supports ten categories, override and auditable deletion',()=>{
 const page=read('../src/app/events/intelligence/page.tsx');
 assert.match(page,/Ten Categories/);assert.match(page,/Set category/);
 assert.match(page,/deleteEvent/);assert.match(page,/restoreEvent/);
 assert.match(page,/method:'DELETE'/);assert.match(page,/confirm:'DELETE'/);assert.match(page,/csrf:identity\?\.csrfToken/);
 assert.match(page,/\['deleted','Deleted'\]/);
});
test('discovery UI distinguishes news leads from verified events',()=>{
 const page=read('../src/components/EventsSourcesDiscovery.tsx');
 assert.match(page,/Google News/);assert.match(page,/discovery leads/i);
 assert.match(page,/event schedules/i);assert.match(page,/is_event:false/);
 assert.match(page,/rel="noopener noreferrer"/);
 assert.match(read('../vendor/pci-ui/src/styles.css'),/events-intelligence-v2\.css/);
});
