/** PCI Events controlled installer: local files only. No git actions, no deployment. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const pkg=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||process.cwd());
const dir=x=>path.join(root,x);
const files=[
 'Module_1_Adapter/database/migrations/097_events.sql',
 'Module_1_Adapter/src/lib/events-schema.ts',
 'Module_1_Adapter/src/modules/events/parse.mjs',
 'Module_1_Adapter/src/modules/events/parse.ts',
 'Module_1_Adapter/src/modules/events/fetch.ts',
 'Module_1_Adapter/src/modules/events/service.ts',
 'Module_1_Adapter/src/modules/events/routes.ts',
 'Module_2_Public_Website/public/events-radar.html',
 'Module_2_Public_Website/public/events.html',
 'Module_2_Public_Website/src/app/events/page.tsx',
 'Module_2_Public_Website/src/app/api/events/route.ts',
 'Module_2_Public_Website/packages/ui/src/styles/events-admin.css',
 'Module_3_Admin_Panel/src/app/events/sources/page.tsx',
 'Module_3_Admin_Panel/src/lib/events-types.ts',
 'Module_1_Adapter/tests/events-parser.test.mjs',
 'Module_1_Adapter/tests/events-contract.test.mjs',
 'Module_1_Adapter/tests/events-map.test.mjs'
];
const modifications={
 'Module_1_Adapter/src/server.ts':s=>{
  if(!s.includes("import {adminEventsRoutes,publicEventsRoutes}"))s="import {adminEventsRoutes,publicEventsRoutes} from './modules/events/routes.js';\nimport {ensureEventsSchema} from './lib/events-schema.js';\n"+s;
  if(!s.includes("app.use('/api/v1/public',publicEventsRoutes)"))s=insert(s,"app.use('/api/v1/public',publicRankingRoutes);","\n  app.use('/api/v1/public',publicEventsRoutes);");
  if(!s.includes("app.use('/api/v1/admin/events',adminEventsRoutes)"))s=insert(s,"app.use('/api/v1/admin',adminRoutes);","\n  app.use('/api/v1/admin/events',adminEventsRoutes);");
  if(!s.includes('await ensureEventsSchema();'))s=insert(s,'        await ensureRedis();',"\n        try{await ensureEventsSchema();}catch(err){logger.error({err},'Event sources schema initialization failed; core API stays operational');}");
  return s;
 },
 'Module_1_Adapter/src/worker.ts':s=>{
  if(!s.includes("import {ensureEventsSchema}"))s="import {ensureEventsSchema} from './lib/events-schema.js';\n"+s;
  if(!s.includes('await ensureEventsSchema();'))s=insert(s,' const scheduler=await startScheduler({embedded:false});',"\n try{await ensureEventsSchema();}catch(err){logger.error({err},'Event sources schema initialization failed in worker');}");
  return s;
 },
 'Module_1_Adapter/src/modules/sync/scheduler.ts':s=>{
  if(!s.includes("import {syncApprovedEventSources}"))s="import {syncApprovedEventSources} from '../events/service.js';\n"+s;
  if(!s.includes('syncApprovedEventSources()'))s=insert(s,' // Instagram sync is independent of YouTube\'s enable switch and schedule.',"\n tasks.push(cron.schedule('30 7 * * *',()=>{void syncApprovedEventSources().catch(e=>logger.error({err:e},'Event sources sync failed'));},{timezone:'Asia/Karachi'}));\n");
  return s;
 },
 'Module_3_Admin_Panel/src/lib/nav.ts':s=>{
  if(!s.includes("href:'/events/sources'"))s=insert(s,"  {title:'Page content',href:'/content',icon:'edit',roles:['owner','editor']},","\n  {title:'Event sources',href:'/events/sources',icon:'settings',roles:['owner','editor']},");
  return s;
 },
 'Module_2_Public_Website/packages/ui/src/styles.css':s=>s.includes("events-admin.css")?s:s+"\n@import './styles/events-admin.css';\n",
 'Module_2_Public_Website/src/components/SiteHeader.tsx':s=>{
  s=s.replace("href:'/events.html',label:'Events'","href:'/events',label:'Events'");
  if(!s.includes("label:'Events'"))s=insert(s,"  {href:'/#discover',label:'Creators'},","\n  {href:'/events',label:'Events'},");
  return s;
 },
 'Module_2_Public_Website/packages/ui/src/styles/layout.css':s=>s.includes('.pci-events-frame')?s:s+"\n/* Shared-header event route: responsive embedded MapLibre page. */\n.pci-events-host{width:100%;min-height:calc(100vh - 78px)}.pci-events-frame{display:block;width:100%;height:calc(100vh - 78px);min-height:700px;border:0;background:#040e19}@media(max-width:800px){.pci-events-frame{height:calc(100dvh - 70px);min-height:740px}}\n"
};
function insert(src,anchor,added){if(!src.includes(anchor))throw Error('Cannot locate expected integration point: '+anchor);return src.replace(anchor,anchor+added);}
function backup(file){if(fs.existsSync(file)){const rel=path.relative(root,file);const backupFile=path.join(root,'.pci-events-update-backups',rel);fs.mkdirSync(path.dirname(backupFile),{recursive:true});if(!fs.existsSync(backupFile))fs.copyFileSync(file,backupFile);}}
if(!fs.existsSync(dir('Module_1_Adapter/src/server.ts'))||!fs.existsSync(dir('Module_3_Admin_Panel/src/lib/nav.ts'))){console.error('Run this installer against the PCI_Clean repository root (or supply its path).');process.exit(1);}
// Preflight all expected patch anchors before copying anything.
const planned=[];
for(const [rel,fn] of Object.entries(modifications)){const pathname=dir(rel),before=fs.readFileSync(pathname,'utf8');const after=fn(before);planned.push({pathname,before,after});}
for(const rel of files){const src=path.join(pkg,rel);if(!fs.existsSync(src))throw Error('Update ZIP incomplete; missing '+rel);}
for(const rel of files){const src=path.join(pkg,rel),target=dir(rel);if(path.resolve(src)===path.resolve(target))continue;fs.mkdirSync(path.dirname(target),{recursive:true});backup(target);fs.copyFileSync(src,target);console.log('Installed',rel);}
for(const {pathname,before,after} of planned){if(before===after)continue;backup(pathname);fs.writeFileSync(pathname,after);console.log('Patched',path.relative(root,pathname));}
console.log('PCI Events integration installed locally. No Git operations were executed.');
