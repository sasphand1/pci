import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {EVENT_CATEGORIES,classifyEvent} from '../src/modules/events/classifier.mjs';
import {parseRssFeed} from '../src/modules/events/parse.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../');
const read=rel=>readFileSync(resolve(root,rel),'utf8');
test('all ten category IDs remain stable and unique',()=>{
 const ids=EVENT_CATEGORIES.map(x=>x.id);
 assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);
 for(const id of ['fashion','health','food'])assert.ok(ids.includes(id));
});
test('specialist event classification uses real content, not fabricated dates',()=>{
 for(const [title,expected] of [
  ['Fashion Week runway fashion show','fashion'],
  ['Medical healthcare doctors conference','health'],
  ['Food Festival Culinary Championship','food'],
  ['Esports Gaming PUBG Tournament','gaming'],
 ]){
  const result=classifyEvent({name:title});assert.equal(result.category,expected);assert.ok(result.confidence>=60);
 }
});
test('a Google News RSS article date is not an event start date',()=>{
 const rss='<rss><channel><item><title>Pakistan food festival news</title><link>https://news.google.com/articles/safe</link><pubDate>Sun, 22 Nov 2026 04:00:00 GMT</pubDate></item></channel></rss>';
 const items=parseRssFeed(rss);assert.equal(items.length,1);assert.equal(items[0].start,'');
});
test('Google News discovery cannot import or publish events',()=>{
 const discovery=read('Module_1_Adapter/src/modules/events/discovery.ts');
 const routes=read('Module_1_Adapter/src/modules/events/integrations.ts');
 assert.match(discovery,/is_event:false/);assert.match(discovery,/Google News RSS/);
 assert.match(routes,/get\('\/discover'/);
 assert.doesNotMatch(discovery,/INSERT INTO pci_events|approved=true/);
 assert.match(discovery,/cache=new Map/);assert.match(discovery,/inflight=new Map/);
});
test('deletion uses owner role, strict confirmation and atomic audit',()=>{
 const s=read('Module_1_Adapter/src/modules/events/integrations.ts');
 for(const x of [/\.delete\('\/bucket\/:origin\/:id',roles\('owner'\)/,/confirm:z\.literal\('DELETE'\)/,/confirm:z\.literal\('RESTORE'\)/,/SELECT id,deleted_at FROM \$\{table\} WHERE id=\$1 FOR UPDATE/,/INSERT INTO pci_event_action_log/,/await c\.query\('COMMIT'\)/,/await c\.query\('ROLLBACK'\)/,/approved=false,active=false,deleted_at=now\(\)/,/approved=false,active=true,deleted_at=NULL/])assert.match(s,x);
});
test('deleted events never revive via feed refresh or old publication routes',()=>{
 const svc=read('Module_1_Adapter/src/modules/events/service.ts');
 const routes=read('Module_1_Adapter/src/modules/events/routes.ts');
 assert.match(svc,/active=\(pci_events\.deleted_at IS NULL\)/);
 assert.match(svc,/approved=CASE WHEN pci_events\.deleted_at IS NOT NULL THEN false/);
 assert.match(routes,/e\.approved=true AND e\.active=true AND e\.deleted_at IS NULL/);
 assert.match(routes,/WHERE pci_editorial_events\.deleted_at IS NULL/);
 assert.match(routes,/WHERE approved=true AND deleted_at IS NULL/);
});
test('previously public editorial notices are moved into a deletable database',()=>{
 const migration=read('Module_1_Adapter/database/migrations/100_events_intelligence_integrations.sql');
 const publicApi=read('Module_2_Public_Website/src/app/api/events/route.ts');
 assert.match(migration,/INSERT INTO pci_editorial_events/);assert.match(migration,/21st Karachi International Book Fair/);
 assert.match(migration,/IAPEX27/);assert.match(migration,/40th Lahore International Book Fair/);
 assert.match(migration,/ON CONFLICT\(name,start_at,city\) DO NOTHING/);
 assert.match(publicApi,/const entries=upstreamEvents/);
 assert.doesNotMatch(publicApi,/mergePublicEvents\(upstreamEvents\)/);
});
test('source directory distinguishes official pages from structured feeds',()=>{
 const d=read('Module_1_Adapter/src/modules/events/directory.ts');
 for(const name of ['TDAP','Pakistan Cricket Board','LAAM Fashion Week','Health Asia International','IFTECH','Google public calendars','TheSportsDB'])assert.ok(d.includes(name),name);
 assert.match(d,/official_announcements/);assert.match(d,/structured_feed/);
 assert.match(d,/discovery_only/);
});
