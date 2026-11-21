import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const wheel=readFileSync('src/components/PublishedWheel.tsx','utf8');
const css=readFileSync('packages/ui/src/styles/ranking-wheel.css','utf8');
const entry=readFileSync('packages/ui/src/styles.css','utf8');
test('wheel shows the published sorts and links every card to a profile',()=>{
 assert.match(wheel,/sorts\.map\(\(s,i\)=>/);
 assert.match(wheel,/href=\{`\/creators\/\$\{encodeURIComponent\(c\.person\.slug\)\}`\}/);
 assert.match(wheel,/if\s*\(\s*ignore\.current\s*\)\s*e\.preventDefault\(\)/);
 assert.match(wheel,/safeYoutubeImage/);
});
test('wheel supports drag, touch, wheel, keyboard and arrows',()=>{
 for(const name of ['onPointerDown','onPointerUp','onWheel','ArrowLeft','ArrowRight','Previous creator','Next creator'])assert.ok(wheel.includes(name),name);
 assert.match(css,/touch-action:pan-y/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
test('the crown goes to rank one of the chosen sort and says so when tied',()=>{
 assert.match(wheel,/slot===0\s*&&\s*c\.rank===1/);
 assert.match(wheel,/className="stage-crown"/);
 assert.match(wheel,/c\.rank===1/);
});
test('the wheel never claims unique people or invents numbers',()=>{
 assert.match(wheel,/formatCount\(c.value,true\)/);
 assert.doesNotMatch(wheel,/Math\.random|fakeCreators|mockCreators/);
});
test('only the shared stylesheet holds visual rules',()=>{
 assert.match(entry,/ranking-wheel\.css/);
 assert.doesNotMatch(wheel,/style=\{/);assert.doesNotMatch(wheel,/<style\b/);
});
