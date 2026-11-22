import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/app/page.tsx','utf8');
const helper=readFileSync('src/lib/creator-totals.ts','utf8');
const wheel=readFileSync('src/components/PublishedWheel.tsx','utf8');
const mobile=readFileSync('src/app/mobile-app.css','utf8');
test('homepage computes published totals instead of hardcoding N/A',()=>{
 assert.match(page,/publishedTotal\(fullRankings,'wheel\.subscribed'\)/);
 assert.match(page,/publishedTotal\(fullRankings,'wheel\.viewed'\)/);
 assert.match(page,/const fullRankings=top\.filter\(/);
 assert.match(page,/rankings\/\$\{scope\}\?limit=100/);
 assert.doesNotMatch(page,/publishedTotal\(wheel\?\.sorts/);
 assert.doesNotMatch(page,/label:'Total (subscribers|views)',value:'N\/A'/);
});
test('totals fail closed for partial, stale or duplicate rankings',()=>{
 for(const text of ['ranking.stale','ranking.entries.length!==ranking.population','ranking.covered!==ranking.population','seen.has(entry.person.slug)','Number.isSafeInteger']) assert.ok(helper.includes(text),text);
});
test('no mojibake in homepage and carousel',()=>{
 for(const [name,src] of [['page',page],['wheel',wheel]])assert.doesNotMatch(src,/\u00e2[\u0080-\u00bf\u20ac\u201a-\u201e]/i,name);
});
test('mobile nav toggle retains the rounded pill instead of square corners',()=>{
 assert.match(mobile,/\.pci-nav-toggle \{[^}]*border-radius:\s*999px/s);
 assert.doesNotMatch(mobile,/\.pci-nav-toggle \{[^}]*border-radius:\s*6px/s);
});
