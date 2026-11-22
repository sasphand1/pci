import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd();
const backend=resolve(root,'Module_1_Adapter/src/modules/admin/routes.ts');
const frontend=resolve(root,'Module_3_Admin_Panel/src/app/creators/page.tsx');
const a=readFileSync(backend,'utf8');
const before=` const seenSlugs=new Map<string,string>();
 for(const item of fresh){
  const owner=claimedSlugs.get(item.slug)??seenSlugs.get(item.slug);
  if(owner && owner!==item.channelId)throw new HttpError(409,'SLUG_CONFLICT',
   \`Slug \${item.slug} is already assigned to another channel; no records imported\`);
  seenSlugs.set(item.slug,item.channelId);
 }
 if(fresh.length && !config.YOUTUBE_API_KEY)`;
const after=` const seenSlugs=new Map<string,string>();
 const conflicts:{channelId:string;slug:string;existingChannelId:string}[]=[];
 const safeFresh:typeof fresh=[];
 for(const item of fresh){
  const owner=claimedSlugs.get(item.slug)??seenSlugs.get(item.slug);
  if(owner && owner!==item.channelId){
   conflicts.push({channelId:item.channelId,slug:item.slug,existingChannelId:owner});
   continue;
  }
  seenSlugs.set(item.slug,item.channelId);
  safeFresh.push(item);
 }
 if(safeFresh.length && !config.YOUTUBE_API_KEY)`;
if(!a.includes(before) && !a.includes('const safeFresh:typeof fresh=[];'))throw Error('Unexpected backend version. No files changed.');
const start=a.indexOf("adminRoutes.post('/creators/bulk'");
const end=a.indexOf("adminRoutes.patch('/creators/:id'",start);
if(start<0||end<0)throw Error('Bulk route missing');
let block=a.slice(start,end);
if(!block.includes('const safeFresh:typeof fresh=[];')){
 block=block.replace(before,after);
 block=block.replaceAll('if(fresh.length){','if(safeFresh.length){')
 .replaceAll('fresh.map(x=>x.channelId)','safeFresh.map(x=>x.channelId)')
 .replaceAll('fresh.filter(x=>','safeFresh.filter(x=>')
 .replace('for(const item of fresh){\n    const r=await tx.query','for(const item of safeFresh){\n    const r=await tx.query');
 block=block.replace('duplicatesInFile:duplicatedInFile.length});','duplicatesInFile:duplicatedInFile.length,conflicts:conflicts.length});');
 block=block.replace('skippedChannelIds:skipped,duplicateChannelIds:duplicatedInFile','skippedChannelIds:skipped,duplicateChannelIds:duplicatedInFile,conflicts');
 if(!block.includes('const safeFresh:typeof fresh=[];')||!block.includes('for(const item of safeFresh){\n    const r=await tx.query')||!block.includes('duplicateChannelIds:duplicatedInFile,conflicts'))throw Error('Patch validation failed. No files changed.');
}
const b=a.slice(0,start)+block+a.slice(end);
const f=readFileSync(frontend,'utf8');
const old=`  const r=await api<{created:number;skipped:number;duplicatesInFile:number}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(\`Added \${r.created} new creators; skipped \${r.skipped} existing channels and \${r.duplicatesInFile} duplicates in this file.\`);setBulk('');list.reload();`;
const updated=`  const r=await api<{created:number;skipped:number;duplicatesInFile:number;conflicts:{channelId:string;slug:string;existingChannelId:string}[]}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(\`Added \${r.created}; skipped \${r.skipped} existing, \${r.duplicatesInFile} file duplicates; \${r.conflicts.length} slug conflicts.\`);
  if(r.conflicts.length)setError(r.conflicts.map(c=>\`Slug \${c.slug}: uploaded \${c.channelId} differs from registered \${c.existingChannelId}\`).join(' | '));
  else setBulk('');
  list.reload();`;
if(!f.includes(old)&&!f.includes('conflicts:{channelId:string;slug:string;existingChannelId:string}[]'))throw Error('Unexpected frontend version. No files changed.');
const g=f.includes(old)?f.replace(old,updated):f;
if(b!==a){copyFileSync(backend,backend+'.conflict-backup');writeFileSync(backend,b);}
if(g!==f){copyFileSync(frontend,frontend+'.conflict-backup');writeFileSync(frontend,g);}
console.log('Conflict-safe bulk import patch applied. Verify npm tests and builds before commit.');
