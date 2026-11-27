import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve('.');const read=p=>readFileSync(join(root,p),'utf8');
test('Progress sits under Overview for every role',()=>{
 assert.match(read('src/lib/nav.ts'),/title:'Overview',href:'\/',icon:'overview',roles:\['owner','editor','moderator'\]\},\{title:'Progress',href:'\/progress',icon:'progress',roles:\['owner','editor','moderator'\]\}/);
 assert.ok(existsSync(join(root,'src/app/progress/page.tsx')));
});
test('every listed project has a board and a status file',()=>{
 const {projects}=JSON.parse(read('public/progress-board/projects.json'));
 assert.ok(projects.length>0);
 for(const p of projects){assert.match(p.slug,/^[a-z0-9-]{2,60}$/);
  for(const f of ['index.html','status.json'])assert.ok(existsSync(join(root,'public/progress-board',p.slug,f)),`${p.slug}/${f}`);
  const s=JSON.parse(read(`public/progress-board/${p.slug}/status.json`));assert.equal(typeof s.items,'object');}
});
test('boards may be framed by the panel only, and are never indexed',()=>{
 const c=read('next.config.ts');
 assert.match(c,/source:'\/progress-board\/:path\*'/);assert.match(c,/X-Frame-Options',value:'SAMEORIGIN'/);
 assert.match(c,/frame-ancestors 'self'/);assert.match(c,/X-Robots-Tag',value:'noindex, nofollow'/);
 assert.match(read('src/app/progress/page.tsx'),/index\.html\?view=1/);
});
test('progress styles are centralized',()=>{
 assert.equal((read('vendor/pci-ui/src/styles.css').match(/styles\/progress\.css/g)||[]).length,1);
 assert.doesNotMatch(read('src/app/progress/page.tsx'),/\bstyle\s*=|<style\b|localStorage|dangerouslySetInnerHTML/);
});
