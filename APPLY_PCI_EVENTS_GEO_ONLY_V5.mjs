#!/usr/bin/env node
/** PCI Events Geo Only v5: surgical client-only patch. Does not change Module 1, admin,
 * migrations, feed source configuration, Redis, or published event records.
 * No runtime dependencies. All-or-nothing preflight, backups, idempotent installs.
 */
import {readFile,writeFile,mkdir,copyFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const here=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]||process.cwd());
const dry=process.argv.includes('--dry-run');
const changes=JSON.parse(await readFile(join(here,'PATCHES.json'),'utf8'));
const manifest=JSON.parse(await readFile(join(here,'MANIFEST.json'),'utf8'));
const norm=s=>s.replace(/\r\n/g,'\n');
const cache=new Map();
async function current(rel){
 if(cache.has(rel))return cache.get(rel);
 try{const v=norm(await readFile(join(root,rel),'utf8'));cache.set(rel,{old:v,next:v});return cache.get(rel);}
 catch(e){if(e.code==='ENOENT'){cache.set(rel,{old:null,next:null});return cache.get(rel);}throw e;}
}
function countText(hay,needle){return hay.split(needle).length-1;}
const approved=new Set(['Module_2_Public_Website/public/events-radar.html']);
for(const op of changes){
 if(!approved.has(op.path))throw Error('Package contains unexpected modification: '+op.path);
 const file=await current(op.path);
 if(file.next===null)throw Error('Missing Events map file: '+op.path+'; no files changed.');
 if(op.new.length&&file.next.includes(op.new))continue;
 if(op.label==='physical only summary'&&!file.next.includes(op.old)){
  const before="else summary.textContent='SOURCES CONNECTED · NO APPROVED UPCOMING EVENTS';";
  const after="else summary.textContent='SOURCES CONNECTED · NO APPROVED PHYSICAL EVENTS';";
  if(countText(file.next,before)===1){file.next=file.next.replace(before,after);continue;}
  if(file.next.includes(after))continue;
  // The older v3 map has no special summary. Leave it as is.
  if(file.next.includes("summary.textContent='SOURCES CONNECTED"))throw Error('Unknown Events summary format; no files changed.');
  continue;
 }
 const n=countText(file.next,op.old);
 if(op.new===''&&n===0)continue;
 if(n!==op.count)throw Error(`${op.label}: expected ${op.count} anchors in ${op.path}; found ${n}. No files changed.`);
 file.next=file.next.split(op.old).join(op.new);
}
for(const rel of Object.keys(manifest)){
 const bytes=await readFile(join(here,'payload',rel));
 const sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!==manifest[rel])throw Error('ZIP file integrity check failed for '+rel);
 const file=await current(rel);const next=norm(bytes.toString('utf8'));
 if(file.old!==null&&file.old!==next)throw Error('Existing file differs: '+rel+'; no files changed.');
 file.next=next;
}
const changed=[...cache].filter(([_,v])=>v.old!==v.next);
console.log(`PCI Events Geo Only V5 ${dry?'DRY RUN':'INSTALL'} — ${changed.length} file(s).`);
changed.forEach(([rel])=>console.log('  '+rel));
if(!changed.length){console.log('Already installed. No changes required.');process.exit(0);}
if(dry){console.log('Preflight OK. Nothing was changed.');process.exit(0);}
const backup=join(root,'.pci-events-geo-only-v5-backups',new Date().toISOString().replace(/[:.]/g,'-'));
const done=[];
try{
 for(const [rel,v] of changed)if(v.old!==null){const target=join(backup,rel);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,rel),target);}
 for(const [rel,v] of changed){const target=join(root,rel);await mkdir(dirname(target),{recursive:true});await writeFile(target,v.next,'utf8');done.push([rel,v]);}
}catch(err){
 for(const [rel,v] of done.reverse())try{if(v.old===null)await unlink(join(root,rel));else await writeFile(join(root,rel),v.old,'utf8');}catch(e){console.error('Manual recovery needed for:',rel,e);}
 throw err;
}
console.log('Success. Backend and API routes untouched; georeferenced venue pins are ready for the public website build.');
