import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const page=read('src/app/page.tsx');
const unified=read('src/components/UnifiedCreatorExperience.tsx');
const legacyWheel=read('src/components/RankingWheel.tsx');
const snapshot=read('src/components/SnapshotStatus.tsx');
const entry=read('packages/ui/src/styles.css');
const premium=read('packages/ui/src/styles/premium-home.css');

test('hero uses three live raw metrics from the existing unified API',()=>{
 assert.match(page,/const metrics:Metric\[\]=\['views','subscribers','videos'\]/);
 assert.match(page,/\/api\/v1\/unified\/rankings\?metric=\$\{metric\}&platform=all&limit=100/);
 assert.match(page,/<UnifiedRankingWheel rankings=\{rankings\}\/>/);
 assert.match(unified,/href=\{`\/creators\/\$\{encodeURIComponent\(c.slug\)\}`\}/);
 assert.match(unified,/c\.rank===1/);
 // PCI_WHEEL_THREE_METRIC_TEST_V2
 assert.match(unified,/const wheelModes=displayModes/);
 assert.doesNotMatch(page,/unified\/all-rounders/);
 assert.doesNotMatch(page,/hardcodedCreators|mockCreators|fakeCreators/);
});

test('Top 100 receives server-fetched ranking data and keeps the legacy fallback',()=>{
 assert.match(page,/<UnifiedTop100 rankings=\{rankings\}\/>/);
 assert.match(page,/<CreatorTable creators=\{legacy\.subscribers\.filter\(c=>c\.rank!==null\)\.slice\(0,100\)\}\/>/);
 assert.match(page,/\/api\/v1\/rankings\?sort=\$\{metric\}&limit=100/);
 assert.match(unified,/const rows=\(platform==='all'\?rankings\[metric\]:remote\?\?\[\]\)\.slice\(0,100\)/);
 assert.match(unified,/encodeURIComponent\(c.slug\)/);
 assert.match(page,/<SnapshotStatus publishedAt=\{status\?\.data\.publishedAt\}\/>/);
 assert.match(snapshot,/Last updated:/);
});

test('cinematic style stays under the shared UI stylesheet',()=>{
 assert.match(page,/className="pci-cinematic pci-explore-hero"/);
 assert.match(page,/className="pci-home-white"/);
 assert.match(entry,/premium-home\.css/);
 assert.ok(existsSync('packages/ui/src/styles/pci-reference-adaptation.css'));
 for(const source of [page,unified,legacyWheel]){
  assert.doesNotMatch(source,/style=\{/);
  assert.doesNotMatch(source,/<style\b/);
 }
});

test('updated-at display uses the existing snapshot component',()=>{
 assert.match(page,/<SnapshotStatus publishedAt=/);
 assert.match(snapshot,/Last updated:/);
 assert.doesNotMatch(page,/placeholderViews|fabricatedMetrics/);
});
