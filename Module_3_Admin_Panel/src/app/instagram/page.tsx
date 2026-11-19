'use client';
import {useState} from 'react';
import {Card} from '@pci/ui';
import {AdminPage,RoleGate,Status,DataBlock,TableWrap,useData} from '@/components/Shared';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';

type Category={id:string;label:string};
type YoutubeCreator={id:string;display_name:string};
type Creator={id:string;youtube_creator_id:string|null;username:string;display_name:string;slug:string;eligibility:'pending'|'approved'|'rejected';human_attested:boolean;category_ids:string[];followers_count:string|null;media_count:string|null;fetched_at:string|null;error_code:string|null;enabled:boolean};
type Form={username:string;displayName:string;slug:string;biography:string;categoryIds:string[];enabled:boolean;youtubeCreatorId:string|null};
const fresh:Form={username:'',displayName:'',slug:'',biography:'',categoryIds:[],enabled:true,youtubeCreatorId:null};
export default function InstagramManagement(){
 const {identity}=useAuth(),csrf=identity?.csrfToken;
 const creators=useData<Creator[]>('/admin/instagram/creators');
 const categories=useData<Category[]>('/admin/categories');
 const youtube=useData<YoutubeCreator[]>('/admin/creators?limit=250');
 const [form,setForm]=useState<Form>(fresh),[bulk,setBulk]=useState(''),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[ok,setOk]=useState('');
 const [filter,setFilter]=useState('');
 const [checkedIds,setCheckedIds]=useState<string[]>([]);
 const [bulkCategoryIds,setBulkCategoryIds]=useState<string[]>([]);
 const reload=()=>creators.reload();
 async function execute(action:()=>Promise<unknown>,success:string){
  setBusy(true);setError('');setOk('');
  try{await action();setOk(success);reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function add(e:React.FormEvent){
  e.preventDefault();
  await execute(()=>api('/admin/instagram/creators',{method:'POST',csrf,body:form}),
   'Profile added to pending review; not publicly ranked.');
  // Deliberately retain form on failure; clear only if server has reloaded.
 }
 async function importBulk(){
  setBusy(true);setError('');setOk('');
  try{
   const raw=JSON.parse(bulk) as unknown;
   if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new Error('Import 1â€“100 profile objects.');
   const result=await api<{created:number;skipped:number;duplicatesInFile:number}>('/admin/instagram/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
   setOk(`Added ${result.created}; skipped ${result.skipped} existing profiles and ${result.duplicatesInFile} duplicate usernames in this JSON.`);
   setBulk('');reload();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function review(c:Creator,decision:'approved'|'rejected'){
  const confirmation=decision==='approved'
   ?`Confirm @${c.username} is an individual human content creator (not a company, brand, collective, or generic channel)?`
   :`Reject @${c.username} from the curated list?`;
  if(decision==='approved'&&!c.youtube_creator_id){setError('Link this Instagram account to an existing YouTube creator before approval.');return;}
  if(!window.confirm(confirmation))return;
  await execute(()=>api(`/admin/instagram/creators/${c.id}/review`,{method:'POST',csrf,body:{decision,humanAttested:decision==='approved'}}),
  decision==='approved'?'Human creator approved for ranking.':'Profile rejected.');
 }
 async function purgeChecked(){
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
 const visible=(creators.data??[]).filter(c=>`${c.username} ${c.display_name}`.toLowerCase().includes(filter.toLowerCase()));
 return <RoleGate roles={['owner','editor']}><AdminPage title="Instagram creators" description="Curate individual human creators only. Businesses, companies, brands, organizations and generic channels are prohibited. Imports remain private until individually approved." action={<button className="btn btn-secondary" onClick={()=>{reload();categories.reload();}}>Reload</button>}>
 <Status error={error} ok={ok}/>
 <div className="admin-panel-grid">
 <Card><h2>Add individual</h2><form className="form" onSubmit={add}>
  <div className="field"><label htmlFor="ig-username">Instagram username</label><input id="ig-username" value={form.username} required pattern="[A-Za-z0-9._]{1,30}" onChange={e=>setForm(p=>({...p,username:e.target.value.toLowerCase().replace(/^@/,'')}))} placeholder="individual.username"/></div>
  <div className="field"><label htmlFor="ig-name">Person's name</label><input id="ig-name" value={form.displayName} required onChange={e=>setForm(p=>({...p,displayName:e.target.value}))}/></div>
  <div className="field"><label htmlFor="ig-slug">Slug</label><input id="ig-slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={e=>setForm(p=>({...p,slug:e.target.value}))}/></div>
  <div className="field"><label htmlFor="ig-youtube">Linked YouTube creator (required for approval)</label><select id="ig-youtube" value={form.youtubeCreatorId??''} onChange={e=>setForm(p=>({...p,youtubeCreatorId:e.target.value||null}))}><option value="">Select a verified human YouTuber</option>{(youtube.data??[]).map(c=><option key={c.id} value={c.id}>{c.display_name}</option>)}</select></div>
  <div className="field"><label htmlFor="ig-bio">Description</label><textarea id="ig-bio" value={form.biography} onChange={e=>setForm(p=>({...p,biography:e.target.value}))}/></div>
  <fieldset className="admin-fieldset"><legend>Categories</legend><div className="admin-check-grid">{(categories.data??[]).map(c=><label className="admin-check" key={c.id}><input type="checkbox" checked={form.categoryIds.includes(c.id)} onChange={e=>setForm(p=>({...p,categoryIds:e.target.checked?[...p.categoryIds,c.id]:p.categoryIds.filter(id=>id!==c.id)}))}/>{c.label}</label>)}</div></fieldset>
  <button className="btn btn-primary" disabled={busy}>Add for human review</button>
 </form></Card>
 <Card><h2>Bulk profile import</h2><p className="muted text-sm">JSON array, up to 100 records. New entries remain pending, never automatically ranked. Existing profiles are skipped without changes. Category IDs must already exist.</p>
 <div className="field"><label htmlFor="ig-bulk">JSON profiles</label><textarea id="ig-bulk" className="admin-code" rows={10} value={bulk} onChange={e=>setBulk(e.target.value)} placeholder={'[{"username":"human_creator","displayName":"Human Creator","slug":"human-creator","categoryIds":[]}]'}/></div>
 <button className="btn btn-primary" disabled={busy||!bulk.trim()} onClick={importBulk}>Validate and import</button>
 <p className="fineprint">Human eligibility must be reviewed per profile after importing; no automatic approval.</p>
 </Card></div>
 <Card><div className="admin-toolbar"><h2>Instagram registry ({visible.length})</h2>
 <div className="field"><label htmlFor="ig-search">Search profiles</label><input id="ig-search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Username or name"/></div>
 <button className="btn btn-secondary" disabled={busy} onClick={()=>execute(()=>api('/admin/instagram/sync',{method:'POST',csrf}), 'Instagram refresh complete.')}>Refresh approved profiles</button></div>
 <div className="admin-inline-actions"><label className="admin-check"><input type="checkbox" checked={visible.length>0&&visible.every(c=>checkedIds.includes(c.id))} onChange={e=>setCheckedIds(e.target.checked?visible.map(c=>c.id):[])} /> Select all visible</label>
  {identity?.role==='owner'&&<button className="btn btn-secondary" type="button" disabled={!checkedIds.length||busy} onClick={purgeChecked}>Permanently delete selected ({checkedIds.length})</button>}
  {(categories.data??[]).map(cat=><label key={cat.id} className="admin-check"><input type="checkbox" checked={bulkCategoryIds.includes(cat.id)} onChange={e=>setBulkCategoryIds(v=>e.target.checked?[...v,cat.id]:v.filter(id=>id!==cat.id))}/>{cat.label}</label>)}
  <button className="btn btn-secondary" type="button" disabled={!checkedIds.length||!bulkCategoryIds.length||busy} onClick={categorizeChecked}>Assign categories</button></div>
 <DataBlock loading={creators.loading} error={creators.error} empty={!visible.length}>
 <TableWrap><thead><tr><th>Select</th><th>Person</th><th>Categories</th><th>Eligibility</th><th>Followers</th><th>Posts</th><th>Last fetch</th><th>Review</th></tr></thead>
 <tbody>{visible.map(c=><tr key={c.id}><td><input type="checkbox" aria-label={'Select Instagram '+c.username} checked={checkedIds.includes(c.id)} onChange={e=>setCheckedIds(v=>e.target.checked?[...new Set([...v,c.id])]:v.filter(id=>id!==c.id))}/></td><td><strong>{c.display_name}</strong><p className="fineprint">@{c.username}</p></td>
 <td>{c.category_ids.length}</td><td>{c.eligibility}{!c.youtube_creator_id&&<p className="fineprint">No YouTube link</p>}</td><td>{fmtNum(c.followers_count)}</td><td>{fmtNum(c.media_count)}</td>
 <td>{fmtDate(c.fetched_at)}{c.error_code&&<p className="fineprint">Refresh error: {c.error_code}</p>}</td>
 <td><div className="admin-inline-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>review(c,'approved')}>Approve human</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(c,'rejected')}>Reject</button></div></td></tr>)}</tbody></TableWrap>
 </DataBlock></Card>
 </AdminPage></RoleGate>;
}
