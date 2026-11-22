import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const head=read('src/components/SiteHeader.tsx');
const page=read('src/app/page.tsx');
const discovery=read('src/components/CreatorDiscoveryRows.tsx');
const unified=read('src/components/UnifiedCreatorExperience.tsx');
const css=read('packages/ui/src/styles/sleek-rails.css');
const entry=read('packages/ui/src/styles.css');

test('compact navigation keeps the homepage and rankings accessible',()=>{
 assert.match(head,/label:'Explore'/);
 assert.match(head,/label:'Top 100'/);
 assert.match(head,/label:'Live Wall'/);
 assert.match(page,/id="top-100"/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
});

test('discovery categories and platform rails use real unified API results',()=>{
 assert.match(page,/<CreatorDiscoveryRows categories=\{categories\?\.data\?\?\[\]\} youtube=\{platformYoutube\?\.data\?\?\[\]\} instagram=\{platformInstagram\?\.data\?\?\[\]\} curatedYoutube=\{curatedYoutube\?\.data\?\?\[\]\}\/>/);
 assert.match(page,/\/api\/v1\/categories/);
 assert.match(page,/\/api\/v1\/unified\/rankings\?metric=subscribers&platform=youtube&limit=100/);
 assert.match(page,/\/api\/v1\/unified\/rankings\?metric=subscribers&platform=instagram&limit=100/);
 assert.match(discovery,/p\.categories/);
 assert.match(discovery,/safeYoutubeImage\(p\.thumbnailUrl\)/);
 assert.match(discovery,/href=\{`\/creators\/\$\{encodeURIComponent\(p.slug\)\}`\}/);
 assert.match(discovery,/scrollBy\(/);
});

test('unified leaderboard and wheel remain with centralized styling and no mock people',()=>{
 assert.match(page,/<UnifiedRankingWheel rankings=\{rankings\}\/>/);
 assert.match(page,/<UnifiedTop100 rankings=\{rankings\}\/>/);
 assert.match(page,/<RankingWheel rankings=\{legacy\} asOf=/);
 assert.match(unified,/href=\{`\/creators\/\$\{encodeURIComponent\(c.slug\)\}`\}/);
 assert.match(entry,/sleek-rails\.css/);
 for(const source of [head,page,discovery,unified]){
  assert.doesNotMatch(source,/style=\{/);
  assert.doesNotMatch(source,/<style\b/);
 }
 assert.ok(existsSync('public/images/islamabad-dusk.webp'));
});
