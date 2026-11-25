import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const read=p=>readFileSync(p,'utf8');
function scan(dir){const out=[];for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...scan(p));else if(/\.(tsx?|mjs)$/.test(e.name))out.push(p);}return out;}
// Only code the site can actually reach is checked, so retired components that are still on disk do not matter.
function resolve(spec){for(const ext of ['.tsx','.ts','.mjs','/index.tsx','/index.ts']){const p=join('src',spec.slice(2)+ext);try{readFileSync(p);return p;}catch{/* next */}}return null;}
const seen=new Set(scan('src/app'));const queue=[...seen];
while(queue.length){const p=queue.pop();for(const m of read(p).matchAll(/from\s*'(@\/[^']+)'/g)){const r=resolve(m[1]);if(r&&!seen.has(r)){seen.add(r);queue.push(r);}}}
const sources=[...seen].map(p=>[p,read(p)]);
test('the check really reaches the components the home page uses',()=>{for(const f of ['src/lib/public.ts','src/fifi/lib/real.ts'])assert.ok([...seen].some(p=>p.replaceAll('\\','/')===f),f);});

test('no page or component calls an old ranking endpoint',()=>{
 for(const [p,s] of sources)assert.doesNotMatch(s,/api\/v1\/(unified|creators|rankings|overview|instagram|cross-platform)/,p);
});
test('every data call goes to the public API, the site settings or the wall',()=>{
 for(const [p,s] of sources){for(const m of s.matchAll(/\/api\/v1\/([a-z-]+)/g))assert.ok(['public','site-config','satellite'].includes(m[1]),`${p}: ${m[0]}`);}
});
test('pages read published data through the public helpers',()=>{
 for(const f of ['src/app/rankings/page.tsx','src/app/categories/page.tsx','src/app/categories/[slug]/page.tsx','src/app/creators/page.tsx','src/app/creators/[slug]/page.tsx'])assert.match(read(f),/pubGet|pubList|pubCreatorIndex/,f);
});
test('the old video pages redirect instead of showing stale lists',()=>assert.match(read('src/app/videos/page.tsx'),/redirect\('\/creators'\)/));
test('profile pages say numbers older than 7 days are not shown as zero',()=>{
 assert.match(read('src/fifi/pages/creator-profile.tsx'),/older than 7 days/);
 assert.match(read('src/app/methodology/page.tsx'),/never zero/);
});
test('external account links open safely',()=>{
 for(const f of ['src/components/RankingTable.tsx','src/fifi/pages/creator-profile.tsx'])assert.match(read(f),/rel="noopener noreferrer"/,f);
});
test('pictures are only shown from known image hosts',()=>{
 for(const f of ['src/components/RankingTable.tsx','src/components/PublishedWheel.tsx','src/components/PublishedRows.tsx'])assert.match(read(f),/safeCreatorImage/,f);
});
test('the methodology page describes the real rules',()=>{
 const m=read('src/app/methodology/page.tsx');
 for(const t of ['Most Subscribed','Most Viewed','Most Active','7 days','not unique people','09:00'])assert.ok(m.includes(t),t);
 assert.doesNotMatch(m,/50 retrievable public uploads|sort by subscribers/);
});
