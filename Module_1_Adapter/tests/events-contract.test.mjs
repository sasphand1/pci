import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('database is approval-gated and sources default disabled',()=>{
 const sql=read('Module_1_Adapter/database/migrations/097_events.sql');
 assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
 assert.match(sql,/official_confirmed boolean NOT NULL DEFAULT false/);
 assert.match(sql,/rights_confirmed boolean NOT NULL DEFAULT false/);
 assert.match(sql,/approved boolean NOT NULL DEFAULT false/);
 assert.match(sql,/UNIQUE\(source_id,external_id\)/);
});
test('public route only returns approved sources and future events',()=>{
 const r=read('Module_1_Adapter/src/modules/events/routes.ts');
 assert.match(r,/e\.approved=true AND e\.active=true AND e\.deleted_at IS NULL AND e\.start_at>=now\(\)/);
 assert.match(r,/s\.enabled=true AND s\.official_confirmed=true AND s\.rights_confirmed=true/);
 assert.match(r,/requireAdmin,roles\('owner','editor'\)/);
 assert.match(r,/roles\('owner'\)/);
 assert.match(r,/COORDINATES_REQUIRED/);
});
test('server keeps source metadata in database, not client secrets',()=>{
 const r=read('Module_1_Adapter/src/modules/events/fetch.ts');
 assert.match(r,/isPublicIPv4/);assert.match(r,/method:'GET'/);assert.match(r,/lookup:/);
 assert.doesNotMatch(r,/rejectUnauthorized:false/);
});
test('PCI map preserves glows and contains Waze + verified event integration',()=>{
 const html=read('Module_2_Public_Website/public/events-radar.html');
 assert.match(html,/crystalBlink/);assert.match(html,/holo-arc__beam/);assert.match(html,/mapSpecular/);
 assert.match(html,/https:\/\/waze\.com\/ul\?ll=/);
 assert.match(html,/loadPublishedEvents\(\)/);assert.match(html,/fetch\('\/api\/events'/);
 assert.match(html,/Rackelto Technologies Ltd/);
 assert.doesNotMatch(html,/const DEMO_EVENTS/);
});
test('shared header page and admin events-source controls exist',()=>{
 assert.match(read('Module_2_Public_Website/src/app/events/page.tsx'),/pci-events-frame/);
 assert.match(read('Module_2_Public_Website/src/app/api/events/route.ts'),/api\/v1\/public\/events/);
 const s=read('Module_3_Admin_Panel/src/app/events/sources/page.tsx');
 for(const token of ['Sync now','Test feed','Edit / Enable / Disable','Approve','Review','Source connections'])assert.ok(s.includes(token));
});

test('runtime TypeScript parser stays identical to the tested ES module parser',()=>{
 const runtime=read('Module_1_Adapter/src/modules/events/parse.ts').replace(/^\/\/ @ts-nocheck\r?\n/,'');
 const tested=read('Module_1_Adapter/src/modules/events/parse.mjs');
 assert.equal(runtime,tested);
});
