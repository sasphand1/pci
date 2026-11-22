import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=process.cwd();
function patch(path, transform){const p=resolve(root,path);const original=readFileSync(p,'utf8');if(original.includes('PCI_REGISTRY_RESET_V1')){console.log('Already applied:',path);return;}const changed=transform(original);if(changed===original)throw new Error('Expected source text missing; no changes written to '+path);copyFileSync(p,p+'.pre-pci-registry-reset.bak');writeFileSync(p,changed,'utf8');console.log('Updated:',path);}
function replace(source,needle,replacement,label){if(!source.includes(needle))throw new Error('Source mismatch at '+label);return source.replace(needle,replacement)}
const backend='Module_1_Adapter/src/modules/admin/routes.ts';
const ui='Module_3_Admin_Panel/src/app/creators/page.tsx';
patch(backend,s=>{
 s=replace(s,"const q=z.object({limit:z.coerce.number().int().min(1).max(250).default(100),offset:z.coerce.number().int().min(0).default(0)}).parse(req.query);", "const q=z.object({limit:z.coerce.number().int().min(1).max(250).default(100),offset:z.coerce.number().int().min(0).default(0),includeArchived:z.enum(['true','false']).default('false')}).parse(req.query);",'GET params');
 s=replace(s,"FROM creators c LEFT JOIN creator_categories cc ON cc.creator_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`,[q.limit,q.offset]);", "FROM creators c LEFT JOIN creator_categories cc ON cc.creator_id=c.id ${q.includeArchived==='true'?'':'WHERE c.enabled=true'} GROUP BY c.id ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`,[q.limit,q.offset]);",'GET active filter');
 const bulkStart=s.indexOf("adminRoutes.post('/creators/bulk'");const bulkEnd=s.indexOf("adminRoutes.patch('/creators/:id'",bulkStart);
 if(bulkStart<0||bulkEnd<0)throw new Error('Bulk route not found');
 const newCode=`// PCI_REGISTRY_RESET_V1: archive existing YouTube registry without deleting metrics,
// videos, cross-platform links or historical reviews. Owner and exact count required.
adminRoutes.post('/creators/archive-all',roles('owner'),handler(async(req,res)=>{
 const b=z.object({expectedActiveCount:z.number().int().min(0).max(100000),confirmation:z.literal('ARCHIVE ALL ACTIVE CREATORS')}).strict().parse(req.body);
 const actor=adminId(res);
 const result=await transaction(async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock(710324)');
   const count=Number((await tx.query('SELECT count(*)::int AS n FROM creators WHERE enabled=true')).rows[0].n);
   if(count!==b.expectedActiveCount)throw new HttpError(409,'REGISTRY_CHANGED',\x60Active registry has \x24{count} creators, not \x24{b.expectedActiveCount}. Reload and confirm again.\x60);
   const r=await tx.query('UPDATE creators SET enabled=false,featured=false,updated_at=now() WHERE enabled=true RETURNING id');
   await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',
     [actor,'creator.archive_all',null,JSON.stringify({archived:r.rowCount,expectedActiveCount:b.expectedActiveCount})]);
   return r.rowCount??0;
 });
 if(result)await bustPublicCache();
 res.json({data:{archived:result,deleted:0,retainedHistoricalMetrics:true}});
}));

// Reuse the existing YouTube source verification, human-review and category tables.
// Existing active channels stay untouched; archived channels can be restored after
// YouTube verification, and any restored human review status resets to pending.
adminRoutes.post('/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{
 const input=z.array(creator).min(1).max(100).parse(req.body?.creators);
 const unique=new Map<string,typeof input[number]>();
 const duplicateIds:string[]=[];
 for(const item of input){if(unique.has(item.channelId)){duplicateIds.push(item.channelId);continue;}unique.set(item.channelId,item);}
 const items=[...unique.values()];
 const existing=await query<{id:string;channel_id:string;slug:string;enabled:boolean}>(
   'SELECT id,channel_id,slug,enabled FROM creators WHERE channel_id = ANY($1::text[]) OR slug = ANY($2::text[])',
   [items.map(x=>x.channelId),items.map(x=>x.slug)]);
 const byId=new Map(existing.rows.map(x=>[x.channel_id,x]));
 const slugOwner=new Map(existing.rows.map(x=>[x.slug,x.channel_id]));
 const seenSlugs=new Map<string,string>();
 const skipped:string[]=[];const conflicted:{channelId:string;slug:string;existingChannelId:string}[]=[];
 const candidates:typeof items=[];
 for(const item of items){
   const prev=byId.get(item.channelId);
   if(prev?.enabled){skipped.push(item.channelId);continue;}
   // An archived record retains its original slug; do not repurpose a slug owned
   // by another channel. Existing archived identity always keeps its registered slug.
   const effectiveSlug=prev?.slug??item.slug;
   const owner=slugOwner.get(effectiveSlug)??seenSlugs.get(effectiveSlug);
   if(owner && owner!==item.channelId){conflicted.push({channelId:item.channelId,slug:effectiveSlug,existingChannelId:owner});continue;}
   seenSlugs.set(effectiveSlug,item.channelId);
   candidates.push(item);
 }
 if(candidates.length&&!config.YOUTUBE_API_KEY)throw new HttpError(503,'YOUTUBE_UNCONFIGURED','Configure YouTube API key');
 if(candidates.length){
   const yt=new YoutubeClient(),valid=new Set<string>();
   for(const part of chunks(candidates.map(x=>x.channelId),50))for(const c of await yt.channels(part))valid.add(c.id);
   const invalid=candidates.filter(x=>!valid.has(x.channelId)).map(x=>x.channelId);
   if(invalid.length)throw new HttpError(400,'CHANNEL_NOT_FOUND',\x60Unverified YouTube IDs: \x24{invalid.join(', ')}. No records changed.\x60);
 }
 let created=0,reactivated=0;
 try{
   await transaction(async tx=>{
     await tx.query('SELECT pg_advisory_xact_lock(710324)');
     for(const item of candidates){
       const prev=byId.get(item.channelId);
       if(prev&&!prev.enabled){
         const r=await tx.query(\x60UPDATE creators SET enabled=true,featured=$2,description=$3,
           human_review_status='pending',human_reviewed_at=NULL,human_reviewed_by=NULL,updated_at=now()
           WHERE id=$1 AND enabled=false RETURNING id\x60,[prev.id,item.featured,item.description]);
         if(!r.rowCount){skipped.push(item.channelId);continue;}
         // Explicit import categories replace the archived assignments only for reactivated records.
         await tx.query('DELETE FROM creator_categories WHERE creator_id=$1',[prev.id]);
         for(const cid of item.categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[prev.id,cid]);
         reactivated++;continue;
       }
       const r=await tx.query(\x60INSERT INTO creators(channel_id,slug,display_name,description,featured,enabled)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id\x60,
         [item.channelId,item.slug,item.displayName,item.description,item.featured,item.enabled]);
       if(!r.rowCount){skipped.push(item.channelId);continue;}
       created++;
       for(const cid of item.categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[r.rows[0].id,cid]);
     }
   });
 }catch(e:any){if(e.code==='23503')throw new HttpError(400,'CATEGORY_MISSING','Unknown category UUID');throw e;}
 await auditAs(res,'creator.bulk_import_with_restore',null,{created,reactivated,skipped:skipped.length,conflicts:conflicted.length,duplicates:duplicateIds.length});
 if(created||reactivated)await bustPublicCache();
 res.json({data:{created,reactivated,skipped:skipped.length,duplicatesInFile:duplicateIds.length,
   conflicts:conflicted,skippedChannelIds:skipped}});
}));
`;
 s=s.slice(0,bulkStart)+newCode+s.slice(bulkEnd);return s;
});
patch(ui,s=>{
 s=replace(s,"const list=useData<Creator[]>('/admin/creators?limit=250');", "const [showArchived,setShowArchived]=useState(false);\n const list=useData<Creator[]>(\x60/admin/creators?limit=250&includeArchived=\x24{showArchived}\x60);",'list hook');
 s=replace(s,"const [remote,setRemote]=useState(''),[bulk,setBulk]=useState(''),[bulkBusy,setBulkBusy]=useState(false);", "const [remote,setRemote]=useState(''),[bulk,setBulk]=useState(''),[bulkBusy,setBulkBusy]=useState(false);\n const [resetBusy,setResetBusy]=useState(false);",'state');
 const start=s.indexOf(' async function importBulk()');const end=s.indexOf(' return <RoleGate',start);
 if(start<0||end<0)throw new Error('UI bulk logic missing');
 s=s.slice(0,start)+` async function archiveAll(){
  if(!csrf||resetBusy||list.loading||list.error)return;
  const active=(list.data??[]).filter(x=>x.enabled).length;
  if(!active){setError('No active creators to archive.');return;}
  if(!window.confirm(\x60Archive all \x24{active} active YouTube creators? Their statistics, videos, and Instagram links will be preserved.\x60))return;
  const confirm=window.prompt(\x60Type ARCHIVE ALL ACTIVE CREATORS to archive exactly \x24{active} active records:\x60);
  if(confirm!=='ARCHIVE ALL ACTIVE CREATORS')return;
  setResetBusy(true);setError('');setOk('');
  try{
   const r=await api<{archived:number;deleted:number}>('/admin/creators/archive-all',{method:'POST',csrf,body:{expectedActiveCount:active,confirmation:confirm}});
   setOk(\x60Archived \x24{r.archived} creators. No rows permanently deleted.\x60);setShowArchived(false);list.reload();
  }catch(e){setError(errorText(e));}finally{setResetBusy(false);}
 }
 async function importBulk(){if(!csrf)return;setBulkBusy(true);setError('');setOk('');try{
  const raw=JSON.parse(bulk) as unknown;
  if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new Error('Provide a JSON array with 1–100 creator objects.');
  const r=await api<{created:number;reactivated:number;skipped:number;duplicatesInFile:number;conflicts:{channelId:string;slug:string;existingChannelId:string}[]}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(\x60Created \x24{r.created}, restored \x24{r.reactivated}, skipped \x24{r.skipped}, duplicates \x24{r.duplicatesInFile}, conflicts \x24{r.conflicts.length}.\x60);
  if(r.conflicts.length)setError(r.conflicts.map(c=>\x60Slug \x24{c.slug}: \x24{c.channelId} conflicts with \x24{c.existingChannelId}\x60).join(' | '));
  else setBulk('');
  list.reload();
 }catch(e){setError(errorText(e));}finally{setBulkBusy(false);}}
`+s.slice(end);
 s=replace(s,'<Card><h2 className="admin-box-title">Bulk import</h2>',`<Card><h2 className="admin-box-title">Registry reset and bulk import</h2>
   <p className="fineprint">Archive every active YouTube creator (owner only). Preserves database history and Instagram links. Re-imported channels are verified and returned to pending human review.</p>
   {identity?.role==='owner'&&<button type="button" className="btn btn-secondary" disabled={resetBusy||list.loading||!!list.error||showArchived} onClick={archiveAll}>{resetBusy?'Archiving…':'Archive all active YouTube creators'}</button>}`,'archive button');
 s=replace(s,'<h2>Configured creators ({rows.length})</h2>',`<h2>{showArchived?'All creators (including archived)':'Active creators'} ({rows.length})</h2><button type="button" className="btn btn-secondary" onClick={()=>setShowArchived(x=>!x)}>{showArchived?'Hide archived':'Show archived'}</button>`,'toggle');
 return s;
});
console.log('Patch finished. Run npm test/build in Module 1 and typecheck/build in Module 3.');
