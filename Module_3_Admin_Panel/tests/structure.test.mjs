import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('.');
const read=(p)=>readFileSync(join(root,p),'utf8');
function collect(dir){return readdirSync(join(root,dir),{withFileTypes:true}).flatMap(x=>x.isDirectory()?collect(join(dir,x.name)):[join(dir,x.name)]);}
const source=collect('src').filter(x=>/\.tsx?$/.test(x));
test('all management screens are present',()=>{
 for(const route of ['','creators','categories','sync','rankings','videos','wall','content','admins','system','settings','audit','security'])
  assert.ok(existsSync(join(root,'src/app',route,'page.tsx')),`missing ${route||'dashboard'}`);
});
test('shared design package is singular and owned by Module 2',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.equal(pkg.dependencies['@pci/ui'],'file:../Module_2_Public_Website/packages/ui');
 assert.ok(!existsSync(join(root,'packages/ui')),'Do not duplicate shared UI');
 assert.match(read('src/app/layout.tsx'),/import '@pci\/ui\/styles\.css'/);
});
test('no inline CSS, CSS-in-JS, or embedded style tags in administrative source',()=>{
 for(const file of source){const s=read(file);assert.doesNotMatch(s,/(?:<style\b|\bstyle\s*=|styled\.|css`|dangerouslySetInnerHTML)/,`inline styling in ${file}`)}
});
test('no direct database, Redis or YouTube connector usage',()=>{
 for(const file of source){const s=read(file);assert.doesNotMatch(s,/(?:pg\b|ioredis|youtube\.googleapis\.com|fetch\(\s*['"]https:\/\/www\.googleapis\.com)/i,`forbidden backend access ${file}`);}
});
test('admin calls send cookies and CSRF on state changes',()=>{
 const s=read('src/lib/api.ts');assert.match(s,/credentials:'include'/);assert.match(s,/X-CSRF-Token/);assert.match(s,/cache:'no-store'/);assert.match(s,/AbortController/);
});
test('backend admin uses HttpOnly cookie, server roles and MFA',()=>{
 const backend=join(root,'../Module_1_Adapter/src/modules/auth/auth.ts');
 if(!existsSync(backend))return;
 const s=readFileSync(backend,'utf8');assert.match(s,/httpOnly:true/);assert.match(s,/validTotp/);assert.match(s,/roles\(/);assert.match(s,/csrf/);
});
test('no admin secrets stored in local storage',()=>{
 for(const file of source){assert.doesNotMatch(read(file),/localStorage|sessionStorage/,`browser storage for admin secrets: ${file}`)}
});
test('each destructive action has authorization, confirmation or explicit operation',()=>{
 const s=read('src/app/wall/page.tsx')+read('src/app/admins/page.tsx')+read('src/app/creators/page.tsx');
 assert.match(s,/window\.confirm/);assert.match(s,/csrf/);
});
test('role-based navigation includes all three administrator roles',()=>{
 const s=read('src/lib/nav.ts');for(const role of ['owner','editor','moderator'])assert.ok(s.includes(`'${role}'`));
});
test('ranking is raw-metric only and no user-facing ML score',()=>{
 const s=read('src/app/rankings/page.tsx');for(const metric of ['subscribers','views','videos'])assert.ok(s.includes(metric));assert.doesNotMatch(s,/Bayesian Score|Influence Score|Creator Momentum Score/);
});
test('advertised backend admin endpoint paths are present in Module 1 source',()=>{
 const backend=join(root,'../Module_1_Adapter/src/modules/admin/routes.ts');if(!existsSync(backend))return;
 const s=readFileSync(backend,'utf8');for(const p of ['/dashboard','/creators','/categories','/sync-runs','/ranking-preview','/videos','/wall/reports','/wall/messages','/wall/bans','/admins','/admin-password','/system-health','/settings','/audit-logs'])assert.ok(s.includes(`'${p}'`),`missing ${p}`);
});
test('Docker admin builds from sibling shared UI and uses separate port 3001',()=>{
 assert.match(read('Dockerfile'),/Module_2_Public_Website\/packages\/ui/);assert.match(read('compose.yaml'),/3001:3001/);assert.match(read('package.json'),/next dev -p 3001/);
});
