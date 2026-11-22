import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {classifyEvent,canonicalCategory,EVENT_CATEGORIES,ENGINE_VERSION} from '../src/modules/events/classifier.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const src=p=>readFileSync(join(root,p),'utf8');
const classify=name=>classifyEvent({name,sourceCategory:'community'});

test('exactly ten distinct category IDs with stable ordering',()=>{
 assert.deepEqual(EVENT_CATEGORIES.map(c=>c.id),['sports','education','gaming','technology','business','arts','community','fashion','health','food']);
 assert.equal(new Set(EVENT_CATEGORIES.map(x=>x.id)).size,10);
 assert.equal(ENGINE_VERSION,'events-rules-2.0.0');
});
for(const [text,category] of [
 ['Pakistan Cricket Match','sports'],['University Scholarship Education Seminar','education'],
 ['Esports Gaming PUBG Tournament','gaming'],['AI Robotics Hackathon','technology'],
 ['Trade Fair Business Expo','business'],['Live Music Concert','arts'],['Community Volunteer Celebration','community'],['Fashion Week Runway Show','fashion'],['Medical Healthcare Conference','health'],['Lahore Food Festival','food']
])test('classification '+category,()=>{
 const r=classify(text);assert.equal(r.category,category);assert.ok(r.confidence>=60);assert.equal(r.state,'suggested');
});
test('generic text never becomes high-confidence publication evidence',()=>{
 const r=classifyEvent({name:'Event next month',sourceCategory:'expos'});
 assert.equal(r.category,'business');assert.equal(r.state,'needs_review');assert.equal(r.confidence,20);
});
test('competing category evidence is held for human review',()=>{
 const r=classifyEvent({name:'Gaming Cricket Esports Match',sourceCategory:'sports'});
 assert.equal(r.state,'needs_review');assert.ok(r.confidence<60);
});
test('legacy sources map without dropping their records',()=>{
 assert.equal(canonicalCategory('expos'),'business');assert.equal(canonicalCategory('conferences'),'education');
 assert.equal(canonicalCategory('arts'),'arts');assert.equal(canonicalCategory('not-real'),null);
});
test('classifier is pure and deterministic, with bounded input',()=>{
 const e={name:'University seminar',sourceCategory:'conferences'};
 assert.deepEqual(classifyEvent(e),classifyEvent(e));assert.deepEqual(e,{name:'University seminar',sourceCategory:'conferences'});
 const huge=classifyEvent({name:'Unknown',description:'x'.repeat(10000000)});
 assert.equal(huge.state,'needs_review');
});
test('feed importer persists results, preserves manual override and never auto-approves',()=>{
 const s=src('Module_1_Adapter/src/modules/events/service.ts');
 assert.match(s,/classifyEvent\(/);assert.match(s,/classification_category/);
 assert.match(src('Module_1_Adapter/scripts/copy-assets.mjs'),/modules\/events\/classifier\.mjs/);
 assert.match(s,/classification_state='manual'/);
 assert.match(s,/false,true,\$17/);
 assert.match(s,/approved=CASE WHEN pci_events\.deleted_at IS NOT NULL THEN false WHEN pci_events\.fingerprint=EXCLUDED\.fingerprint/);
});
test('new database migration is additive with bounded checks and idempotence',()=>{
 const s=src('Module_1_Adapter/database/migrations/099_events_intelligence.sql');
 assert.match(s,/ADD COLUMN IF NOT EXISTS classification_category/);
 assert.match(s,/confidence BETWEEN 0 AND 100/);
 assert.match(s,/pg_get_constraintdef/);
 assert.doesNotMatch(s,/DROP TABLE|TRUNCATE|DELETE FROM pci_events/i);
 const bootstrap=src('Module_1_Adapter/src/lib/events-schema.ts');assert.match(bootstrap,/099_events_intelligence\.sql/);
});
test('admin API is under existing authentication/CSRF, owner-only writes',()=>{
 const route=src('Module_1_Adapter/src/modules/events/routes.ts');
 assert.match(route,/adminEventsRoutes\.use\(requireAdmin,roles\('owner','editor'\)\)/);
 assert.match(route,/adminEventsRoutes\.use\('\/intelligence',intelligenceRoutes\)/);
 const intel=src('Module_1_Adapter/src/modules/events/intelligence.ts');
 assert.match(intel,/\.patch\('\/bucket\/:origin\/:id',roles\('owner'\)/);
 assert.match(intel,/\.post\('\/classify-pending',roles\('owner'\)/);
 assert.match(intel,/VENUE_COORDINATES/);assert.match(intel,/SOURCE_NOT_APPROVED/);
 assert.match(intel,/audit\(actor/);
});
test('classification backfill is lock-bounded, has a max batch and does not publish',()=>{
 const intel=src('Module_1_Adapter/src/modules/events/intelligence.ts');
 assert.match(intel,/Math\.min\(100/);assert.match(intel,/pg_try_advisory_lock/);
 assert.match(intel,/classification_category IS NULL/);assert.match(intel,/pg_advisory_unlock/);
 const schedule=src('Module_1_Adapter/src/modules/sync/scheduler.ts');
 assert.match(schedule,/classifyPendingEvents\(100\)/);
});
