import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('pages with sign-in forms or user messages are kept out of search',()=>{
 assert.match(read('src/app/wall/page.tsx'),/robots:\{index:false,follow:false\}/);
 assert.match(read('src/app/account/page.tsx'),/robots:\{index:false,follow:false\}/);
 assert.doesNotMatch(read('src/app/sitemap.ts'),/'wall'/);
 const r=read('src/app/robots.ts');for(const p of ['/account','/api/','/verify-email','/reset-password'])assert.ok(r.includes(`'${p}'`),p);
 const c=read('next.config.ts');assert.match(c,/account\|wall\|verify-email\|reset-password/);assert.match(c,/X-Robots-Tag/);assert.match(c,/Strict-Transport-Security/);
});
test('no script injection sinks in the public site',()=>{
 for(const f of ['src/components/WallRoom.tsx','src/components/AccountControls.tsx','src/app/layout.tsx']){const s=read(f);assert.doesNotMatch(s,/dangerouslySetInnerHTML|eval\(|document\.write|innerHTML/,f);}
});
