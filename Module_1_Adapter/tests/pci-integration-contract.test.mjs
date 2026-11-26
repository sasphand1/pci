import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const src=p=>readFileSync(join(root,p),'utf8');
const exists=p=>existsSync(join(root,p));

test('Hostinger satellite runtime assets and backend routes are committed',()=>{
 const server=src('Module_1_Adapter/src/server.ts');
 assert.match(server,/satellitePublicRoutes/);assert.match(server,/satelliteAdminRoutes/);
 assert.match(server,/ensureSatelliteSchema/);
 for(const f of ['guard.mjs','bulk.mjs','catalog.mjs','routes.ts','service.ts'])assert.ok(exists('Module_1_Adapter/src/modules/satellite/'+f),f);
 assert.ok(exists('Module_1_Adapter/database/migrations/096_satellite.sql'));
 const copy=src('Module_1_Adapter/scripts/copy-assets.mjs');
 for(const f of ['catalog.mjs','bulk.mjs','guard.mjs'])assert.ok(copy.includes('modules/satellite/'+f),f);
});
test('Events read/admin endpoints and schema are mounted on Module 1',()=>{
 const s=src('Module_1_Adapter/src/server.ts');
 assert.match(s,/app\.use\('\/api\/v1\/public',publicEventsRoutes\)/);
 assert.match(s,/app\.use\('\/api\/v1\/admin\/events',adminEventsRoutes\)/);
 assert.match(s,/ensureEventsSchema/);
 assert.ok(exists('Module_1_Adapter/database/migrations/097_events.sql'));
});
test('scheduled sync retains Satellite and verified Event feeds',()=>{
 const s=src('Module_1_Adapter/src/modules/sync/scheduler.ts');
 assert.match(s,/satelliteTick\(\)/);assert.match(s,/syncApprovedEventSources\(\)/);
});
test('one shared public header across Home, Events and Satify',()=>{
 const layout=src('Module_2_Public_Website/src/app/layout.tsx');
 const header=src('Module_2_Public_Website/src/components/SiteHeader.tsx');
 const events=src('Module_2_Public_Website/src/app/events/page.tsx');
 const radar=src('Module_2_Public_Website/public/events-radar.html');
 const sat=src('Module_2_Public_Website/src/app/satify/page.tsx');
 assert.match(layout,/<SiteHeader\s*\/>/);
 for(const p of ["href:'/events'","href:'/satify'"])assert.ok(header.includes(p));
 assert.match(header,/pathname\.startsWith/);
 assert.match(events,/pci-events-frame/);assert.match(sat,/SatelliteDashboard/);
 assert.doesNotMatch(radar,/<header\b/i,'radar frame must not have its own independent global header');
 assert.doesNotMatch(radar,/<span class=["']tab-num/,'category labels must not contain 01/02 decorations');
});
test('public Satellite city requests use same-origin proxy, not browser localhost',()=>{
 const dashboard=src('Module_2_Public_Website/src/components/SatelliteDashboard.tsx');
 const proxy=src('Module_2_Public_Website/src/app/api/satellite/route.ts');
 assert.match(dashboard,/const API='\/api\/satellite'/);
 assert.doesNotMatch(dashboard,/http:\/\/localhost:8080/);
 assert.match(proxy,/ADAPTER_INTERNAL_URL/);assert.match(proxy,/INVALID_FILTER/);
});
test('MapLibre + Waze retained in event cards',()=>{
 const radar=src('Module_2_Public_Website/public/events-radar.html');
 assert.match(radar,/waze\.com\/ul\?ll=/);
 assert.match(radar,/maplibre-gl/i);
 assert.match(radar,/\/api\/events/);
});
test('management pages share management shell and actual CSS',()=>{
 const nav=src('Module_3_Admin_Panel/src/lib/nav.ts');
 assert.match(nav,/href:'\/events\/sources'/);assert.match(nav,/href:'\/satellite'/);
 assert.ok(exists('Module_3_Admin_Panel/src/app/satellite/page.tsx'));
 assert.ok(exists('Module_3_Admin_Panel/src/app/events/sources/page.tsx'));
 const adminCss=src('Module_3_Admin_Panel/vendor/pci-ui/src/styles.css');
 assert.match(adminCss,/events-admin\.css/);
 assert.ok(exists('Module_3_Admin_Panel/vendor/pci-ui/src/styles/events-admin.css'));
 const css=src('Module_2_Public_Website/packages/ui/src/styles.css');
 assert.match(css,/satellite\.css/);assert.match(css,/events-admin\.css/);
 assert.ok(exists('Module_2_Public_Website/packages/ui/src/styles/satellite.css'));
});
