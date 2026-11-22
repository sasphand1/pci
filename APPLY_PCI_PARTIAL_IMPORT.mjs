import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd();
function patch(path, replacements){
 const file=resolve(root,path);let body=readFileSync(file,'utf8');let next=body;
 for (const [before,after] of replacements){
  if(next.includes(after)) continue;
  const pieces=next.split(before);
  if(pieces.length!==2)throw new Error(`Expected exactly one match in ${path}: ${before.slice(0,90)}`);
  next=pieces.join(after);
 }
 if(next!==body){copyFileSync(file,file+'.pci-partial-import.bak');writeFileSync(file,next);console.log('UPDATED',path)}else console.log('ALREADY UPDATED',path);
}
patch('Module_1_Adapter/src/modules/admin/routes.ts',[
 [` if(candidates.length){
   const yt=new YoutubeClient(),valid=new Set<string>();
   for(const part of chunks(candidates.map(x=>x.channelId),50))for(const c of await yt.channels(part))valid.add(c.id);
   const invalid=candidates.filter(x=>!valid.has(x.channelId)).map(x=>x.channelId);
   if(invalid.length)throw new HttpError(400,'CHANNEL_NOT_FOUND',\`Unverified YouTube IDs: \${invalid.join(', ')}. No records changed.\`);
 }
 let created=0,reactivated=0;`,
 ` // Verify every candidate against YouTube, but do not abort valid records when a
 // different submitted channel ID is invalid or no longer available.
 const valid=new Set<string>();
 if(candidates.length){
   const yt=new YoutubeClient();
   for(const part of chunks(candidates.map(x=>x.channelId),50))
     for(const c of await yt.channels(part))valid.add(c.id);
 }
 const unverifiedChannelIds=candidates.filter(x=>!valid.has(x.channelId)).map(x=>x.channelId);
 const verifiedCandidates=candidates.filter(x=>valid.has(x.channelId));
 let created=0,reactivated=0;`],
 [`     for(const item of candidates){`,`     for(const item of verifiedCandidates){`],
 [` await auditAs(res,'creator.bulk_import_with_restore',null,{created,reactivated,skipped:skipped.length,conflicts:conflicted.length,duplicates:duplicateIds.length});
 if(created||reactivated)await bustPublicCache();
 res.json({data:{created,reactivated,skipped:skipped.length,duplicatesInFile:duplicateIds.length,
   conflicts:conflicted,skippedChannelIds:skipped}});`,
 ` await auditAs(res,'creator.bulk_import_with_restore',null,{created,reactivated,skipped:skipped.length,conflicts:conflicted.length,duplicates:duplicateIds.length,unverified:unverifiedChannelIds.length});
 if(created||reactivated)await bustPublicCache();
 res.json({data:{created,reactivated,skipped:skipped.length,duplicatesInFile:duplicateIds.length,
   conflicts:conflicted,skippedChannelIds:skipped,unverifiedChannelIds}});`]
]);
patch('Module_3_Admin_Panel/src/app/creators/page.tsx',[
 [`  const r=await api<{created:number;reactivated:number;skipped:number;duplicatesInFile:number;conflicts:{channelId:string;slug:string;existingChannelId:string}[]}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(\`Created \${r.created}, restored \${r.reactivated}, skipped \${r.skipped}, duplicates \${r.duplicatesInFile}, conflicts \${r.conflicts.length}.\`);
  if(r.conflicts.length)setError(r.conflicts.map(c=>\`Slug \${c.slug}: \${c.channelId} conflicts with \${c.existingChannelId}\`).join(' | '));
  else setBulk('');`,
 `  const r=await api<{created:number;reactivated:number;skipped:number;duplicatesInFile:number;conflicts:{channelId:string;slug:string;existingChannelId:string}[];unverifiedChannelIds:string[]}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(\`Created \${r.created}, restored \${r.reactivated}, skipped existing \${r.skipped}, duplicates \${r.duplicatesInFile}, slug conflicts \${r.conflicts.length}, unverified YouTube IDs \${r.unverifiedChannelIds.length}.\`);
  const issues=[...r.conflicts.map(c=>\`Slug \${c.slug}: \${c.channelId} conflicts with \${c.existingChannelId}\`),...r.unverifiedChannelIds.map(id=>\`Unverified YouTube ID: \${id}\`)];
  if(issues.length)setError(issues.join(' | '));
  else setBulk('');`]
]);
console.log('PATCH COMPLETE. Run backend npm test/build and admin npm run typecheck/build.');
