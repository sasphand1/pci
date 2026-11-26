import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const view=read('../src/fifi/pages/creator-profile.tsx');
const css=read('../packages/ui/src/styles/creator-profile-pulse.css');
test('pulse carousel retains six recorded charts and eight KPI fields',()=>{
 const titles=['Follower Growth','Total tracked views','Daily view-gain rate','Views by video age','Tracked videos by view band','Creator comparison'];
 for(const title of titles)assert.ok(view.includes(`title:"${title}"`),title);
 assert.equal((view.match(/<KPI /g)||[]).length,8);
 for(const binding of ['growth.dailyTotals','growth.dailyRates','portfolio.age','portfolio.bands','subscriberRanges[days]','creatorAudience?.rows'])assert.ok(view.includes(binding),binding);
 assert.match(view,/<GraphSlides slides=\{graphs\}/);
});
test('carousel retains homepage cadence, interaction pause and source-point readout',()=>{
 assert.match(read('../src/fifi/components/pulse-slideshow.tsx'),/SLIDE_DWELL_MS = 4000/);
 assert.match(view,/GRAPH_SWISH_MS=620/);
 for(const control of ['Previous graph','Next graph','Pause slideshow','Graph slideshow positions','onPointerOver','onFocusCapture','prefers-reduced-motion'])assert.ok(view.includes(control),control);
 assert.match(css,/max-height:330px/);
 assert.match(read('../packages/ui/src/styles.css'),/creator-profile-pulse\.css/);
});

test('audience is outside carousel; compact comparison and formatted observations remain',()=>{
 const slides=view.slice(view.indexOf('const graphs:GraphSlide[]'),view.indexOf('return <main',view.indexOf('const graphs:GraphSlide[]')));
 assert.equal((slides.match(/\{title:"/g)||[]).length,6);
 assert.doesNotMatch(slides,/Audience by Platform/);
 assert.match(view,/className="cp-audience-compact"/);
 assert.match(view,/cp-point-tooltip/);
 assert.match(view,/onPointerDown=\{e=>inspect\(e.target\)\}/);
 assert.match(css,/cp-peer-compact \.yr-bar-row svg\{height:9px/);
});
