import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const view=read('../src/fifi/pages/youtube-reference.tsx');
const css=read('../packages/ui/src/styles/creator-youtube.css');
test('creator profile uses the root site header and footer instead of duplicate local chrome',()=>{
 const root=read('../src/app/layout.tsx');
 assert.match(root,/<SiteHeader\/>/);assert.match(root,/<SiteFooter\/>/);
 assert.doesNotMatch(view,/<header\b|<footer\b|yr-masthead/);
 assert.doesNotMatch(css,/body:has\(\.pci-yt-reference\)[^{]*\{[^}]*display\s*:\s*none/);
 assert.match(view,/data-creator-template="fifi-shared-v1"/);
});
test('creator profile uses the actual homepage container and shared card and button classes',()=>{
 const home=read('../src/fifi/pages/home.tsx'),theme=read('../src/app/fifi.css');
 const shared='rounded-2xl border border-border/70 bg-card p-5 shadow-soft';
 assert.ok(home.includes(shared));assert.ok(view.includes(shared));
 assert.match(home,/className="page-main pb-10 pt-5"/);assert.match(view,/className="page-main pb-10 pt-5 pci-yt-reference fifi-creator-template"/);
 assert.match(theme,/\.fifi \.page-main/);assert.match(theme,/\.fifi \.filter-pill/);
 assert.match(view,/filter-pill filter-pill-active/);assert.match(css,/--yr-green:var\(--primary\)/);
});
test('all eight KPI labels, four charts, comparison tabs, provenance, six footnotes and source attribution remain',()=>{
 for(const label of ['Subscribers','Lifetime views','Public videos','Average daily views gained','Tracked views','Top-video share','Top-five share','Median video views','Total tracked views','Daily view-gain rate','Views by video age','Tracked videos by view band','Creator comparison','Video view bands','Source-backed observations','Source: PCI Hub / Creators Bucket'])assert.ok(view.includes(label),label);
 assert.equal((view.match(/<MetricCard /g)||[]).length,8);assert.equal((view.match(/<ChartCard /g)||[]).length,4);
 for(const section of ['overview','growth','insights','comparison','provenance','sample-notes'])assert.ok(view.includes(`id="${section}"`));
 for(let i=1;i<=6;i++)assert.ok(view.includes(`id="note-${i}"`));
});
