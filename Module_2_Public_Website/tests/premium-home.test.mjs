import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/app/page.tsx');
const snapshot=read('src/components/SnapshotStatus.tsx');
const entry=read('packages/ui/src/styles.css');

test('home page is built only from published rankings',()=>{
 for(const p of ["'/wheel'","'/rows'","'/status'","'/categories'","/rankings/${scope}?limit=100"])assert.ok(page.includes(p),p);
 assert.match(page,/<PublishedWheel sorts=\{wheel\?\.sorts\?\?\[\]\}\/>/);
 assert.match(page,/<PublishedRows platforms=/);
 assert.match(page,/<PublishedTop100 initial=\{initial\}/);
 assert.match(page,/<SnapshotStatus publishedAt=\{status\?\.publishedAt\}\/>/);
 assert.doesNotMatch(page,/hardcodedCreators|mockCreators|fakeCreators|placeholderViews|fabricatedMetrics/);
});
test('the three wheel sorts and the 100 rows are the published scopes',()=>{
 const lib=read('src/lib/public.ts');
 for(const s of ['wheel.subscribed','wheel.viewed','wheel.active'])assert.ok(lib.includes(s),s);
 assert.match(read('src/components/PublishedTop100.tsx'),/\/api\/v1\/public\/rankings\//);
});
test('top 100 offers wheel sorts, both platforms and categories, and checks the scope before fetching',()=>{
 const t=read('src/components/PublishedTop100.tsx');
 for(const s of ['wheel.subscribed','wheel.viewed','wheel.active','youtube.subscribed','instagram.followers','category.'])assert.ok(t.includes(s),s);
 assert.match(t,/SCOPE_PATTERN\.test\(scope\)/);
});
test('cinematic style stays under the shared UI stylesheet',()=>{
 assert.match(page,/className="pci-cinematic pci-explore-hero"/);
 assert.match(page,/className="pci-home-white"/);
 assert.match(entry,/premium-home\.css/);
 assert.ok(existsSync('packages/ui/src/styles/pci-reference-adaptation.css'));
 for(const f of ['src/app/page.tsx','src/components/PublishedWheel.tsx','src/components/PublishedRows.tsx','src/components/PublishedTop100.tsx','src/components/RankingTable.tsx']){
  assert.doesNotMatch(read(f),/style=\{/,f);assert.doesNotMatch(read(f),/<style\b/,f);
 }
});
test('updated-at display uses the snapshot component',()=>{assert.match(snapshot,/Last updated:/);});
