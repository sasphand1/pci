/** PCI Events TypeScript build hotfix. Touches only two known files; no git/deploy actions. */
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]||process.cwd());
const patches=[
  {
    file:'Module_1_Adapter/src/modules/events/service.ts',
    before:'  if(!value.ok){rejected++;continue;}\n  const item=value.item;',
    after:'  if(!value.ok || !value.item){rejected++;continue;}\n  const item=value.item;'
  },
  {
    file:'Module_3_Admin_Panel/src/app/events/sources/page.tsx',
    before:"onReview={(it,approved,latitude,longitude)=>action(it.id,()=>api('/admin/events/list/'+it.id,{method:'PATCH',csrf:identity?.csrfToken,body:{approved,latitude,longitude}}),approved?'Event published after review.':'Event unpublished.')}",
    after:"onReview={async (it,approved,latitude,longitude)=>{await action(it.id,()=>api('/admin/events/list/'+it.id,{method:'PATCH',csrf:identity?.csrfToken,body:{approved,latitude,longitude}}),approved?'Event published after review.':'Event unpublished.');}}"
  }
];
const staged=[];
for(const p of patches){
  const location=path.join(root,p.file);
  if(!fs.existsSync(location))throw new Error(`Missing file: ${p.file}. Run from PCI_Clean project root.`);
  const source=fs.readFileSync(location,'utf8');
  const old=p.before.replace(/\n/g,'\r?\n');
  const normalized=source.replace(/\r\n/g,'\n');
  const matchCount=normalized.split(p.before).length-1;
  if(matchCount===1){
    const result=normalized.replace(p.before,p.after);
    const output=source.includes('\r\n')?result.replace(/\n/g,'\r\n'):result;
    staged.push({location,filename:p.file,source,output,status:'patched'});
  }else if(normalized.includes(p.after)){
    staged.push({location,filename:p.file,status:'already fixed'});
  }else{
    throw new Error(`Unexpected source structure in ${p.file}; no files changed. Do not force the patch.`);
  }
}
for(const p of staged){
 if(p.status==='patched'){
  const backup=path.join(root,'.pci-events-ts-hotfix-backups',p.filename);
  fs.mkdirSync(path.dirname(backup),{recursive:true});
  if(!fs.existsSync(backup))fs.writeFileSync(backup,p.source);
  fs.writeFileSync(p.location,p.output);
 }
 console.log(`${p.status}: ${p.filename}`);
}
console.log('Hotfix complete. No git operations were performed.');
