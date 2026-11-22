import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('pages with sign-in forms or user messages are kept out of search',()=>{
 assert.match(read('src/app/wall/page.tsx'),/robots:\{index:false,follow:false\}/);
 assert.match(read('src/app/account/page.tsx'),/robots:\{index:false,follow:false\}/);
 assert.doesNotMatch(read('src/app/sitemap.ts'),/'wall'/);
 const r=read('src/app/robots.ts');for(const p of ['/api/','/admin/'])assert.ok(r.includes(`'${p}'`),p);
 assert.doesNotMatch(r, /disallow:[^\n]*'\/account'/, 'Allow Google to read the account noindex');
 assert.doesNotMatch(r, /disallow:[^\n]*'\/wall'/, 'Allow Google to read the wall noindex');
 for (const path of ['/verify-email','/reset-password']) assert.doesNotMatch(r, new RegExp('disallow:[^\\n]*'+path), 'Let Google read noindex for '+path);
 const c=read('next.config.ts');assert.match(c,/account\|wall\|verify-email\|reset-password/);assert.match(c,/X-Robots-Tag/);assert.match(c,/Strict-Transport-Security/);
});
test('no script injection sinks in the public site',()=>{
 for(const f of ['src/components/WallRoom.tsx','src/components/AccountControls.tsx','src/app/layout.tsx']){const s=read(f);assert.doesNotMatch(s,/dangerouslySetInnerHTML|eval\(|document\.write|innerHTML/,f);}
});

test('the same-origin map iframes are allowed and the static copies stay out of search',()=>{
 const c=read('next.config.ts');
 assert.match(c,/X-Frame-Options',value:'SAMEORIGIN'/,'DENY would blank the /events and /satellite map frames');
 assert.doesNotMatch(c,/X-Frame-Options',value:'DENY'/);
 assert.match(c,/geolocation=\(self\)/);
 assert.match(c,/events-radar\.html\|satellite-map\.html/);
 assert.match(c,/source:'\/events\.html',destination:'\/events',permanent:true/);
});
test('no instant meta-refresh or script redirect pages ship in /public',async()=>{
 const {readdirSync,existsSync}=await import('node:fs');
 assert.equal(existsSync(new URL('../public/events.html',import.meta.url)),false);
 for(const f of readdirSync(new URL('../public/',import.meta.url)).filter(n=>n.endsWith('.html')))assert.doesNotMatch(read('public/'+f),/http-equiv="refresh"/i,f);
 const radar=read('public/events-radar.html');
 const next=read('next.config.ts');assert.match(next,/events-radar\.html\|satellite-map\.html/);
 assert.doesNotMatch(radar,/location\.replace\(\s*['"]\/events/,'An embedded map must not script-redirect top-level visitors');
});
test('hero artwork is a compact webp',async()=>{
 const {statSync}=await import('node:fs');
 assert.ok(statSync(new URL('../public/images/hero-stage.webp',import.meta.url)).size<400000);
});
