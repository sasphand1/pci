import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('satellite filter buttons use explicit shared Fifi utilities without local overrides',()=>{
 const s=read('../src/components/SatelliteDashboard.tsx'),css=read('../packages/ui/src/styles/satellite-reference.css');
 for(const token of ['filter-pill-active inline-flex h-10 items-center rounded-full border border-primary bg-primary','filter-pill inline-flex h-10 items-center rounded-full border border-border bg-card','text-primary-foreground','text-muted-foreground'])assert.ok(s.includes(token),token);
 assert.doesNotMatch(css,/\.pci-sat-(?:chips|mode|quick-links)\s+(?:button|svg)/);
 assert.match(s,/<div className=\{styles\.globeFrame\}><iframe ref=\{mapFrame\}/);
});

test('category navigation is outside the banner and uses the homepage ranking pill recipe',()=>{
 const s=read('../src/components/SatelliteDashboard.tsx'),home=read('../src/components/PublishedTop100.tsx'),css=read('../packages/ui/src/styles/satellite-reference.css');
 const banner=s.slice(s.indexOf('<header className="pci-sat-banner'),s.indexOf('</header>',s.indexOf('<header className="pci-sat-banner')));
 assert.doesNotMatch(banner,/Satellite categories/);
 const nav=s.match(/<nav[^>]*aria-label="Satellite categories"[^\n]*<\/nav>/)?.[0];
 assert.ok(nav);assert.ok(s.indexOf(nav)>s.indexOf('</header>',s.indexOf('<header className="pci-sat-banner')));assert.ok(s.indexOf(nav)<s.indexOf('<section id="pci-sat-earth"'));
 for(const token of ['shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition','border-primary bg-primary text-primary-foreground','border-border bg-card text-muted-foreground hover:text-foreground','mt-4 flex gap-2 overflow-x-auto pb-1']){assert.ok(home.includes(token));assert.ok(nav.includes(token));}
 assert.doesNotMatch(nav,/<Icon/);assert.doesNotMatch(css,/\.pci-sat-chips\b/);
 assert.ok(nav.includes('setNavChoice(id);setCategory(target);'));
});
