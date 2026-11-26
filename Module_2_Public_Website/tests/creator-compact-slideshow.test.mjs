import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const view=readFileSync(new URL('../src/fifi/pages/creator-profile.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../packages/ui/src/styles/creator-profile.css',import.meta.url),'utf8');
test('one carousel inside dashboard with six real graph slides',()=>{
 assert.equal((view.match(/<GraphSlides slides=\{graphs\}\/>/g)||[]).length,1);
 assert.match(view,/className="cp-dashboard"><div className="cp-main-column">\s*<GraphSlides slides=\{graphs\}\/>/);
 const block=view.split('const graphs:GraphSlide[]=[')[1].split('];')[0];
 assert.equal((block.match(/\{title:"/g)||[]).length,6);
 assert.doesNotMatch(block,/Audience by Platform/);
 assert.match(view,/Audience by Platform/);
 assert.match(view,/SLIDE_DWELL_MS/);assert.match(view,/GRAPH_SWISH_MS=620/);assert.match(view,/inert=\{i!==pos\}/);
});
test('carousel physically clips inactive slides and preserves compact comparison',()=>{
 assert.match(css,/\.cp-graph-viewport\{[^}]*overflow:hidden/);
 assert.match(css,/\.cp-graph-track\{[^}]*display:flex/);
 assert.match(css,/\.cp-graph-panel\{[^}]*flex:0 0 100%/);
 assert.match(view,/cp-full-card cp-peer-compact/);
 assert.match(css,/\.cp-peer-compact \.yr-bar-row svg\{[^}]*height:6px/);
 assert.match(view,/metric<3\?<HorizontalBars/);assert.match(view,/metric===3\?<GroupedBars/);
});

