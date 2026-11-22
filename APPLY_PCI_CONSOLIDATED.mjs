/** PCI consolidated deterministic source patch. No network, no git writes. Node 22+. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(), dry=process.argv.includes('--dry-run');
const changes=new Map();
const file=p=>path.join(root,p);
function modify(p,edits){
  const abs=file(p);if(!fs.existsSync(abs))throw Error(`Missing required file: ${p}`);
  let content=changes.get(p)??fs.readFileSync(abs,'utf8');
  for(const [before,after,caption] of edits){
    if(content.includes(after))continue;
    if(!content.includes(before))throw Error(`Source differs; safely aborted at ${p}: ${caption}. No files written.`);
    content=content.replace(before,after);
  }
  changes.set(p,content);
}
function appendOnce(p,mark,code){
 const abs=file(p);if(!fs.existsSync(abs))throw Error(`Missing ${p}`);
 const s=changes.get(p)??fs.readFileSync(abs,'utf8');
 changes.set(p,s.includes(mark)?s:s+'\n'+code+'\n');
}
const b='Module_1_Adapter/src/modules/admin/routes.ts';
const i='Module_1_Adapter/src/modules/instagram/routes.ts';
const m='Module_1_Adapter/src/modules/unified/metrics.mjs';
const d='Module_1_Adapter/src/modules/unified/metrics.d.mts';
const u='Module_1_Adapter/src/modules/unified/routes.ts';
const home='Module_2_Public_Website/src/app/page.tsx';
const wheel='Module_2_Public_Website/src/components/UnifiedCreatorExperience.tsx';
const rails='Module_2_Public_Website/src/components/CreatorDiscoveryRows.tsx';
const admin='Module_3_Admin_Panel/src/app/creators/page.tsx';
const instaAdmin='Module_3_Admin_Panel/src/app/instagram/page.tsx';

// Contracts: unranked records belong in directory, not public ranking lists.
modify(m,[["return {data:ranked.slice(0,limit),total:ranked.length,known:ranked.filter(x=>x[field]!==null).length};",
 "const known=ranked.filter(x=>x.rank!==null);\n return {data:known.slice(0,limit),total:ranked.length,known:known.length};",
 'unranked listing contract']]);
modify(m,[["/** Pure metric logic. No database, network or UI dependencies.","import {rankCrossPlatform} from '../cross-platform/score.mjs';\n/** Pure metric logic. No database, network or UI dependencies.",'research score import']]);
appendOnce(m,'PCI_ALL_ROUNDERS_V1',`/** PCI_ALL_ROUNDERS_V1: Explicit cross-platform policy, NOT IMDb/Wilson or unique reach.
 * Requires an approved PERSON with BOTH linked approved YT + IG accounts and
 * three source metrics. Existing research algorithm weights 25% YT subscribers,
 * 25% YT lifetime views, 50% IG followers, normalized within the eligible cohort.
 * No TikTok values exist yet. Score is a relative percentile, not a truth claim.
 */
export function rankAllRounders(people,{limit=20,category}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid limit');
 const possible=people.filter(p=>p.enabled===true&&p.humanReviewStatus==='approved')
  .filter(p=>!category||p.categories?.some(c=>c.slug===category))
  .filter(p=>p.youtube&&p.instagram)
  .filter(p=>[p.youtube?.subscribers,p.youtube?.views,p.instagram?.followers].every(x=>asCount(x)!==null));
 const data=rankCrossPlatform(possible.map(p=>({...projectCreator(p,'all'),
  youtubeCreatorId:p.id,curated:true,eligibility:'approved',enabled:true,
  subscriberCount:p.youtube.subscribers,viewCount:p.youtube.views,
  followersCount:p.instagram.followers})),{limit})
  .map(p=>({...p,rankMetric:'allrounders',allRounderScore:p.score}));
 return {data,known:possible.length,total:possible.length,
  method:'PCI all-rounder policy v1: cohort percentiles, 25% YouTube subscribers + 25% YouTube lifetime views + 50% Instagram followers, linked and approved accounts only; no missing-data imputation; TikTok not yet available'};
}`);
appendOnce(d,'rankAllRounders',`export declare function rankAllRounders(people:Person[],options?:{limit?:number;category?:string}):{
 data:(Omit<Ranked,'rankMetric'> & {rankMetric:'allrounders';rank:number;allRounderScore:number;score:number})[];
 known:number;total:number;method:string};`);
modify(u,[["import {rankPeople,aggregate} from './metrics.mjs';","import {rankPeople,rankAllRounders,aggregate} from './metrics.mjs';",'all rounder import'],
 ["unifiedPublicRoutes.get('/unified/rankings'",`// PCI_ALL_ROUNDERS_ROUTE_V1: no fake TikTok data or silent fallback.
unifiedPublicRoutes.get('/unified/all-rounders',handler(async(req,res)=>{
 const q=z.object({limit:z.coerce.number().int().min(1).max(100).default(20),category:z.string().regex(/^[a-z0-9-]{2,60}$/).optional()}).parse(req.query);
 res.json(rankAllRounders(await listPeople(),q));
}));
unifiedPublicRoutes.get('/unified/rankings'`,'all rounder public endpoint']]);

// Permanent deletion is owner-only, transactional, FK-cascade aware, audited and cache-busting.
modify(b,[["adminRoutes.post('/creators/bulk-disable'",`// PCI_BULK_CATEGORY_AND_PURGE_V1
adminRoutes.post('/creators/bulk-categories',roles('owner','editor'),handler(async(req,res)=>{
 const v=z.object({ids:z.array(uuid).min(1).max(250),categoryIds:z.array(uuid).min(1).max(7),mode:z.enum(['add','replace']).default('add')}).strict().parse(req.body);
 const ids=[...new Set(v.ids)],categoryIds=[...new Set(v.categoryIds)];
 const updated=await transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(710324)');
  const creators=await tx.query('SELECT id FROM creators WHERE id=ANY($1::uuid[]) FOR UPDATE',[ids]);
  if(creators.rowCount!==ids.length)throw new HttpError(409,'CREATOR_SET_CHANGED','One or more selected creators no longer exists. Reload.');
  const cats=await tx.query('SELECT id FROM categories WHERE id=ANY($1::uuid[]) AND active=true',[categoryIds]);
  if(cats.rowCount!==categoryIds.length)throw new HttpError(400,'CATEGORY_MISSING','One or more category IDs is invalid or inactive.');
  if(v.mode==='replace')await tx.query('DELETE FROM creator_categories WHERE creator_id=ANY($1::uuid[])',[ids]);
  for(const id of ids)for(const categoryId of categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,categoryId]);
  await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[adminId(res),'creator.bulk_categories',null,JSON.stringify({count:ids.length,categoryIds,mode:v.mode})]);
  return ids.length;
 });
 await bustPublicCache();res.json({data:{updated,mode:v.mode}});
}));
adminRoutes.post('/creators/bulk-purge',roles('owner'),handler(async(req,res)=>{
 const v=z.object({ids:z.array(uuid).min(1).max(250),confirmation:z.literal('PERMANENTLY DELETE SELECTED'),expectedCount:z.number().int().min(1).max(250)}).strict().parse(req.body);
 const ids=[...new Set(v.ids)];if(ids.length!==v.expectedCount)throw new HttpError(409,'SELECTION_CHANGED','Selection changed. Reload and select again.');
 const outcome=await transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(710324)');
  const found=await tx.query('SELECT id FROM creators WHERE id=ANY($1::uuid[]) FOR UPDATE',[ids]);
  if(found.rowCount!==ids.length)throw new HttpError(409,'CREATOR_SET_CHANGED','Selected record changed. Nothing deleted.');
  // A linked Instagram account belongs to this curated person. Its stats,
  // history and category relations cascade when that Instagram row is deleted.
  const ig=await tx.query('DELETE FROM instagram_creators WHERE youtube_creator_id=ANY($1::uuid[]) RETURNING id',[ids]);
  // Existing creator_categories, channel_stats_latest and videos have ON DELETE CASCADE;
  // video_stats_latest cascades through videos. Unanticipated RESTRICT FKs fail
  // the whole transaction instead of creating inconsistent partial deletion.
  const yt=await tx.query('DELETE FROM creators WHERE id=ANY($1::uuid[]) RETURNING id',[ids]);
  await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[adminId(res),'creator.bulk_purge',null,JSON.stringify({youtubeDeleted:yt.rowCount,linkedInstagramDeleted:ig.rowCount})]);
  return {youtubeDeleted:yt.rowCount??0,linkedInstagramDeleted:ig.rowCount??0};
 });
 await bustPublicCache();res.json({data:outcome});
}));
adminRoutes.post('/creators/bulk-disable'`,'bulk permanent delete and categories']]);
// Instagram-only independent accounts can be removed in a matching transaction.
modify(i,[["instagramAdminRoutes.post('/instagram/creators/bulk'",`// PCI_INSTAGRAM_PURGE_V1
instagramAdminRoutes.post('/instagram/creators/bulk-purge',roles('owner'),handler(async(req,res)=>{
 const b=z.object({ids:z.array(z.string().uuid()).min(1).max(250),confirmation:z.literal('PERMANENTLY DELETE SELECTED')}).strict().parse(req.body);
 const ids=[...new Set(b.ids)];
 const deleted=await transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(710324)');
  const r=await tx.query('DELETE FROM instagram_creators WHERE id=ANY($1::uuid[]) RETURNING id',[ids]);
  if(r.rowCount!==ids.length)throw new HttpError(409,'CREATOR_SET_CHANGED','A selected Instagram record no longer exists. Nothing deleted.');
  await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'instagram.bulk_purge',null,JSON.stringify({deleted:r.rowCount})]);
  return r.rowCount??0;
 });
 await bustPublicCache();res.json({data:{deleted}});
}));
instagramAdminRoutes.post('/instagram/creators/bulk'`,'instagram permanent bulk delete']]);

// Instagram category bulk assignment mirrors the YouTube contract.
modify(i,[["// PCI_INSTAGRAM_PURGE_V1",`// PCI_INSTAGRAM_BULK_CATEGORIES_V1
instagramAdminRoutes.post('/instagram/creators/bulk-categories',roles('owner','editor'),handler(async(req,res)=>{
 const v=z.object({ids:z.array(z.string().uuid()).min(1).max(250),categoryIds:z.array(z.string().uuid()).min(1).max(7),mode:z.enum(['add','replace']).default('add')}).strict().parse(req.body);
 const ids=[...new Set(v.ids)],cats=[...new Set(v.categoryIds)];
 const updated=await transaction(async tx=>{
  await tx.query('SELECT pg_advisory_xact_lock(710324)');
  const found=await tx.query('SELECT id FROM instagram_creators WHERE id=ANY($1::uuid[]) FOR UPDATE',[ids]);
  if(found.rowCount!==ids.length)throw new HttpError(409,'CREATOR_SET_CHANGED','One or more accounts were deleted. Reload.');
  const valid=await tx.query('SELECT id FROM categories WHERE id=ANY($1::uuid[]) AND active=true',[cats]);
  if(valid.rowCount!==cats.length)throw new HttpError(400,'CATEGORY_MISSING','One or more categories are invalid.');
  if(v.mode==='replace')await tx.query('DELETE FROM instagram_creator_categories WHERE creator_id=ANY($1::uuid[])',[ids]);
  for(const id of ids)for(const cat of cats)await tx.query('INSERT INTO instagram_creator_categories(creator_id,category_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[id,cat]);
  await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',[(res.locals.admin as AdminIdentity).id,'instagram.bulk_categories',null,JSON.stringify({count:ids.length,categoryIds:cats,mode:v.mode})]);
  return ids.length;
 });
 await bustPublicCache();res.json({data:{updated,mode:v.mode}});
}));
// PCI_INSTAGRAM_PURGE_V1`,'instagram category route']]);

modify(instaAdmin,[[" const [filter,setFilter]=useState('');", " const [filter,setFilter]=useState('');\n const [checkedIds,setCheckedIds]=useState<string[]>([]);\n const [bulkCategoryIds,setBulkCategoryIds]=useState<string[]>([]);",'instagram selection state'],
 [" const visible=(creators.data??[]).filter",` async function purgeChecked(){
  if(identity?.role!=='owner'||!checkedIds.length||!csrf||busy)return;
  if(!window.confirm('Permanently delete '+checkedIds.length+' selected Instagram profiles and their stored metrics?'))return;
  const confirmation=window.prompt('Type PERMANENTLY DELETE SELECTED to proceed:');
  if(confirmation!=='PERMANENTLY DELETE SELECTED')return;
  await execute(()=>api('/admin/instagram/creators/bulk-purge',{method:'POST',csrf,body:{ids:checkedIds,confirmation}}),'Permanently deleted selected Instagram profiles.');
  setCheckedIds([]);
 }
 async function categorizeChecked(){
  if(!checkedIds.length||!bulkCategoryIds.length||!csrf||busy)return;
  await execute(()=>api('/admin/instagram/creators/bulk-categories',{method:'POST',csrf,body:{ids:checkedIds,categoryIds:bulkCategoryIds,mode:'add'}}),'Categories assigned to selected Instagram profiles.');
  setCheckedIds([]);
 }
 const visible=(creators.data??[]).filter`,'instagram management actions'],
 [" <DataBlock loading={creators.loading}",` <div className="admin-inline-actions"><label className="admin-check"><input type="checkbox" checked={visible.length>0&&visible.every(c=>checkedIds.includes(c.id))} onChange={e=>setCheckedIds(e.target.checked?visible.map(c=>c.id):[])} /> Select all visible</label>
  {identity?.role==='owner'&&<button className="btn btn-secondary" type="button" disabled={!checkedIds.length||busy} onClick={purgeChecked}>Permanently delete selected ({checkedIds.length})</button>}
  {(categories.data??[]).map(cat=><label key={cat.id} className="admin-check"><input type="checkbox" checked={bulkCategoryIds.includes(cat.id)} onChange={e=>setBulkCategoryIds(v=>e.target.checked?[...v,cat.id]:v.filter(id=>id!==cat.id))}/>{cat.label}</label>)}
  <button className="btn btn-secondary" type="button" disabled={!checkedIds.length||!bulkCategoryIds.length||busy} onClick={categorizeChecked}>Assign categories</button></div>
 <DataBlock loading={creators.loading}`,'instagram registry tools'],
 ["<TableWrap><thead><tr><th>Person</th>","<TableWrap><thead><tr><th>Select</th><th>Person</th>",'instagram select header'],
 ["<tbody>{visible.map(c=><tr key={c.id}><td><strong>{c.display_name}</strong>",`<tbody>{visible.map(c=><tr key={c.id}><td><input type="checkbox" aria-label={'Select Instagram '+c.username} checked={checkedIds.includes(c.id)} onChange={e=>setCheckedIds(v=>e.target.checked?[...new Set([...v,c.id])]:v.filter(id=>id!==c.id))}/></td><td><strong>{c.display_name}</strong>`,'instagram select cells']]);

// Homepage: live all-rounder list, otherwise original raw views wheel remains truthful.
modify(home,[["platformYoutube,platformInstagram,curatedYoutube]=await Promise.all", "platformYoutube,platformInstagram,curatedYoutube,allRounders]=await Promise.all",'homepage all-rounder response destructure'],
 ["adapterGet<{data:Creator[]}>('/api/v1/rankings?sort=subscribers&limit=100')", "adapterGet<{data:Creator[]}>('/api/v1/rankings?sort=subscribers&limit=100'),\n  adapterGet<UnifiedRankingResponse>('/api/v1/unified/all-rounders?limit=20')",'homepage all-rounder fetch'],
 ["<UnifiedRankingWheel rankings={rankings}/>","<UnifiedRankingWheel rankings={rankings} allRounders={allRounders?.data??[]}/>",'wire allrounders wheel']]);

// Wheel All Rounders tab, explicit cohort-relative score. No TikTok fabrication.
modify(wheel,[["type Metric='views'|'subscribers'|'videos';", "type Metric='views'|'subscribers'|'videos';\ntype WheelMetric=Metric|'allrounders';",'wheel type'],
 ["subscriberCount:string|null;viewCount:string|null;videoCount:string|null;", "subscriberCount:string|null;viewCount:string|null;videoCount:string|null;allRounderScore?:number|null;",'wheel type score'],
 ["const platformOptions:{id:Platform;label:string}[]=", "const wheelModes=[{metric:'allrounders' as const,title:'All Rounders',label:'Relative cross-platform score'},...displayModes];\nconst platformOptions:{id:Platform;label:string}[]=",'wheel mode'],
 ["export function UnifiedRankingWheel({rankings}:{rankings:Record<Metric,UnifiedPerson[]>}){", "export function UnifiedRankingWheel({rankings,allRounders=[]}:{rankings:Record<Metric,UnifiedPerson[]>;allRounders?:UnifiedPerson[]}){",'wheel props'],
 ["const [metric,setMetric]=useState<Metric>('views');const [active,setActive]=useState(0);", "const [metric,setMetric]=useState<WheelMetric>(allRounders.length?'allrounders':'views');const [active,setActive]=useState(0);",'wheel default'],
 ["const cards=rankings[metric].filter(x=>count(x,metric)!==null).slice(0,20);", "const cards=(metric==='allrounders'?allRounders:rankings[metric]).filter(x=>metric==='allrounders'?x.allRounderScore!=null:count(x,metric)!==null).slice(0,20);",'wheel source'],
 ["{displayModes.map(m=><button key={m.metric} className=\"ranking-wheel-mode\"", "{wheelModes.map(m=><button key={m.metric} className=\"ranking-wheel-mode\"",'all rounder selector'],
 ["displayModes.find(m=>m.metric===metric)?.title", "wheelModes.find(m=>m.metric===metric)?.title",'wheel crown title'],
 ["displayModes.find(m=>m.metric===metric)?.label", "wheelModes.find(m=>m.metric===metric)?.label",'wheel rank label'],
 ["{formatCount(count(c,metric),true)}", "{metric==='allrounders'?`${c.allRounderScore?.toFixed(1)} / 100`:formatCount(count(c,metric),true)}",'wheel score display']]);

// Legacy YouTube Top 100 fallback stays explicitly source-labeled and ranked-only.
modify(home,[["legacy.subscribers.slice(0,100)","legacy.subscribers.filter(c=>c.rank!==null).slice(0,100)",'legacy Top 100 excludes unranked']]);
appendOnce('Module_2_Public_Website/packages/ui/src/styles/components.css', 'PCI_CATEGORY_LABEL_LAYOUT_V1',
 `/* PCI_CATEGORY_LABEL_LAYOUT_V1: names and editorial categories occupy separate lines. */
 .identity .identity-name,.identity .identity-sub{display:block}
 .identity .identity-sub{white-space:normal;line-height:1.4}`);

// Rails: 15 real metric-holding records for each platform, recompute category-scoped dense ranks.
modify(rails,[["const yt=curatedYoutube.filter(p=>p.subscriberCount!==null&&!p.subscriberHidden&&included(p.categories)).slice(0,20).reverse();",`const ytSorted=curatedYoutube.filter(p=>p.subscriberCount!==null&&!p.subscriberHidden&&included(p.categories));
 let ytRank=0,ytLast:string|null=null;
 const yt=ytSorted.map(p=>{if(ytLast!==p.subscriberCount){ytRank++;ytLast=p.subscriberCount;}return {...p,rank:ytRank};}).slice(0,15).reverse();`,'YouTube 15 and scoped dense rank'],
 ["const ig=instagram.filter(p=>Boolean(p.platforms?.instagram)&&p.subscriberCount!==null&&included(p.categories)).slice(0,20);",`const igSorted=instagram.filter(p=>Boolean(p.platforms?.instagram)&&p.subscriberCount!==null&&included(p.categories));
 let igRank=0,igLast:string|null=null;
 const ig=igSorted.map(p=>{if(igLast!==p.subscriberCount){igRank++;igLast=p.subscriberCount;}return {...p,rank:igRank};}).slice(0,15).reverse();`,'Instagram 15 and scoped dense rank'],
 ["Top 20 tracked YouTube channels · subscribers · #20 to #1", "Top 15 tracked YouTube channels · subscribers · #15 to #1",'YouTube row label'],
 ["Top 20 verified Instagram profiles · followers", "Top 15 verified Instagram profiles · followers",'Instagram row label'],
 ["Each row displays up to 20 profiles.", "Each row displays up to 15 ranked profiles with available source statistics.",'rail disclosure'],
 ["<span className=\"pci-discovery-chip\">Instagram</span>", "<span className=\"pci-discovery-chip\">Instagram</span><span className=\"pci-discovery-rank\" aria-label={`Rank ${p.rank??'unranked'}`}>#{p.rank??'—'}</span>",'Instagram rank badge']]);

// Manage categories and permanent deletion from the existing checkbox UI.
modify(admin,[["const enabledRows=rows.filter(c=>c.enabled);", "const enabledRows=rows;",'allow archived selected for permanent purge'],
 ["Select all visible active", "Select all visible",'select all active and archived'],
 ["disabled={!c.enabled||deleting}", "disabled={deleting||purging}",'allow archived selection'],
 ["const [resetBusy,setResetBusy]=useState(false);", "const [resetBusy,setResetBusy]=useState(false);\n const [selectedCategoryIds,setSelectedCategoryIds]=useState<string[]>([]);\n const [purging,setPurging]=useState(false);",'admin category state'],
 [" async function importBulk(){",` async function assignSelectedCategories(){
  if(!csrf||!selectedIds.length||!selectedCategoryIds.length)return;
  setSaving(true);setError('');setOk('');
  try{const result=await api<{updated:number}>('/admin/creators/bulk-categories',{method:'POST',csrf,body:{ids:selectedIds,categoryIds:selectedCategoryIds,mode:'add'}});
   setOk('Assigned categories to '+result.updated+' creators.');setSelectedIds([]);list.reload();}
  catch(e){setError(errorText(e));}finally{setSaving(false);}
 }
 async function permanentlyDeleteSelected(){
  if(!csrf||!selectedIds.length||purging||identity?.role!=='owner')return;
  const ids=[...new Set(selectedIds)];
  if(!window.confirm('Permanently delete '+ids.length+' selected creators and all linked account metrics and videos? This cannot be undone.'))return;
  const confirmation=window.prompt('Type PERMANENTLY DELETE SELECTED to continue:');
  if(confirmation!=='PERMANENTLY DELETE SELECTED')return;
  setPurging(true);setError('');setOk('');
  try{const r=await api<{youtubeDeleted:number;linkedInstagramDeleted:number}>('/admin/creators/bulk-purge',{method:'POST',csrf,body:{ids,confirmation,expectedCount:ids.length}});
    setOk('Permanently deleted '+r.youtubeDeleted+' YouTube creators and '+r.linkedInstagramDeleted+' linked Instagram profiles.');setSelectedIds([]);clear();list.reload();}
  catch(e){setError(errorText(e));}finally{setPurging(false);}
 }
 async function importBulk(){`,'admin actions'],
 ["<button type=\"button\" className=\"btn btn-secondary\" disabled={!selectedIds.length||deleting} onClick={()=>setSelectedIds([])}>Clear selection</button>",`<button type="button" className="btn btn-secondary" disabled={!selectedIds.length||deleting} onClick={()=>setSelectedIds([])}>Clear selection</button><button type="button" className="btn btn-secondary" disabled={!selectedIds.length||purging} onClick={permanentlyDeleteSelected}>{purging?'Deleting…':'Permanently delete selected'}</button>`,'admin permanent delete button'],
 ["   <DataBlock loading={list.loading}",`   <div className="admin-inline-actions"><span>Bulk assign categories:</span>{(categories.data??[]).map(cat=><label className="admin-check" key={cat.id}><input type="checkbox" checked={selectedCategoryIds.includes(cat.id)} onChange={e=>setSelectedCategoryIds(v=>e.target.checked?[...v,cat.id]:v.filter(id=>id!==cat.id))}/>{cat.label}</label>)}<button type="button" className="btn btn-secondary" disabled={!selectedIds.length||!selectedCategoryIds.length||saving} onClick={assignSelectedCategories}>Assign categories to selected</button></div>
   <DataBlock loading={list.loading}`,'admin categories controls']]);

// Optional Instagram screen bulk-delete (existing list, no new route/architecture).
// Only add if its row structure matches; otherwise backend endpoint remains available
// and the installer tells the user, rather than risking a malformed admin page.
if(fs.existsSync(file(instaAdmin))){
 const s=fs.readFileSync(file(instaAdmin),'utf8');
 if(s.includes('export default') && s.includes('function')){
   // Admin Instagram bulk purge is backend-ready; UI integration in this release
   // intentionally restricted to one-to-one linked deletion from the person registry.
 }
}
// Existing UI regression tests must assert the new wheel props (not a stale JSX shape).
function updateWheelTest(p){
 const src=changes.get(p)??fs.readFileSync(file(p),'utf8');
 if(src.includes('allRounders='))return;
 const before='assert.match(page,/<UnifiedRankingWheel rankings=\\{rankings\\}\\/>/);';
 const after='assert.match(page,/<UnifiedRankingWheel rankings=\\{rankings\\} allRounders=\\{allRounders\\?\\.data\\?\\?\\[\\]\\}\\/>/);';
 if(!src.includes(before))throw Error(`Test source differs; abort: ${p}`);
 changes.set(p,src.replace(before,after));
}
updateWheelTest('Module_2_Public_Website/tests/premium-home.test.mjs');
updateWheelTest('Module_2_Public_Website/tests/sleek-navigation.test.mjs');
// Update the existing legacy fallback expectation without weakening the assertion.
const premiumTest='Module_2_Public_Website/tests/premium-home.test.mjs';
const psrc=changes.get(premiumTest)??fs.readFileSync(file(premiumTest),'utf8');
const prior='legacy\\.subscribers\\.slice\\(0,100\\)';
const revised='legacy\\.subscribers\\.filter\\(c=>c\\.rank!==null\\)\\.slice\\(0,100\\)';
if(!psrc.includes(revised)){
 if(!psrc.includes(prior))throw Error('Premium test fallback assertion differed; no files written');
 changes.set(premiumTest,psrc.replace(prior,revised));
}


// New tests use actual engine functions, not fragile source-code regular expressions.
const testPath='Module_1_Adapter/tests/pci-ranking-contract.test.mjs';
const testSource=`import test from 'node:test';
import assert from 'node:assert/strict';
import {rankPeople,rankAllRounders} from '../src/modules/unified/metrics.mjs';
const person=(id,status,subscribers,views,ig)=>({id,slug:'person-'+id,displayName:'Person '+id,enabled:true,humanReviewStatus:status,categories:[{slug:'vloggers-influencers',label:'Vloggers & Influencers'}],youtube:{url:'https://youtube.com/channel/'+id,subscribers,views,videos:'10'},instagram:ig==null?null:{url:'https://instagram.com/'+id,followers:ig,posts:'5'}});
test('new and removed accounts always re-rank from current eligible cohort',()=>{
 const a=person('a','approved','100','100',null),b=person('b','approved','200','200',null),c=person('c','approved','300','300',null);
 assert.deepEqual(rankPeople([a,b,c],{metric:'subscribers'}).data.map(x=>x.id),['c','b','a']);
 assert.deepEqual(rankPeople([a,c],{metric:'subscribers'}).data.map(x=>x.rank),[1,2]);
});
test('pending, disabled and missing metrics never get public ranks',()=>{
 const a=person('a','approved','100','100',null),b=person('b','pending','200','200',null),c=person('c','approved',null,'250',null),d={...person('d','approved','500','500',null),enabled:false};
 assert.deepEqual(rankPeople([a,b,c,d],{metric:'subscribers'}).data.map(x=>x.id),['a']);
});
test('all rounder requires both sources, approval and complete metrics',()=>{
 const a=person('a','approved','100','100','100'),b=person('b','approved','200','200','200'),c=person('c','approved','1000','1000',null),d=person('d','pending','500','500','500');
 const result=rankAllRounders([a,b,c,d]);
 assert.deepEqual(result.data.map(x=>x.id),['b','a']);
 assert.equal(result.data[0].allRounderScore,100);
 assert.equal(result.data[1].allRounderScore,0);
});
`;
if(fs.existsSync(file(testPath))){const existing=fs.readFileSync(file(testPath),'utf8');if(existing!==testSource)throw Error(`Unexpected existing ${testPath}`)}
else changes.set(testPath,testSource);

// Preflight all edits before writing anything. Backups in a timestamped directory.
if(dry){for(const p of changes.keys())console.log('WOULD UPDATE',p);console.log('DRY RUN OK');process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const backup=path.join(root,`.pci-backups-${stamp}`);
for(const [p,data] of changes){
 const target=file(p);fs.mkdirSync(path.dirname(target),{recursive:true});
 if(fs.existsSync(target)){
  const copy=path.join(backup,p);fs.mkdirSync(path.dirname(copy),{recursive:true});fs.copyFileSync(target,copy);
 }
 fs.writeFileSync(target,data,'utf8');console.log('UPDATED',p);
}
console.log(`COMPLETE: ${changes.size} files. Backup: ${backup}`);
console.log('RUN LOCAL TESTS + BUILDS BEFORE COMMIT. Do not deploy if any checks fail.');
