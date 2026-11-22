#!/usr/bin/env node
// Safe preflight + idempotent, strictly anchored PCI Events population patch.
// Does not touch Satellite or Creator modules; no external network or credentials.
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const pack=dirname(fileURLToPath(import.meta.url));
const root=resolve(process.argv[2]||process.cwd());
const dryRun=process.argv.includes('--dry-run');
const manifest=JSON.parse(await readFile(join(pack,'MANIFEST.json'),'utf8'));
const clean=s=>s.replace(/\r\n/g,'\n');
const data=new Map();
for(const [rel,hash] of Object.entries(manifest)){
 const body=await readFile(join(pack,'payload',rel));
 if(createHash('sha256').update(body).digest('hex')!==hash)throw Error(`ZIP integrity failed: ${rel}`);
 data.set(rel,body.toString('utf8'));
}
async function file(rel){try{return clean(await readFile(join(root,rel),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
const ops=[];
function replaceExactly(rel,oldToken,newToken,label){
 const op=ops.find(o=>o.rel===rel);
 if(!op)throw Error('Internal patch order issue: '+rel);
 if(op.next.includes(newToken))return; // idempotent even when replacement includes anchor
 const n=op.next.split(oldToken).length-1;
 if(n===0){if(op.next.includes(newToken))return;throw Error(`${label}: expected match in ${rel}, found none. No files changed.`);}
 if(n!==1)throw Error(`${label}: expected one anchor in ${rel}, found ${n}. No files changed.`);
 op.next=op.next.replace(oldToken,newToken);
}
for(const rel of ['Module_1_Adapter/src/lib/events-schema.ts','Module_3_Admin_Panel/src/app/events/intelligence/page.tsx','Module_2_Public_Website/public/events-radar.html']){
 const old=await file(rel);if(old===null)throw Error('Missing required PCI v2 file: '+rel);
 ops.push({rel,old,next:old});
}
const sql='Module_1_Adapter/database/migrations/101_official_events_2026_2027.sql';
const test='Module_1_Adapter/tests/events-official-population-v3.test.mjs';
const fixture='Module_1_Adapter/tests/events-official-population-v3-data.json';
for(const rel of [sql,test,fixture]){
 const old=await file(rel);
 const next=data.get(rel);
 if(old!==null&&old!==next)throw Error('Refusing to overwrite existing, different file: '+rel);
 ops.push({rel,old,next});
}
const schema='Module_1_Adapter/src/lib/events-schema.ts';
const anchor='  await client.query(integrationsSql);';
const addition=`\n  const officialSql=await readFile(fileURLToPath(new URL('../../database/migrations/101_official_events_2026_2027.sql',import.meta.url)),'utf8');\n  await client.query(officialSql);`;
replaceExactly(schema,anchor,anchor+addition,'load population after migration 100');
const admin='Module_3_Admin_Panel/src/app/events/intelligence/page.tsx';
replaceExactly(admin,"[status,setStatus]=useState('pending')","[status,setStatus]=useState('all')",'bucket shows published records by default');
replaceExactly(admin,"['Imported',counts?.total??0]","['Feed imports',counts?.total??0]",'feed count label');
replaceExactly(admin," imported · "," records · ",'category count label');
const map='Module_2_Public_Website/public/events-radar.html';
replaceExactly(map,"item.all_day?'All day'","item.all_day?'Time: see organiser'",'accurate unknown event time');
const changed=ops.filter(o=>o.old!==o.next);
console.info(`PCI Population v3 ${dryRun?'DRY RUN':'APPLY'}: ${changed.length} file(s) to change; 30 dated official venue notices.`);
for(const o of changed)console.info('  '+o.rel);
if(dryRun||!changed.length)process.exit(0);
const backupRoot=join(root,'.pci-events-population-v3-backups',new Date().toISOString().replace(/[:.]/g,'-'));
const written=[];
try{
 // Every operation has been validated. Copy originals before first modification.
 for(const op of changed){if(op.old!==null){const path=join(backupRoot,op.rel);await mkdir(dirname(path),{recursive:true});await copyFile(join(root,op.rel),path);}}
 for(const op of changed){const dest=join(root,op.rel);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,op.next,'utf8');written.push(op);}
}catch(e){
 for(const op of written.reverse()){
  try{if(op.old===null){const {unlink}=await import('node:fs/promises');await unlink(join(root,op.rel));}
  else await writeFile(join(root,op.rel),op.old,'utf8');}catch(err){console.error('Manual restoration needed:',op.rel,String(err));}
 }
 throw e;
}
console.info('Update applied. Event notices will populate after backend redeploy runs migration 101.');
console.info('Run: node --test Module_1_Adapter/tests/events-official-population-v3.test.mjs');
