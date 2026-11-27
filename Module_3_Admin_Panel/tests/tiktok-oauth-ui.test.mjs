import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('TikTok OAuth callback uses the established admin API and clears authorization parameters',()=>{
 const page=read('../src/app/tiktok/callback/page.tsx');
 assert.match(page,/useAuth\(\)/);assert.match(page,/\/admin\/tiktok\/oauth\/exchange/);assert.match(page,/csrf:identity\.csrfToken/);assert.match(page,/replaceState\(null,'','\/tiktok\/callback'\)/);assert.match(page,/href="\/bucket"/);assert.doesNotMatch(page,/localStorage|sessionStorage|style=|access_token|refresh_token/);
});
test('Only a minimal callback is added, authorization is in the existing People page',()=>{
 assert.equal(existsSync(new URL('../src/app/tiktok/page.tsx',import.meta.url)),false);
 const page=read('../src/app/bucket/page.tsx');assert.match(page,/\/admin\/tiktok\/oauth\/start/);assert.match(page,/\/admin\/tiktok\/oauth\/disconnect/);assert.match(page,/window\.location\.assign/);assert.doesNotMatch(page,/localStorage|sessionStorage|style=/);
});
