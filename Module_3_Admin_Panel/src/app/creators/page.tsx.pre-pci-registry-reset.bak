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
 const list=useData<Creator[]>('/admin/creators?limit=250');const categories=useData<Category[]>('/admin/categories');
 const [selected,setSelected]=useState<string|null>(null),[form,setForm]=useState<Form>(newCreator);
 const [search,setSearch]=useState(''),[saving,setSaving]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [remote,setRemote]=useState(''),[bulk,setBulk]=useState(''),[bulkBusy,setBulkBusy]=useState(false);
 const rows=useMemo(()=>(list.data??[]).filter(c=>`${c.display_name} ${c.channel_id} ${c.slug}`.toLowerCase().includes(search.toLowerCase())),[list.data,search]);
 function edit(c:Creator){setSelected(c.id);setForm({channelId:c.channel_id,slug:c.slug,displayName:c.display_name,description:c.description,featured:c.featured,enabled:c.enabled,categoryIds:c.category_ids||[]});setError('');setOk('');}
 function clear(){setSelected(null);setForm(newCreator);setError('');setRemote('');}
 async function submit(e:React.FormEvent){e.preventDefault();if(!csrf)return;setSaving(true);setError('');setOk('');try{
   if(selected){const {channelId:_,...patch}=form;void _;await api(`/admin/creators/${selected}`,{method:'PATCH',csrf,body:patch});setOk('Creator updated and public cache invalidated.');}
   else{await api('/admin/creators',{method:'POST',csrf,body:form});setOk('Creator verified and created.');clear();setOk('Creator verified and created.');}
   list.reload();
 }catch(e){setError(errorText(e));}finally{setSaving(false);}}
 async function validate(){setSaving(true);setError('');setRemote('');try{const data=await api<{title:string;channelId:string}>('/admin/creators/validate',{method:'POST',csrf,body:{channelId:form.channelId}});setRemote(`${data.title} — ${data.channelId}`);if(!form.displayName)setForm(p=>({...p,displayName:data.title||p.displayName}));}catch(e){setError(errorText(e));}finally{setSaving(false);}}
 async function importBulk(){if(!csrf)return;setBulkBusy(true);setError('');setOk('');try{
  const raw=JSON.parse(bulk) as unknown;
  if(!Array.isArray(raw)||raw.length<1||raw.length>100)throw new Error('Provide a JSON array with 1–100 creator objects.');
  const r=await api<{created:number;skipped:number;duplicatesInFile:number;conflicts:{channelId:string;slug:string;existingChannelId:string}[]}>('/admin/creators/bulk',{method:'POST',csrf,body:{creators:raw}});
  setOk(`Added ${r.created}; skipped ${r.skipped} existing, ${r.duplicatesInFile} file duplicates; ${r.conflicts.length} slug conflicts.`);
  if(r.conflicts.length)setError(r.conflicts.map(c=>`Slug ${c.slug}: uploaded ${c.channelId} differs from registered ${c.existingChannelId}`).join(' | '));
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
   <Card><h2 className="admin-box-title">Bulk import</h2><p className="muted text-sm">Paste a JSON array matching the exact Module 1 adapter contract. Each entry must include channelId, slug and displayName, plus optional categoryIds, description, featured and enabled. Existing channel IDs are skipped automatically; only new channel IDs are verified and imported.</p>
    <div className="form"><div className="field"><label htmlFor="bulk-json">Creator JSON array</label><textarea id="bulk-json" rows={10} className="admin-code" value={bulk} onChange={e=>setBulk(e.target.value)} placeholder={'[{"channelId":"UC...","slug":"example","displayName":"Example","categoryIds":[]}]'}/></div>
      <button type="button" className="btn btn-primary" disabled={bulkBusy||!bulk.trim()} onClick={importBulk}>{bulkBusy?'Importing…':'Validate and bulk import'}</button>
    </div><p className="fineprint">Maximum 100 creators per request. Do not paste API keys or other secrets.</p>
   </Card></div>
  <Card><div className="admin-toolbar"><h2>Configured creators ({rows.length})</h2><div className="field"><label htmlFor="creator-search">Search</label><input id="creator-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Channel, slug, name"/></div></div>
   <DataBlock loading={list.loading} error={list.error} empty={!rows.length}>
    <TableWrap><thead><tr><th>Creator</th><th>UC ID</th><th>Categories</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><strong>{c.display_name}</strong><p className="fineprint">/{c.slug}</p></td><td className="admin-code small">{c.channel_id}</td><td>{c.category_ids.length} assigned</td><td><Badge variant={c.enabled?'normal':'danger'}>{c.enabled?'Enabled':'Disabled'}</Badge>{c.featured&&' · Featured'}</td><td>{fmtDate(c.created_at)}</td><td><div className="admin-inline-actions"><button className="btn btn-secondary" onClick={()=>edit(c)}>Edit</button>{c.enabled&&<ConfirmButton label="Disable" confirmText={`Disable ${c.display_name}? Their public profile will be hidden.`} onConfirm={async()=>{try{await api(`/admin/creators/${c.id}`,{method:'DELETE',csrf});setOk('Creator disabled.');list.reload();}catch(e){setError(errorText(e));}}}/>}</div></td></tr>)}</tbody></TableWrap>
   </DataBlock>
  </Card>
 </AdminPage></RoleGate>;
}
