/** PCI Events Intelligence v2 — atomic preflight, additive edits, backups, idempotence. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||process.cwd());
const dry=process.argv.includes('--dry-run');
const normalized=s=>s.replace(/\r\n/g,'\n');
const base=path.join(here,'payload');
const ops=JSON.parse(fs.readFileSync(path.join(here,'PATCHES.json'),'utf8'));
const manifest=JSON.parse(fs.readFileSync(path.join(here,'MANIFEST.json'),'utf8'));
const staged=new Map();
function dest(rel){
 if(!/^(Module_1_Adapter|Module_2_Public_Website|Module_3_Admin_Panel)\//.test(rel)||rel.includes('..')||rel.includes('\\'))throw Error('Invalid update path: '+rel);
 return path.join(root,rel);
}
function load(rel){
 if(staged.has(rel))return staged.get(rel);
 const p=dest(rel);
 if(!fs.existsSync(p))throw Error('Missing PCI source file: '+rel+'. No changes made.');
 const s=normalized(fs.readFileSync(p,'utf8'));staged.set(rel,s);return s;
}
for(const op of ops){
 let s=load(op.path);
 // Re-running must be safe even when anchors contain earlier substrings.
 if(s.includes(op.new))continue;
 const count=s.split(op.old).length-1;
 if(count!==1)throw Error(`${op.label}: expected one matching anchor in ${op.path}, found ${count}. No changes made.`);
 staged.set(op.path,s.replace(op.old,op.new));
}
for(const [rel,hash] of Object.entries(manifest)){
 const file=path.join(base,rel),out=dest(rel);
 if(!fs.existsSync(file))throw Error('Missing package file: '+rel);
 const buf=fs.readFileSync(file),digest=createHash('sha256').update(buf).digest('hex');
 if(digest!==hash)throw Error('Package checksum mismatch: '+rel);
 const v=normalized(buf.toString('utf8'));
 if(fs.existsSync(out)){
  if(normalized(fs.readFileSync(out,'utf8'))!==v)throw Error('Existing file conflict: '+rel+'; no changes made.');
 }else staged.set(rel,v);
}
const changes=[...staged].filter(([rel,text])=>!fs.existsSync(dest(rel))||normalized(fs.readFileSync(dest(rel),'utf8'))!==text);
if(dry){console.log('PCI Events Intelligence v2 DRY RUN OK: '+changes.length+' file(s) would change.');for(const [rel] of changes)console.log('  '+rel);process.exit(0);}
if(!changes.length){console.log('PCI Events Intelligence v2 already installed; zero changes.');process.exit(0);}
const backupDir=path.join(root,'.pci-events-intelligence-v2-backups',new Date().toISOString().replace(/[:.]/g,'-'));
const completed=[];
try{
 for(const [rel,value] of changes){
  const output=dest(rel);fs.mkdirSync(path.dirname(output),{recursive:true});
  if(fs.existsSync(output)){
   const backup=path.join(backupDir,rel);fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(output,backup);
  }
  const tmp=output+'.pci-v2-write-'+process.pid;
  fs.writeFileSync(tmp,value,'utf8');fs.renameSync(tmp,output);
  completed.push(rel);
 }
}catch(e){
 // Best-effort local rollback; preflight already verified every source and package checksum.
 for(const rel of completed.reverse()){
  const previous=path.join(backupDir,rel);
  if(fs.existsSync(previous))fs.copyFileSync(previous,dest(rel));else fs.rmSync(dest(rel),{force:true});
 }
 throw e;
}
console.log('PCI Events Intelligence v2 installed: '+changes.length+' file(s).');
console.log('Existing event approvals preserved. Deleted records can never return through feed sync.');
console.log('Next: npm --prefix Module_1_Adapter run check; npm --prefix Module_2_Public_Website run check; npm --prefix Module_3_Admin_Panel run check');
