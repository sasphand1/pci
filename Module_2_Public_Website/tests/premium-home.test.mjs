import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const page=readFileSync('src/app/page.tsx','utf8');
const table=readFileSync('src/components/HomeLeaderboard.tsx','utf8');
const wheel=readFileSync('src/components/RankingWheel.tsx','utf8');
const ui=readFileSync('packages/ui/src/styles/premium-home.css','utf8');
const snapshot=readFileSync('src/components/SnapshotStatus.tsx','utf8');
const entry=readFileSync('packages/ui/src/styles.css','utf8');
test('hero retains three live raw-metric rankings and profile links',()=>{
 assert.match(page,/\/api\/v1\/rankings\?sort=\$\{metric\}&limit=100/);
 assert.match(page,/metrics:SortMetric\[\]=\['views','subscribers','videos'\]/);
 assert.match(wheel,/href=\{`\/creators\/\$\{encodeURIComponent\(c.slug\)\}`\}/);
 assert.match(wheel,/rank===1&&/);
});
test('white leaderboard receives real ranking data and shows actual timestamps',()=>{
 assert.match(page,/<HomeLeaderboard creators=\{rankings.views\} asOf=\{updatedAt\}\/>/);
 assert.match(table,/\.filter\(c=>c.viewCount!==null\)\.slice\(0,10\)/);
 assert.match(table,/creator\.fetchedAt\?\?asOf/);
 assert.match(table,/encodeURIComponent\(creator.slug\)/);
 assert.match(ui,/\.pci-leaderboard-scroll\{background:white/);
});
test('image is local and site remains on one centralized stylesheet',()=>{
 assert.ok(existsSync('public/images/islamabad-dusk.webp'));
 assert.match(ui,/url\('\/images\/islamabad-dusk\.webp'\)/);
 assert.match(entry,/premium-home\.css/);
 for(const text of [page,wheel,table])assert.doesNotMatch(text,/style=\{/);
});
test('only the last updated label appears in data status',()=>{
 assert.match(snapshot,/Last updated:/);
 assert.doesNotMatch(snapshot,/YouTube Data API v3|Source:/);
 assert.match(wheel,/Last updated:/);
});
