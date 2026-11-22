import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const head=read('src/components/SiteHeader.tsx');
const page=read('src/app/page.tsx');
const rows=read('src/components/PublishedRows.tsx');
const css=read('packages/ui/src/styles/sleek-rails.css');
const entry=read('packages/ui/src/styles.css');

test('compact navigation keeps the homepage and rankings accessible',()=>{
 assert.match(head,/label:'Explore'/);assert.match(head,/label:'Top 100'/);assert.match(head,/label:'Live Wall'/);
 assert.match(page,/id="top-100"/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
});
test('platform and category rows come from published rankings and link to profiles',()=>{
 assert.match(page,/<PublishedRows platforms=\{rows\?\.platforms\?\?\[\]\} categories=\{rows\?\.categories\?\?\[\]\}\/>/);
 assert.match(rows,/safeYoutubeImage\(e\.person\.avatarUrl\)/);
 assert.match(rows,/href=\{`\/creators\/\$\{encodeURIComponent\(e\.person\.slug\)\}`\}/);
 assert.match(rows,/scrollBy\(/);
 assert.match(rows,/categories\.map\(r=><Rail/);
});
test('styling stays central',()=>{
 assert.match(entry,/sleek-rails\.css/);
 for(const s of [head,page,rows]){assert.doesNotMatch(s,/style=\{/);assert.doesNotMatch(s,/<style\b/);}
 assert.ok(existsSync('public/images/islamabad-dusk.webp'));
});
