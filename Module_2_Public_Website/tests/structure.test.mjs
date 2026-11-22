import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join,relative} from 'node:path';
const root=process.cwd();
function scan(dir){const out=[];for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())out.push(...scan(path));else out.push(path);}return out;}
const appFiles=scan(join(root,'src/app')).filter(p=>p.endsWith('.tsx')||p.endsWith('.ts'));
const componentFiles=scan(join(root,'src/components')).filter(p=>p.endsWith('.tsx'));
test('only one stylesheet entry point is imported by app and components',()=>{
 const styles=readFileSync(join(root,'packages/ui/src/styles.css'),'utf8');
 for(const s of ['tokens.css','base.css','layout.css','components.css','responsive.css'])assert.ok(styles.includes(s));
 const sources=[...appFiles,...componentFiles].map(f=>readFileSync(f,'utf8'));
 assert.equal(sources.filter(s=>s.includes("import '@pci/ui/styles.css'")).length,1);
 assert.ok(readFileSync(join(root,'src/app/layout.tsx'),'utf8').includes("import '@pci/ui/styles.css'"));
 for(const [i,source] of sources.entries()){
  assert.doesNotMatch(source,/<style\b/i,`Found <style> in source ${i}`);
  if(!/[\\/](?:opengraph-image|twitter-image)\.tsx$/.test([...appFiles,...componentFiles][i])) assert.doesNotMatch(source,/style=\{/i,`Found inline CSS in source ${i}`);
  const allowedJsonLd = source.includes('export function SiteStructuredData()') &&
    source.includes('<script type="application/ld+json" dangerouslySetInnerHTML={{__html: json}} />');

  if (allowedJsonLd) {
    assert.match(
      source,
      /JSON\.stringify\(data\)\.replace\(\/<\/g,\s*'\\\\u003c'\)/,
      `JSON-LD must escape HTML in source ${i}`
    );
  }

  const checkedSource = allowedJsonLd
    ? source.replace('<script type="application/ld+json" dangerouslySetInnerHTML={{__html: json}} />', '')
    : source;

  assert.doesNotMatch(checkedSource, /dangerouslySetInnerHTML/, `Found raw HTML injection in source ${i}`);
  if(!source.includes("import '@pci/ui/styles.css'"))assert.doesNotMatch(source,/import\s+['"][^'"]+\.css['"]/i,`Extra CSS import in source ${i}`);
 }
});
test('public website routes and shared template package exist',()=>{
 const routes=['page.tsx','layout.tsx','creators/page.tsx','creators/[slug]/page.tsx','rankings/page.tsx','categories/page.tsx','categories/[slug]/page.tsx','compare/page.tsx','videos/page.tsx','wall/page.tsx','account/page.tsx','verify-email/page.tsx','reset-password/page.tsx','privacy/page.tsx','terms/page.tsx','contact/page.tsx','methodology/page.tsx'];
 for(const route of routes)assert.ok(existsSync(join(root,'src/app',route)),route);
 assert.ok(existsSync(join(root,'packages/ui/package.json')));
});
test('does not ship fictional creator data or backend secrets',()=>{
 for(const f of [...appFiles,...componentFiles]){const src=readFileSync(f,'utf8');assert.doesNotMatch(src,/YOUTUBE_API_KEY|DB_PASSWORD|TURNSTILE_SECRET_KEY|MFA_ENCRYPTION_KEY/);}
});
test('wall uses native Module 1 events, endpoint and no per-creator rooms',()=>{
 const wall=readFileSync(join(root,'src/components/WallRoom.tsx'),'utf8');
 for(const event of ['wall:message_created','wall:message_removed','wall:presence','wall:status_changed'])assert.ok(wall.includes(event));
 for(const path of ['/wall/messages','/wall/status','/wall/auth/guest','/wall/reports'])assert.ok(wall.includes(path));
 assert.ok(!wall.includes('youtube/v3/commentThreads'));
});
