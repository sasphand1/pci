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
 assert.match(head,/label:'Home'/);assert.match(head,/label:'Events'/);assert.doesNotMatch(head,/label:'(?:Rankings|Creators)'/);
 assert.match(page,/id="top-100"/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
});
test('styling stays central',()=>{
 assert.match(entry,/sleek-rails\.css/);
 for(const s of [head,page,rows]){assert.doesNotMatch(s,/style=\{/);assert.doesNotMatch(s,/<style\b/);}
 assert.ok(existsSync('public/images/islamabad-dusk.webp'));
});
