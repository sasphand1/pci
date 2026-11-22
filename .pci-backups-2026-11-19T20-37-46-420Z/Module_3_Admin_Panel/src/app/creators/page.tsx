'use client';
import {useState,useMemo} from 'react';
import {Card,Notice,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,BusyButton,ConfirmButton,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {Creator,Category} from '@/lib/types';
type Form={channelId:string;slug:string;displayName:string;description:string;featured:boolean;enabled:boolean;categoryIds:string[]};
const newCreator:Form={channelId:'',slug:'',displayName:'',description:'',featured:false,enabled:true,categoryIds:[]};
export default function CreatorsPage(){
 const {identity}=useAuth(),csrf=identity?.csrfToken;
 const [showArchived,setShowArchived]=useState(false);
 const list=useData<Creator[]>(`/admin/creators?limit=250&includeArchived=${showArchived}`);const categories=useData<Category[]>('/admin/categories');
 const [selected,setSelected]=useState<string|null>(null),[form,setForm]=useState<Form>(newCreator);
 const [search,setSearch]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [remote,setRemote]=useState(''),[bulk,setBulk]=useState(''),[bulkBusy,setBulkBusy]=useState(false);
 const [resetBusy,setResetBusy]=useState(false);
 // PCI_BULK_SOFT_DELETE_V1
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [deleting,setDeleting]=useState(false);
 const rows=useMemo(()=>(list.data??[]).filter(c=>`${c.display_name} ${c.channel_id} ${c.slug}`.toLowerCase().includes(search.toLowerCase())),[list.data,search]);
 const selectedSet=new Set(selectedIds);
 const enabledRows=rows.filter(c=>c.enabled);
 const allVisibleSelected=enabledRows.length>0&&enabledRows.every(c=>selectedSet.has(c.id));
 function selectAllVisible(checked:boolean){
  setSelectedIds(prev=>checked?[...new Set([...prev,...enabledRows.map(c=>c.id)])]:prev.filter(id=>!enabledRows.some(c=>c.id===id)));
 }
 async function disableSelected(){
  if(!csrf||identity?.role!=='owner'||deleting||!selectedIds.length)return;
  const ids=[...new Set(selectedIds)];
  if(!window.confirm('Disable '+ids.length+' selected YouTube creators? Records, metrics and Instagram links will be preserved.'))return;
  setDeleting(true);setError('');setOk('');
  try{
   const result=await api<{selected:number;disabled:number}>('/admin/creators/bulk-disable',{method:'POST',csrf,body:{ids,confirmation:'DISABLE SELECTED'}});
   setOk('Disabled '+result.disabled+' selected creators. Records preserved.');setSelectedIds([]);list.reload();
  }catch(e){setError(errorText(e));}finally{setDeleting(false);}
 }
 function edit(c:Creator){setSelected(c.id);setForm({channelId:c.channel_id,slug:c.slug,displayName:c.display_name,description:c.description,featured:c.featured,enabled:c.enabled,categoryIds:c.category_ids||[]});setError('');setOk('');}
 function clear(){setSelected(null);setForm(newCreator);setError('');setRemote('');}
 async function submit(e:React.FormEvent){e.preventDefault();if(!csrf)return;setSaving(true);setError('');setOk('');try{
   if(selected){const {channelId:_,...patch}=form;void _;await api(`/admin/creators/${selected}`,{method:'PATCH',csrf,body:patch});setOk('Creator updated and public cache invalidated.');}
   else{await api('/admin/creators',{method:'POST',csrf,body:form});setOk('Creator verified and created.');clear();setOk('Creator verified and created.');}
   list.reload();
 }catch(e){setError(errorText(e));}finally{setSaving(false);}}
 async function validate(){setSaving(true);setError('');setRemote('');try{const data=await api<{title:string;channelId:string}>('/admin/creators/validate',{method:'POST',csrf,body:{channelId:form.channelId}});setRemote(`${data.title} — ${data.channelId}`);if(!form.displayName)setForm(p=>({...p,displayName:data.title||p.displayName}));}catch(e){setError(errorText(e));}finally{setSaving(false);}}
 async function archiveAll(){
  if(!csrf||resetBusy||list.loading||list.error)return;
  const active=(list.data??[]).filter(x=>x.enabled).length;
  if(!active){setError('No active creators to archive.');return;}
  if(!window.confirm(`Archive all ${active} active YouTube creators? Their statistics, videos, and Instagram links will be preserved.`))return;
  const confirm=window.prompt(`Type ARCHIVE ALL ACTIVE CREATORS to archive exactly ${active} active records:`);
  if(confirm!=='ARCHIVE ALL ACTIVE CREATORS')return;
  setResetBusy(true);setError('');setOk('');
  try{
   const r=await api<{archived:number;deleted:number}>('/admin/creators/archive-all',{method:'POST',csrf,body:{expectedActiveCount:active,confirmation:confirm}});
   setOk(`Archived ${r.archived} creators. No rows permanently deleted.`);setShowArchived(false);list.reload();
  }catch(e){setError(errorText(e));}finally{setResetBusy(false);}
 }
 async function importBulk(){if(!csrf)return;setBulkBusy(true);setError('');setOk('');try{
  const raw=JSON.parse(bulk) as unknown;
  if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new Error('Provide a JSON array with 1–100 creator objects.');
  const r=await api<{created:number;reactivated:number;skipped:number;duplicatesInFile:number;conflicts:{channelId:string;slug:string;existingChannelId:string}[];unverifiedChannelIds:string[]}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(`Created ${r.created}, restored ${r.reactivated}, skipped existing ${r.skipped}, duplicates ${r.duplicatesInFile}, slug conflicts ${r.conflicts.length}, unverified YouTube IDs ${r.unverifiedChannelIds.length}.`);
  const issues=[...r.conflicts.map(c=>`Slug ${c.slug}: ${c.channelId} conflicts with ${c.existingChannelId}`),...r.unverifiedChannelIds.map(id=>`Unverified YouTube ID: ${id}`)];
  if(issues.length)setError(issues.join(' | '));
  else setBulk('');
  list.reload();
 }catch(e){setError(errorText(e));}finally{setBulkBusy(false);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Creator registry" description="Verify UC channel IDs and manage all curated creators. Bulk imports are transactional." action={<button className="btn btn-secondary" onClick={()=>{list.reload();categories.reload();}}>Reload</button>}>
  <Status error={error} ok={ok}/>
  <div className="admin-panel-grid"><Card><div className="admin-section-header"><h2>{selected?'Edit creator':'Add creator'}</h2>{selected&&<button className="btn btn-secondary" onClick={clear}>New creator</button>}</div>
   <form className="form" onSubmit={submit}>
    <div className="admin-form-grid">
      <div className="field admin-form-wide"><label htmlFor="creator-channel">YouTube channel ID</label><div className="admin-inline-actions"><input id="creator-channel" aria-label="YouTube UC channel ID" className="admin-grow" value={form.channelId} onChange={e=>setForm(p=>({...p,channelId:e.target.value.trim()}))} required disabled={!!selected} pattern="UC[A-Za-z0-9_-]{22}"/><button className="btn btn-secondary" type="button" disabled={saving||!!selected||!form.channelId} onClick={validate}>Verify on YouTube</button></div>{remote&&<p className="fineprint">Verified: {remote}</p>}</div>
      <div className="field"><label htmlFor="creator-name">Display name</label><input id="creator-name" value={form.displayName} onChange={e=>setForm(p=>({...p,displayName:e.target.value}))} maxLength={150} required/></div>
      <div className="field"><label htmlFor="creator-slug">URL slug</label><input id="creator-slug" value={form.slug} onChange={e=>setForm(p=>({...p,slug:e.target.value}))} pattern="[a-z0-9]+(-[a-z0-9]+)*" minLength={2} maxLength={100} required placeholder="creator-name"/></div>
      <div className="field admin-form-wide"><label htmlFor="creator-desc">Editorial description</label><textarea id="creator-desc" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} maxLength={5000}/></div>
    </div>
    <fieldset className="admin-fieldset"><legend>Categories</legend><div className="admin-check-grid">{(categories.data??[]).map(cat=><label className="admin-check" key={cat.id}><input type="checkbox" checked={form.categoryIds.includes(cat.id)} onChange={e=>setForm(p=>({...p,categoryIds:e.target.checked?[...p.categoryIds,cat.id]:p.categoryIds.filter(x=>x!==cat.id)}))}/>{cat.label}</label>)}</div></fieldset>
    <div className="admin-inline-actions"><label className="admin-check"><input type="checkbox" checked={form.enabled} onChange={e=>setForm(p=>({...p,enabled:e.target.checked}))}/>Enabled</label><label className="admin-check"><input type="checkbox" checked={form.featured} onChange={e=>setForm(p=>({...p,featured:e.target.checked}))}/>Featured on public site</label></div>
    <BusyButton busy={saving}>{selected?'Save creator':'Verify and add creator'}</BusyButton>
   </form></Card>
   <Card><h2 className="admin-box-title">Registry reset and bulk import</h2>
   <p className="fineprint">Archive every active YouTube creator (owner only). Preserves database history and Instagram links. Re-imported channels are verified and returned to pending human review.</p>
   {identity?.role==='owner'&&<button type="button" className="btn btn-secondary" disabled={resetBusy||list.loading||!!list.error||showArchived} onClick={archiveAll}>{resetBusy?'Archiving…':'Archive all active YouTube creators'}</button>}<p className="muted text-sm">Paste a JSON array matching the exact Module 1 adapter contract. Each entry must include channelId, slug and displayName, plus optional categoryIds, description, featured and enabled. Existing channel IDs are skipped automatically; only new channel IDs are verified and imported.</p>
    <div className="form"><div className="field"><label htmlFor="bulk-json">Creator JSON array</label><textarea id="bulk-json" rows={10} className="admin-code" value={bulk} onChange={e=>setBulk(e.target.value)} placeholder={'[{"channelId":"UC...","slug":"example","displayName":"Example","categoryIds":[]}]'}/></div>
      <button type="button" className="btn btn-primary" disabled={bulkBusy||!bulk.trim()} onClick={importBulk}>{bulkBusy?'Importing…':'Validate and bulk import'}</button>
    </div><p className="fineprint">Maximum 100 creators per request. Do not paste API keys or other secrets.</p>
   </Card></div>
  <Card><div className="admin-toolbar"><h2>{showArchived?'All creators (including archived)':'Active creators'} ({rows.length})</h2><button type="button" className="btn btn-secondary" onClick={()=>setShowArchived(x=>!x)}>{showArchived?'Hide archived':'Show archived'}</button><div className="field"><label htmlFor="creator-search">Search</label><input id="creator-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Channel, slug, name"/></div></div>
   {identity?.role==='owner'&&<div className="admin-inline-actions"><label className="admin-check"><input type="checkbox" checked={allVisibleSelected} disabled={!enabledRows.length||deleting} onChange={e=>selectAllVisible(e.target.checked)}/> Select all visible active</label><button type="button" className="btn btn-secondary" disabled={!selectedIds.length||deleting} onClick={disableSelected}>{deleting?'Disabling…':'Delete selected ('+selectedIds.length+')'}</button><button type="button" className="btn btn-secondary" disabled={!selectedIds.length||deleting} onClick={()=>setSelectedIds([])}>Clear selection</button></div>}
   <DataBlock loading={list.loading} error={list.error} empty={!rows.length}>
    <TableWrap><thead><tr>{identity?.role==='owner'&&<th>Select</th>}<th>Creator</th><th>UC ID</th><th>Categories</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}>{identity?.role==='owner'&&<td><input type="checkbox" aria-label={'Select '+c.display_name} disabled={!c.enabled||deleting} checked={selectedSet.has(c.id)} onChange={e=>setSelectedIds(prev=>e.target.checked?[...new Set([...prev,c.id])]:prev.filter(id=>id!==c.id))}/></td>}<td><strong>{c.display_name}</strong><p className="fineprint">/{c.slug}</p></td><td className="admin-code small">{c.channel_id}</td><td>{c.category_ids.length} assigned</td><td><Badge variant={c.enabled?'normal':'danger'}>{c.enabled?'Enabled':'Disabled'}</Badge>{c.featured&&' · Featured'}</td><td>{fmtDate(c.created_at)}</td><td><div className="admin-inline-actions"><button className="btn btn-secondary" onClick={()=>edit(c)}>Edit</button>{c.enabled&&<ConfirmButton label="Disable" confirmText={`Disable ${c.display_name}? Their public profile will be hidden.`} onConfirm={async()=>{try{await api(`/admin/creators/${c.id}`,{method:'DELETE',csrf});setOk('Creator disabled.');list.reload();}catch(e){setError(errorText(e));}}}/>}</div></td></tr>)}</tbody></TableWrap>
   </DataBlock>
  </Card>
 </AdminPage></RoleGate>;
}
