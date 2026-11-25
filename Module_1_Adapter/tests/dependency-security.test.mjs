import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
const ver=v=>v.replace(/^[^\d]*/,'').split('.').map(Number);
const atLeast=(v,min)=>{const a=ver(v),b=ver(min);for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return true;};

// CVE-2023-54404: zod up to 4.6.5 can exhaust memory on huge arrays. Never downgrade below 4.6.6.
test('zod stays on a patched version (>= 4.6.6) in package.json and the lockfile',()=>{
 assert.ok(atLeast(pkg.dependencies.zod,'4.6.6'),`package.json zod ${pkg.dependencies.zod}`);
 assert.ok(atLeast(lock.packages['node_modules/zod'].version,'4.6.6'),`lockfile zod ${lock.packages['node_modules/zod'].version}`);
});
// Defence in depth: every array schema has an upper bound, and request bodies are size-limited.
test('every zod array schema has a .max() bound and JSON bodies are capped',()=>{
 const files=[];const walk=d=>{for(const f of readdirSync(d)){const p=join(d,f);statSync(p).isDirectory()?walk(p):/\.(ts|mjs)$/.test(f)&&files.push(p);}};walk(join(root,'src'));
 for(const f of files){const s=readFileSync(f,'utf8');if(!s.includes("from 'zod'"))continue;
  for(const m of s.matchAll(/z\.array\(/g)){const tail=s.slice(m.index,m.index+200).split(/[;\n]/)[0];assert.match(tail,/\.max\(/,`${f}: ${tail}`);}}
 assert.match(readFileSync(join(root,'src/server.ts'),'utf8'),/express\.json\(\{limit:'32kb'/);
});
