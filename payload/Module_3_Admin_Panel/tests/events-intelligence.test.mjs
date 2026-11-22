import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('new bucket management lives in existing admin layout',()=>{
 const page=read('../src/app/events/intelligence/page.tsx');
 assert.match(page,/<AdminPage title="Events Intelligence"/);
 assert.match(page,/RoleGate roles=\{\['owner','editor'\]\}/);
 assert.match(page,/SourceCard/);assert.match(page,/BucketRow/);
 assert.match(page,/Events Bucket/);assert.match(page,/Seven Categories/);
});
test('Admin role and CSRF protect publication and category changes',()=>{
 const page=read('../src/app/events/intelligence/page.tsx');
 assert.match(page,/!owner\|\|busy/);assert.match(page,/csrf:identity\?\.csrfToken/);
 assert.match(page,/decision/);assert.match(page,/audit/i);
});
test('central management styles imported once with responsive support',()=>{
 const css=read('../vendor/pci-ui/src/styles.css');
 assert.match(css,/events-intelligence\.css/);
 assert.equal(css.split('events-intelligence.css').length,2);
 const detail=read('../vendor/pci-ui/src/styles/events-intelligence.css');
 assert.match(detail,/@media\(max-width:640px\)/);
});
test('events intelligence navigation is reachable beside Events Sources',()=>{
 const nav=read('../src/lib/nav.ts');
 assert.match(nav,/href:'\/events\/intelligence'/);
 assert.match(nav,/href:'\/events\/sources'/);
 assert.match(nav,/href:'\/satellite'/);
});
