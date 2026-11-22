/** PCI Events live source integration. Only intended files are changed. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(process.argv[2]||process.cwd());
const patches=JSON.parse(fs.readFileSync(path.join(here,'PATCHES.json'),'utf8'));
const payload=path.join(here,'payload');
const changes=new Map();
function safeLocation(relative){
 if(!/^Module_[123]_/.test(relative)&&!relative.startsWith('docs/'))throw new Error('Unsafe target: '+relative);
 const dest=path.resolve(repo,relative);
 if(!dest.startsWith(repo+path.sep))throw new Error('Path escapes repository');
 return dest;
}
if(!fs.existsSync(path.join(repo,'Module_1_Adapter','package.json')))throw new Error('Run from the PCI_Clean repository root.');
for(const p of patches){
 const dest=safeLocation(p.file);
 if(!fs.existsSync(dest))throw new Error('Missing target file: '+p.file+'; nothing changed.');
 const original=changes.get(dest)??fs.readFileSync(dest,'utf8');
 const clean=original.replace(/\r\n/g,'\n');
 const occurrences=clean.split(p.before).length-1;
 if(clean.includes(p.after))changes.set(dest,clean);
 else if(occurrences===1)changes.set(dest,clean.replace(p.before,p.after));
 else throw new Error('Unrecognized source in '+p.file+'. Changes not applied. Do not overwrite a newer version.');
}
function visit(folder){
 for(const x of fs.readdirSync(folder,{withFileTypes:true})){
  const pathname=path.join(folder,x.name);
  if(x.isDirectory())visit(pathname);
  else if(x.isFile()){
    const rel=path.relative(payload,pathname).split(path.sep).join('/');
    const dest=safeLocation(rel);
    const incoming=fs.readFileSync(pathname,'utf8');
    if(fs.existsSync(dest)){
     const existing=changes.get(dest)??fs.readFileSync(dest,'utf8');
     if(existing!==incoming)throw new Error('New file path already occupied with differing content: '+rel);
    }else changes.set(dest,incoming);
  }
 }
}
visit(payload);
const backups=path.join(repo,'.pci-events-catalog-backups');
fs.mkdirSync(backups,{recursive:true});
let count=0;
for(const [dest,content] of changes){
 const previous=fs.existsSync(dest)?fs.readFileSync(dest,'utf8'):null;
 if(previous===content)continue;
 if(previous!==null){const backup=path.join(backups,path.relative(repo,dest));fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(dest,backup);}
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 const tmp=dest+'.pci-catalog-new';fs.writeFileSync(tmp,content,'utf8');fs.renameSync(tmp,dest);count++;
}
console.log('PCI live Events integration applied: '+count+' changed files.');
console.log('Next: npm --prefix Module_1_Adapter run check');
console.log('Then: npm --prefix Module_3_Admin_Panel run typecheck && npm --prefix Module_2_Public_Website run typecheck');
