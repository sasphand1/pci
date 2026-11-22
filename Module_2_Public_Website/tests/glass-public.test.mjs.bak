import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const css=read('src/app/public-glass.css'),page=read('src/app/page.tsx'),layout=read('src/app/layout.tsx');
const lum=h=>{const c=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];};
const ratio=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
const token=n=>css.match(new RegExp(`--${n}:(#[0-9A-Fa-f]{6})`))[1];

test('glass sheet loads after the shared UI sheet and the landing stage is on the home page',()=>{
 assert.ok(layout.indexOf("@pci/ui/styles.css")<layout.indexOf("./public-glass.css"));
 assert.ok(layout.indexOf("./public-glass.css")<layout.indexOf("./public-stage.css"));
 const stage=read('src/app/public-stage.css');
 assert.match(stage,/\.stage-art\{[^}]*url\('\/images\/hero-stage\.webp'\)/);
 assert.match(page,/<PublishedWheel sorts=\{wheel\?\.sorts\?\?\[\]\} stats=\{stats\}\/>/);
 assert.doesNotMatch(page,/style=\{/);
});
test('one width: container, header, wheel footnote and Discover share the same edges',()=>{
 assert.match(css,/\.site-shell \.container\{width:var\(--pci-wrap\)/);
 assert.match(page,/id="discover" className="container"/,'Discover rows sit inside the container (they used to run to the screen edge)');
});
test('compact Microsoft-style scale',()=>{
 assert.match(css,/body\{font-family:[^;]*Segoe UI[^;]*;font-size:14px/);
 assert.match(css,/\.site-shell \.btn\{min-height:32px/);
 assert.match(css,/\.site-shell h1\{font-size:clamp\(1\.6rem,2\.6vw,2rem\)/);
 assert.ok(!/fonts\.googleapis|@import url/.test(css),'no external fonts');
});
test('text and button colours are readable on the frost background',()=>{
 for(const [fg,bg] of [['ink','#FBF4EC'],['ink-soft','#FBF4EC'],['ink-muted','#FBF4EC'],['glass-indigo-deep','#FFFFFF'],['glass-aqua-deep','#FFFFFF']])assert.ok(ratio(token(fg),bg)>=4.5,`${fg} on ${bg}`);
 for(const bg of ['glass-indigo','glass-aqua-deep'])assert.ok(ratio('#FFFFFF',token(bg))>=4.5,`white on ${bg}`);
});
test('narrow screens: the stage cannot widen the page',()=>{assert.match(read('src/app/public-stage.css'),/\.pci-stage\{[^}]*overflow:hidden/);});

test('rail tiles are fully styled here, not left to an unimported file', async()=>{
 const css=(await import('node:fs')).readFileSync(new URL('../src/app/public-glass.css',import.meta.url),'utf8');
 for(const must of ['.pci-platform-tile{display:flex;flex-direction:column','width:80px;height:80px','border-radius:50%','.pci-platform-number{','.pci-platform-number{'])assert.ok(css.includes(must),must);
});
test('wheel moves one card per gesture with a pause',async()=>{
 const src=(await import('node:fs')).readFileSync(new URL('../src/components/PublishedWheel.tsx',import.meta.url),'utf8');
 assert.match(src,/WHEEL_GAP_MS=550/);assert.match(src,/WHEEL_STEP/);assert.match(src,/stage-rank/);
});

test('stage follows the mockup: 8 slots (4 left, 3 right), crown only on #1, honest stats',()=>{
 const w=read('src/components/PublishedWheel.tsx'),stage=read('src/app/public-stage.css');
 for(const [slot,step] of [[-4,6],[-3,4],[-2,3],[-1,1],[0,0],[1,2],[2,5],[3,7]])assert.ok(w.includes(`{slot:${slot},step:${step}}`),`slot ${slot}`);
 assert.match(w,/slot===0&&c\.rank===1&&/);
 assert.doesNotMatch(page,/1\.2B|120B|500\+|320\+|180\+/,'no invented figures');
 assert.match(stage,/\.stage-card\[data-center=true\]/);
 assert.match(stage,/@media\(max-width:900px\)/);
});
test('rest of the page is light beige with a pink tinge, not dark',()=>{
 assert.match(css,/#FBF4EC/);assert.match(css,/#F8E9E4/);
 assert.doesNotMatch(css,/#EEF2FF|#E7FAF7/);
});
