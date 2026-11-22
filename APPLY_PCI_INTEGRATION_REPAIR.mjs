/** PCI Events + Satellite frontend integration repair. No git commands, no background work. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const base=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||process.cwd());
const files={
  server:'Module_1_Adapter/src/server.ts',
  scheduler:'Module_1_Adapter/src/modules/sync/scheduler.ts',
  worker:'Module_1_Adapter/src/worker.ts',
  nav:'Module_3_Admin_Panel/src/lib/nav.ts',
  header:'Module_2_Public_Website/src/components/SiteHeader.tsx',
  layout:'Module_2_Public_Website/src/app/layout.tsx',
  publicCss:'Module_2_Public_Website/packages/ui/src/styles.css',
  adminCss:'Module_3_Admin_Panel/vendor/pci-ui/src/styles.css',
  footer:'Module_2_Public_Website/src/components/SiteFooter.tsx',
  sitemap:'Module_2_Public_Website/src/app/sitemap.ts',
  radar:'Module_2_Public_Website/public/events-radar.html',
  adminStyles:'Module_2_Public_Website/packages/ui/src/styles/events-admin.css',
  eventsRoute:'Module_1_Adapter/src/modules/events/routes.ts',
  satelliteRoute:'Module_1_Adapter/src/modules/satellite/routes.ts',
};
const at=(rel)=>path.join(root,rel);
const read=(rel)=>fs.readFileSync(at(rel),'utf8');
function assert(ok,message){if(!ok)throw new Error(message);}
function insertAfter(s, anchor, toAdd, label){
  assert(s.includes(anchor),`Expected ${label} anchor missing; aborting without writing`);
  return s.replace(anchor, anchor+toAdd);
}
function patchServer(s){
  if(!s.includes('publicEventsRoutes')){
    s="import {adminEventsRoutes,publicEventsRoutes} from './modules/events/routes.js';\n"+s;
  }
  if(!s.includes("import {ensureEventsSchema}"))s="import {ensureEventsSchema} from './lib/events-schema.js';\n"+s;
  if(!s.includes("import {ensureSatelliteSchema}"))s="import {ensureSatelliteSchema} from './lib/satellite-schema.js';\n"+s;
  if(!s.includes("app.use('/api/v1/public',publicEventsRoutes)"))s=insertAfter(s,"  app.use('/api/v1/public',publicRankingRoutes);","\n  app.use('/api/v1/public',publicEventsRoutes);",'public Events route');
  if(!s.includes("app.use('/api/v1/admin/events',adminEventsRoutes)"))s=insertAfter(s,"  app.use('/api/v1/admin',adminRoutes);","\n  app.use('/api/v1/admin/events',adminEventsRoutes);",'admin Events route');
  if(!s.includes('await ensureSatelliteSchema();'))s=insertAfter(s,'        await ensureRedis();',"\n        try{await ensureSatelliteSchema();logger.info('Satellite schema verified');}\n        catch(err){logger.error({err},'Satellite schema unavailable; satellite endpoints may fail until migration is applied');}",'Satellite bootstrap');
  if(!s.includes('await ensureEventsSchema();'))s=insertAfter(s,'        await ensureRedis();',"\n        try{await ensureEventsSchema();logger.info('Events schema verified');}\n        catch(err){logger.error({err},'Events schema unavailable; event endpoints may fail until the migration is applied');}",'Events bootstrap');
  return s;
}
function patchScheduler(s){
  if(!s.includes("import {syncApprovedEventSources}"))s="import {syncApprovedEventSources} from '../events/service.js';\n"+s;
  if(!s.includes('syncApprovedEventSources()'))s=insertAfter(s," tasks.push(cron.schedule('*/15 * * * *',()=>void satelliteTick()));", "\n // Verified official event feeds only; synchronized daily in Pakistan local time.\n tasks.push(cron.schedule('30 7 * * *',()=>{void syncApprovedEventSources().catch(err=>logger.error({err},'Daily event sync failed'));},{timezone:'Asia/Karachi'}));",'event schedule');
  return s;
}
function patchWorker(s){
  if(!s.includes('ensureEventsSchema'))s="import {ensureEventsSchema} from './lib/events-schema.js';\n"+s;
  if(!s.includes('ensureSatelliteSchema'))s="import {ensureSatelliteSchema} from './lib/satellite-schema.js';\n"+s;
  const eventLine=" try{await ensureEventsSchema();}catch(err){logger.error({err},'Event sources schema initialization failed in worker');}";
  const satLine=" try{await ensureSatelliteSchema();}catch(err){logger.error({err},'Satellite schema initialization failed in worker');}";
  s=s.replaceAll(eventLine+'\n','').replaceAll(satLine+'\n','');
  const schedulerLine=' const scheduler=await startScheduler({embedded:false});';
  assert(s.includes(schedulerLine),'Worker scheduler anchor missing');
  return s.replace(schedulerLine,satLine+'\n'+eventLine+'\n'+schedulerLine);
}
function patchNav(s){
  if(!s.includes("href:'/events/sources'"))s=insertAfter(s,"  {title:'Page content',href:'/content',icon:'edit',roles:['owner','editor']},","\n  {title:'Event sources',href:'/events/sources',icon:'settings',roles:['owner','editor']},",'management Events sources link');
  if(!s.includes("href:'/satellite'"))s=insertAfter(s,"  {title:'Settings',href:'/settings',icon:'settings',roles:['owner','editor','moderator']}",",\n  {title:'Satellite APIs',href:'/satellite',icon:'settings',roles:['owner']}",'management Satellite link');
  return s;
}
function patchHeader(s){
  assert(s.includes('export function SiteHeader'), 'SiteHeader template not found');
  if(!s.includes("href:'/events',label:'Events'"))s=insertAfter(s,"  {href:'/#discover',label:'Creators'},","\n  {href:'/events',label:'Events'},",'Events header link');
  if(!s.includes("href:'/satellite',label:'Satellite'"))s=insertAfter(s,"  {href:'/events',label:'Events'},","\n  {href:'/satellite',label:'Satellite'},",'Satellite header link');
  const original="const active =\n              (href==='/' && pathname==='/') ||\n              (href==='/events' && pathname==='/events');";
  const updated="const active = href === '/' ? pathname === '/'\n              : href.startsWith('/#') ? false\n              : pathname === href || pathname.startsWith(`${href}/`);";
  if(s.includes(original))s=s.replace(original,updated);
  else assert(s.includes('pathname.startsWith(`${href}/`)'), 'Header active-tab implementation changed; review manually instead of overwriting');
  return s;
}
function patchLayout(s){
  assert(s.includes("import {SiteHeader} from '@/components/SiteHeader';") && s.includes('<SiteHeader/>'), 'Expected shared public header is missing from root layout');
  if(!s.includes("import './public-header.css';"))s=insertAfter(s, "import './public-stage.css';", "\nimport './public-header.css';", 'site-wide public header stylesheet');
  return s;
}
function patchFooter(s){
  if(!s.includes('href="/events"'))s=s.replace('<Link href="/videos">Recent videos</Link>','<Link href="/videos">Recent videos</Link><Link href="/events">Events</Link>');
  if(!s.includes('href="/satellite"'))s=s.replace('<Link href="/events">Events</Link>','<Link href="/events">Events</Link><Link href="/satellite">Satellite Intelligence</Link>');
  return s;
}
function patchSitemap(s){
  if(!s.includes("'events'"))s=s.replace("'wall','methodology'","'wall','events','methodology'");
  if(!s.includes("'satellite'"))s=s.replace("'events','methodology'","'events','satellite','methodology'");
  return s;
}
function patchRadar(s){
  // Iframe is an events widget: Next.js RootLayout always owns the single public header.
  assert(s.includes('id="category-tabs"')&&s.includes('data-pci-events-only="true"'), 'Unrecognized radar layout; aborting');
  assert(!/<header\b/i.test(s), 'Embedded radar has an extra header; manual review required');
  assert(/waze\.com\/ul\?ll=/.test(s), 'Waze navigation disappeared from event cards');
  assert(/maplibre/i.test(s), 'MapLibre map appears to have been removed');
  return s;
}
function patchSatelliteDashboard(s){
  if(s.includes("const API='/api/satellite'"))return s;
  const old="const API=(process.env.NEXT_PUBLIC_ADAPTER_API_URL||'http://localhost:8080').replace(/\\/$/,'');";
  if(!s.includes(old))throw new Error('SatelliteDashboard API transport changed; refusing to rewrite unfamiliar code');
  s=s.replace(old,"const API='/api/satellite';");
  const oldFetch='`${API}/api/v1/satellite/${metric}/latest?city=${encodeURIComponent(city)}`';
  assert(s.includes(oldFetch),'Satellite Dashboard client request anchor missing');
  return s.replace(oldFetch,'`${API}?metric=${encodeURIComponent(metric)}&city=${encodeURIComponent(city)}`');
}
function patchPublicCss(s){
  if(!s.includes("@import './styles/satellite.css'"))s += "\n@import './styles/satellite.css';\n";
  if(!s.includes("@import './styles/events-admin.css'"))s += "\n@import './styles/events-admin.css';\n";
  return s;
}
function patchAdminCss(s){
  if(!s.includes("@import './styles/events-admin.css'"))s += "\n@import './styles/events-admin.css';\n";
  return s;
}
const patches=[
 [files.server,patchServer],[files.scheduler,patchScheduler],[files.worker,patchWorker],
 [files.nav,patchNav],[files.header,patchHeader],[files.layout,patchLayout],[files.publicCss,patchPublicCss],
 [files.adminCss,patchAdminCss],[files.footer,patchFooter],[files.sitemap,patchSitemap],[files.radar,patchRadar],
];
assert(fs.existsSync(at(files.server)) && fs.existsSync(at(files.header)) && fs.existsSync(at(files.nav)), 'Run from PCI_Clean repository root');
assert(read(files.eventsRoute).includes('publicEventsRoutes'), 'Events backend source is missing');
assert(read(files.satelliteRoute).includes('satellitePublicRoutes'), 'Satellite backend source is missing');
const pending=[];
const satelliteDashboard='Module_2_Public_Website/src/components/SatelliteDashboard.tsx';
if(fs.existsSync(at(satelliteDashboard)))patches.push([satelliteDashboard,patchSatelliteDashboard]);
for(const [rel,func] of patches){
  assert(fs.existsSync(at(rel)),`Missing ${rel}`);
  const old=read(rel),value=func(old);
  pending.push({rel,old,value});
}
const selected=[
 'Module_2_Public_Website/src/app/satellite/page.tsx',
 'Module_2_Public_Website/src/components/SatelliteDashboard.tsx',
 'Module_2_Public_Website/packages/ui/src/styles/satellite.css',
 'Module_3_Admin_Panel/src/app/satellite/page.tsx',
 'Module_2_Public_Website/tests/satellite-integration.test.mjs',
 'Module_3_Admin_Panel/tests/satellite-admin.test.mjs',
 'Module_2_Public_Website/src/app/api/satellite/route.ts',
 'Module_1_Adapter/src/lib/satellite-schema.ts',
 'Module_1_Adapter/tests/pci-integration-contract.test.mjs',
 'Module_2_Public_Website/src/app/public-header.css',
 'Module_2_Public_Website/tests/public-header-template.test.mjs',
];
for(const rel of selected)assert(fs.existsSync(path.join(base,'payload',rel)), `Repair archive damaged: ${rel}`);
const adminStyles=read(files.adminStyles);
assert(adminStyles.includes('.pci-ef-source'),'PCI Events admin stylesheet is missing or invalid');
const changes=pending.filter(x=>x.old!==x.value);
const missing=selected.filter(rel=>!fs.existsSync(at(rel)));
const vendorEventCss='Module_3_Admin_Panel/vendor/pci-ui/src/styles/events-admin.css';
if(!fs.existsSync(at(vendorEventCss)))missing.push(vendorEventCss);
const docsFile='docs/PCI_EVENTS_SATELLITE_INTEGRATION.md';
if(!fs.existsSync(at(docsFile)))missing.push(docsFile);
if(process.argv.includes('--dry-run')){
  console.log('PREVIEW only, no files changed');
  console.log('Update:',changes.map(x=>x.rel));
  console.log('Create missing:',missing);
  process.exit(0);
}
const backupName=new Date().toISOString().replace(/[:.]/g,'-');
const backupRoot=at('.pci-repair-backups/'+backupName);
function write(rel,bytes){
  const dest=at(rel);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(dest)){
    const b=path.join(backupRoot,rel);fs.mkdirSync(path.dirname(b),{recursive:true});fs.copyFileSync(dest,b);
  }
  fs.writeFileSync(dest,bytes);
  console.log('Updated:',rel);
}
for(const {rel,value} of changes)write(rel,value);
for(const rel of selected){if(!fs.existsSync(at(rel)))write(rel,fs.readFileSync(path.join(base,'payload',rel)));}
if(!fs.existsSync(at(vendorEventCss)))write(vendorEventCss,adminStyles);
const docsSource=path.join(base,'payload',docsFile);
if(!fs.existsSync(at(docsFile)))write(docsFile,fs.readFileSync(docsSource));
console.log(`PCI integration repair complete: ${changes.length} existing files updated, ${missing.length} missing files added. No git operations performed.`);
