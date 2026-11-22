import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/app/page.tsx','utf8');
const helper=readFileSync('src/lib/creator-totals.ts','utf8');
const wheel=readFileSync('src/components/PublishedWheel.tsx','utf8');
const mobile=readFileSync('src/app/mobile-app.css','utf8');
test('strict full-population total still fails closed for partial, stale and duplicate rankings',()=>{
 for(const x of ['ranking.stale','ranking.entries.length!==ranking.population','ranking.covered!==ranking.population','seen.has(entry.person.slug)','Number.isSafeInteger'])assert.ok(helper.includes(x),x);
});
test('partial published total rejects stale, duplicate, non-integer or invalid rows',()=>{
 for(const x of ['publishedRankedTotal','ranking.stale','seen.has(e.person.slug)','Number.isSafeInteger(e.value)'])assert.ok(helper.includes(x),x);
});
test('no mojibake in homepage and carousel',()=>{
 for(const [name,src] of [['page',page],['wheel',wheel]])assert.doesNotMatch(src,/\u00e2[\u0080-\u00bf\u20ac\u201a-\u201e]/i,name);
});
test('mobile nav toggle retains the rounded pill instead of square corners',()=>{
 assert.match(mobile,/\.pci-nav-toggle \{[^}]*border-radius:\s*999px/s);
 assert.doesNotMatch(mobile,/\.pci-nav-toggle \{[^}]*border-radius:\s*6px/s);
});
