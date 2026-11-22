#!/usr/bin/env node
/** PCI Event Geo V4 – strict, idempotent, backed-up, all-preflight installer.
 * Preserves unrelated code changes (including Satellite and other UI modules).
 * Node 22+ required. No git or external packages needed for installation.
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
 try{const value=norm(await readFile(join(root,rel),'utf8'));cache.set(rel,{old:value,next:value});return cache.get(rel);}
 catch(e){if(e.code==='ENOENT'){cache.set(rel,{old:null,next:null});return cache.get(rel);}throw e;}
}
function matches(haystack,needle){return haystack.split(needle).length-1;}
for(const op of changes){
 const file=await current(op.path);
 if(file.next===null)throw Error('Missing required PCI source file: '+op.path+' (install V3 first). No files changed.');
 if(op.new.length && file.next.includes(op.new))continue;
 // Existing PCI versions use two different empty-results messages. Patch only
 // the one exact known form present. Keep strict failure on an unknown form.
 if(op.label==='physical only summary' && !file.next.includes(op.old) && !file.next.includes(op.new)){
  const currentMsg="else summary.textContent='SOURCES CONNECTED · NO APPROVED UPCOMING EVENTS';";
  const correctedMsg="else summary.textContent='SOURCES CONNECTED · NO APPROVED PHYSICAL EVENTS';";
  if(matches(file.next,currentMsg)===1){file.next=file.next.replace(currentMsg,correctedMsg);continue;}
  if(file.next.includes(correctedMsg))continue;
 }
 const count=matches(file.next,op.old);
 if(op.new===''&&count===0)continue; // already removed
 if(count!==op.count)throw Error(`${op.label}: expected ${op.count} anchors in ${op.path}; found ${count}. No files changed.`);
 file.next=file.next.split(op.old).join(op.new);
}
const newFiles=[
 'Module_2_Public_Website/public/pci-geo-reference.svg',
 'Module_2_Public_Website/tests/events-geo-map.test.mjs'
];
for(const rel of newFiles){
 const payload=await readFile(join(here,'payload',rel));
 const hash=createHash('sha256').update(payload).digest('hex');
 if(hash!==manifest[rel])throw Error('Package integrity verification failed: '+rel);
 const file=await current(rel);
 const next=payload.toString('utf8');
 if(file.old!==null&&file.old!==next)throw Error('Refusing to overwrite a different existing file: '+rel);
 file.next=next;
}
const changed=[...cache].filter(([_,v])=>v.old!==v.next);
console.log(`PCI Accurate Event Map V4 ${dry?'DRY RUN':'APPLY'}: ${changed.length} change(s), ${changes.length} safe source patches.`);
changed.forEach(([rel])=>console.log('  '+rel));
if(dry||!changed.length){if(!changed.length)console.log('Already installed; nothing to change.');process.exit(0);}
const backup=join(root,'.pci-events-geo-v4-backups',new Date().toISOString().replace(/[:.]/g,'-'));
const done=[];
try{
 for(const [rel,v] of changed){
  if(v.old!==null){const target=join(backup,rel);await mkdir(dirname(target),{recursive:true});await copyFile(join(root,rel),target);}
 }
 for(const [rel,v] of changed){const target=join(root,rel);await mkdir(dirname(target),{recursive:true});await writeFile(target,v.next,'utf8');done.push([rel,v]);}
}catch(err){
 for(const [rel,v] of done.reverse()){
  try{if(v.old===null)await unlink(join(root,rel));else await writeFile(join(root,rel),v.old,'utf8');}
  catch(e){console.error('Manual restoration required:',rel,String(e));}
 }
 throw err;
}
console.log('Installed. The public Events page now plots real venue coordinates with one small pulsing pin per venue.');
console.log('Next: node --test Module_1_Adapter/tests/events*.test.mjs');
