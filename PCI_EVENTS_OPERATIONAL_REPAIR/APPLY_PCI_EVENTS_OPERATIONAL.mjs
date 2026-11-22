/** PCI Events operational repair v1. Atomic preflight, backups, safe repeat. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const home=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||process.cwd());
const payload=path.join(home,'payload');
const patchList=JSON.parse(fs.readFileSync(path.join(home,'PATCHES.json'),'utf8'));
const planned=new Map();
const allowed=(p)=>p.startsWith('Module_1_Adapter/')||p.startsWith('Module_2_Public_Website/')||p.startsWith('Module_3_Admin_Panel/')||p.startsWith('docs/');
if(!fs.existsSync(path.join(root,'Module_1_Adapter','package.json')))throw Error('Run from the PCI repository root (PCI_Clean).');
function target(rel){
 if(!allowed(rel)||rel.includes('..')||rel.includes('\\'))throw Error('Invalid package path '+rel);
 const dest=path.resolve(root,rel);
 if(!dest.startsWith(root+path.sep))throw Error('Invalid path outside PCI root');
 return dest;
}
function current(rel){const p=target(rel);if(!fs.existsSync(p))throw Error('Missing expected repository file: '+rel);return planned.get(p)??fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');}
// Fast idempotence path. A complete prior application needs no further modification.
const fullyInstalled = [
 ['Module_1_Adapter/src/modules/events/routes.ts','pci_editorial_events'],
 ['Module_1_Adapter/src/lib/events-schema.ts','098_editorial_events.sql'],
 ['Module_3_Admin_Panel/src/app/events/sources/page.tsx','publishEditorial'],
 ['Module_2_Public_Website/src/app/api/events/route.ts','mergePublicEvents'],
 ['Module_2_Public_Website/public/events-radar.html','VERIFIED EVENT LOCATIONS'],
].every(([p,token])=>fs.existsSync(target(p))&&fs.readFileSync(target(p),'utf8').includes(token));
if(fullyInstalled){console.log('PCI Events operational update is already installed (0 changed files).');process.exit(0);}
const catalogAlreadyInstalled = fs.existsSync(target('Module_1_Adapter/src/modules/events/catalog.ts')) &&
  fs.existsSync(target('Module_1_Adapter/src/modules/events/routes.ts')) &&
  fs.readFileSync(target('Module_1_Adapter/src/modules/events/routes.ts'),'utf8').includes('EVENT_FEED_CATALOG') &&
  fs.readFileSync(target('Module_3_Admin_Panel/src/app/events/sources/page.tsx'),'utf8').includes('Live data integrations');
for(const entry of patchList){
 if(catalogAlreadyInstalled && entry.phase==='catalog')continue;
 const s=current(entry.file);let next=s;
 if(entry.kind==='replace_public_route'){
   const marker="publicEventsRoutes.get('/events',handler(async(_req,res)=>{";
   const idx=s.indexOf(marker);
   if(idx<0)throw Error('Cannot locate public Events route in '+entry.file);
   const suffix=s.slice(idx);
   if(suffix.includes('const [feed,editorial,status]=')){continue;}
   if(!suffix.trimEnd().endsWith('}));'))throw Error('Public Events route has unexpected trailing content; refusing overwrite.');
   next=s.slice(0,idx)+entry.after;
 }else{
   if(s.includes(entry.after))continue;
   const count=s.split(entry.before).length-1;
   if(count===(entry.all||1)) next=entry.all?s.split(entry.before).join(entry.after):s.replace(entry.before,entry.after);
   else throw Error('Unexpected change in '+entry.file+'; refusing partial installation. Expected '+(entry.all||1)+' occurrence(s), found '+count+'.');
 }
 planned.set(target(entry.file),next);
}
function scan(base){for(const ent of fs.readdirSync(base,{withFileTypes:true})){
 const full=path.join(base,ent.name);
 if(ent.isDirectory())scan(full);
 else if(ent.isFile()){
  const rel=path.relative(payload,full).split(path.sep).join('/');
  const dst=target(rel),text=fs.readFileSync(full,'utf8');
  if(fs.existsSync(dst)&&!rel.endsWith('/api/events/route.ts')){
    const prev=planned.get(dst)??fs.readFileSync(dst,'utf8');
    if(prev!==text)throw Error('Already-existing file has different content: '+rel+'; review before overwriting.');
  }
  planned.set(dst,text);
 }
}}
scan(payload);
const backupDir=path.join(root,'.pci-events-operational-backups');
let count=0;
for(const [dest,content] of planned){
 const previous=fs.existsSync(dest)?fs.readFileSync(dest,'utf8'):null;
 if(previous===content)continue;
 if(previous!==null){const backup=path.join(backupDir,path.relative(root,dest));fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(dest,backup);}
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 const temp=dest+'.pci-event-new';
 fs.writeFileSync(temp,content);fs.renameSync(temp,dest);count++;
}
console.log(`PCI Events operational update applied (${count} file(s) changed).`);
console.log('Verified official notices appear immediately in /api/events (they expire automatically).');
console.log('Admin owner can publish/unpublish additional source-linked events at /events/sources.');
console.log('NEXT: node --test Module_1_Adapter/tests/events-editorial-pipeline.test.mjs');
console.log('THEN: npm --prefix Module_1_Adapter run check; npm --prefix Module_2_Public_Website run check; npm --prefix Module_3_Admin_Panel run check');
