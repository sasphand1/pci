import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const layout=read('src/app/layout.tsx'),home=read('src/app/page.tsx'),detail=read('src/app/creators/[slug]/page.tsx');

test('root layout renders the Fifi header and footer once and loads the design styles',()=>{
 assert.match(layout,/import '\.\/fifi\.css'/);
 assert.equal((layout.match(/<SiteHeader\s*\/>/g)||[]).length,1);
 assert.equal((layout.match(/<SiteFooter\s*\/>/g)||[]).length,1);
 assert.doesNotMatch(layout,/style=\{/);
});
test('home page is built from published data only',()=>{
 for(const p of ["'/rows'","'/status'","'/categories'","/rankings/${scope}?limit=100"])assert.ok(home.includes(p),p);
 assert.match(home,/publishedRankedTotal\(fullRankings,'wheel\.subscribed'\)/);
 assert.match(home,/<HomePage\s/);
 assert.match(home,/<PublishedTop100 initial=\{initial\}/);
});
test('creator profile is fed by real analytics history and links accounts safely',()=>{
 assert.match(detail,/analytics/);
 assert.match(detail,/<CreatorProfilePage\s/);
});
test('events page keeps the real map and the real events API',()=>{
 const ev=read('src/app/events/page.tsx');
 assert.match(ev,/events-radar\.html/);
 assert.match(ev,/<EventsPage\s/);
});
