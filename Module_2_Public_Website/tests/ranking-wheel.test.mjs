import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const page=readFileSync('src/app/page.tsx','utf8');
const wheel=readFileSync('src/components/RankingWheel.tsx','utf8');
const css=readFileSync('packages/ui/src/styles/ranking-wheel.css','utf8');
const entry=readFileSync('packages/ui/src/styles.css','utf8');
test('wheel is homepage hero fed solely from existing ranking API',()=>{
 assert.match(page,/<RankingWheel /);
 assert.match(page,/\/api\/v1\/rankings\?sort=\$\{metric\}&limit=100/);
 assert.match(page,/\['views','subscribers','videos'\]/);
});
test('creator card always links to creator profile, no fabricated content',()=>{
 assert.match(wheel,/href=\{`\/creators\/\$\{encodeURIComponent\(c.slug\)\}`\}/);
 assert.doesNotMatch(wheel,/e\.preventDefault\(\);setSelected\(i\)/);
 assert.match(wheel,/if\(ignoreClick\.current\)e\.preventDefault\(\)/);
 assert.match(wheel,/safeYoutubeImage/);
});
test('wheel supports drag, touch, wheel, keyboard, arrows and reduced motion',()=>{
 for(const name of ['onPointerDown','onPointerMove','onPointerUp','onWheel','ArrowLeft','ArrowRight','Previous creator','Next creator'])assert.ok(wheel.includes(name),name);
 assert.match(css,/touch-action:pan-y/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('crown follows exact first rank by selected metric',()=>{
 assert.match(wheel,/rank===1&&/);
 assert.match(wheel,/data-rank-one=\{rank===1\}/);
 assert.match(wheel,/metric===m\.id/);
});
test('only centralized ui stylesheet holds visual rules',()=>{
 assert.match(entry,/ranking-wheel\.css/);
 assert.doesNotMatch(wheel,/style=\{/);
 assert.doesNotMatch(page,/style=\{/);
 assert.doesNotMatch(wheel,/<style\b/);
});
