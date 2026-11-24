import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('Data Hub is in the navigation for owner and editor',()=>assert.match(read('../src/lib/nav.ts'),/Data Hub',href:'\/hub'.*roles:\['owner','editor'\]/));
test('Data Hub page reads the hub routes through the validated api client',()=>{
 const p=read('../src/app/hub/page.tsx');
 for(const r of ['/admin/ingest/health','/admin/ingest/coverage','/admin/ingest/discrepancies','/admin/ingest/check','/admin/ingest/sources/','/admin/pipeline/alerts/'])assert.ok(p.includes(r),r);
 assert.match(p,/csrf/);assert.match(p,/RoleGate roles=\{\['owner','editor'\]\}/);
 assert.doesNotMatch(p,/style\s*=|dangerouslySetInnerHTML/);
});
test('only the owner sees the kill switch and enabling asks for confirmation',()=>{
 const p=read('../src/app/hub/page.tsx');assert.match(p,/switchable&&owner/);assert.match(p,/window\.confirm/);
});
test('Data Hub shows picture coverage and can trigger the web picture fill',()=>{
 const p=read('../src/app/hub/page.tsx');assert.match(p,/With picture/);assert.ok(p.includes('/admin/ingest/instagram/avatars/fill'));assert.match(p,/withPicture/);
});
