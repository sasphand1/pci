import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const head=read('src/components/SiteHeader.tsx');
const page=read('src/app/page.tsx');
const rails=read('src/components/CategoryRails.tsx');
const css=read('packages/ui/src/styles/sleek-rails.css');
const entry=read('packages/ui/src/styles.css');
test('only three centered public navigation destinations',()=>{
 assert.match(head,/label:'Explore'/);assert.match(head,/label:'Top 100'/);assert.match(head,/label:'Live Wall'/);
 for(const name of ["label:'Videos'","label:'Compare'","label:'Account'","label:'Categories'"])assert.ok(!head.includes(name),name);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
 assert.match(page,/id="top-100"/);
});
test('category rails are client-side, based on real API creator and category data',()=>{
 assert.match(page,/<CategoryRails categories=\{categories\?\.data\?\?\[\]\} creators=\{uniqueCreators\}\/>/);
 assert.match(rails,/c\.categories\?\.some/);
 assert.match(rails,/safeYoutubeImage\(creator\.thumbnailUrl\)/);
 assert.match(rails,/href=\{`\/creators\/\$\{encodeURIComponent\(creator\.slug\)\}`\}/);
 assert.match(rails,/\.scrollBy\(/);
 assert.match(rails,/INITIAL_RAILS=3/);
});
test('white leaderboard and existing wheel remain; no inline styles or fake creator data',()=>{
 assert.match(page,/<RankingWheel rankings=\{rankings\} asOf=\{updatedAt\}\/>/);
 assert.match(page,/<HomeLeaderboard creators=\{rankings.views\} asOf=\{updatedAt\}\/>/);
 assert.match(css,/Airy white table/);
 assert.match(entry,/sleek-rails\.css/);
 for(const source of [head,page,rails]){assert.doesNotMatch(source,/style=\{/);assert.doesNotMatch(source,/<style\b/);}
 assert.ok(existsSync('public/images/islamabad-dusk.webp'));
});
