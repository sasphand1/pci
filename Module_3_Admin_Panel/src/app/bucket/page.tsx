'use client';
import {useState} from 'react';
import {Card,Badge,Notice} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {initials} from '@/lib/format';
import {useAuth} from '@/components/AuthProvider';
import type {BatchResult,BucketList,BucketPerson,Category,Platform,RowStatus} from '@/lib/types';

const PAGE=50;
const STATUS:Record<RowStatus,{label:string;tone:'normal'|'muted'|'danger'}>={
 resolved:{label:'Ready to add',tone:'normal'},
 invalid_format:{label:'Invalid format',tone:'danger'},
 not_found:{label:'Not found',tone:'danger'},
 unsupported_account_type:{label:'Not a public professional account',tone:'danger'},
 resolve_error:{label:'Lookup failed',tone:'danger'},
 duplicate_in_bucket:{label:'Already in the bucket',tone:'muted'},
 duplicate_in_batch:{label:'Repeated in this list',tone:'muted'},
 unknown_niche:{label:'Unknown niche',tone:'danger'},
 person_already_has_platform:{label:'Person already has this platform',tone:'danger'}
};

export default function BucketPage(){
 const {identity}=useAuth();
 const [platform,setPlatform]=useState<Platform>('youtube');
 const [mode,setMode]=useState<'single'|'bulk'>('single');
 const [single,setSingle]=useState({account:'',person:'',niche:''});
 const [bulk,setBulk]=useState('');
 const [result,setResult]=useState<BatchResult|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [filter,setFilter]=useState<'all'|Platform>('all'),[q,setQ]=useState(''),[offset,setOffset]=useState(0);
 const [selected,setSelected]=useState<string[]>([]),[confirmText,setConfirmText]=useState(''),[deleting,setDeleting]=useState(false);
 const [editing,setEditing]=useState<BucketPerson|null>(null),[editCats,setEditCats]=useState<string[]>([]),[editPrimary,setEditPrimary]=useState('');
 const categories=useData<Category[]>('/admin/categories');
 const list=useData<BucketList>(`/admin/bucket?limit=${PAGE}&offset=${offset}${filter==='all'?'':`&platform=${filter}`}${q.trim()?`&q=${encodeURIComponent(q.trim())}`:''}`);
 const isOwner=identity?.role==='owner';
 const activeCategories=(categories.data??[]).filter(c=>c.active);

 // One line per account: handle_or_link[, person name[, niche]]. Single mode builds one such line.
 function text():string{
  if(mode==='bulk')return bulk;
  const clean=(v:string)=>v.replace(/[,\n\r]/g,' ').trim();
  const parts=[clean(single.account)];
  if(single.person.trim()||single.niche)parts.push(clean(single.person));
  if(single.niche)parts.push(single.niche);
  return parts.join(', ');
 }
 const canSubmit=text().trim().length>0&&!busy;

 async function run(kind:'preview'|'add'){
  setBusy(true);setError('');setOk('');
  try{
   const body={platform,text:text()};
   if(kind==='preview'){setResult(await api<BatchResult>('/admin/bucket/preview',{method:'POST',body,csrf:identity?.csrfToken,timeoutMs:120000}));}
   else{
    const r=await api<BatchResult>('/admin/bucket/people',{method:'POST',body,csrf:identity?.csrfToken,timeoutMs:120000});
    setResult(r);setOk(`${r.added??0} added. ${r.summary.total-(r.added??0)} not added: see the table for the reason of each line.`);
    if((r.added??0)>0){if(mode==='single')setSingle({account:'',person:'',niche:''});else setBulk('');list.reload();}
   }
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }

 async function deleteSelected(){
  if(!isOwner||!selected.length||confirmText!=='DELETE')return;
  if(!window.confirm(`Permanently delete ${selected.length} ${selected.length===1?'person':'people'}? Their accounts, history and every ranking entry are removed immediately. This cannot be undone.`))return;
  setDeleting(true);setError('');setOk('');
  let done=0;const failed:string[]=[];
  for(const id of selected){
   try{await api(`/admin/bucket/people/${id}`,{method:'DELETE',csrf:identity?.csrfToken});done++;}catch(e){failed.push(errorText(e));}
  }
  setDeleting(false);setSelected([]);setConfirmText('');list.reload();
  if(failed.length)setError(`${done} deleted, ${failed.length} failed: ${failed[0]}`);else setOk(`${done} deleted. They are gone from the bucket and from every live ranking.`);
 }

 function startEdit(p:BucketPerson){setEditing(p);setEditCats(p.categories.map(c=>c.slug));setEditPrimary(p.categories.find(c=>c.primary)?.slug??'');}
 async function saveEdit(){
  if(!editing)return;setBusy(true);setError('');setOk('');
  try{
   await api(`/admin/bucket/people/${editing.id}/categories`,{method:'PUT',csrf:identity?.csrfToken,body:{categories:editCats,primary:editCats.length?(editPrimary&&editCats.includes(editPrimary)?editPrimary:editCats[0]):null}});
   setOk('Niches saved. They apply to the category rows at the next Rank and Publish.');setEditing(null);list.reload();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 const toggle=(arr:string[],v:string)=>arr.includes(v)?arr.filter(x=>x!==v):[...arr,v];
 const rows=list.data?.rows??[];
 const total=list.data?.total??0;

 return <RoleGate roles={['owner','editor']}><AdminPage title="People" description="The people the ranking engine works on. Add accounts here; delete a person and nothing of them is left anywhere.">
  <Status error={error} ok={ok}/>
  <Card>
   <div className="admin-toolbar"><h2>Add to the bucket</h2>
    <div className="seg" role="group" aria-label="Platform">
     <button type="button" className={`seg-btn${platform==='youtube'?' is-on':''}`} aria-pressed={platform==='youtube'} onClick={()=>{setPlatform('youtube');setResult(null);}}>YouTube</button>
     <button type="button" className={`seg-btn${platform==='instagram'?' is-on':''}`} aria-pressed={platform==='instagram'} onClick={()=>{setPlatform('instagram');setResult(null);}}>Instagram</button>
     <button type="button" className="seg-btn" disabled title="TikTok is not enabled yet">TikTok (soon)</button>
    </div>
   </div>
   <div className="seg" role="group" aria-label="How many accounts">
    <button type="button" className={`seg-btn${mode==='single'?' is-on':''}`} aria-pressed={mode==='single'} onClick={()=>setMode('single')}>Single</button>
    <button type="button" className={`seg-btn${mode==='bulk'?' is-on':''}`} aria-pressed={mode==='bulk'} onClick={()=>setMode('bulk')}>Bulk</button>
   </div>
   {mode==='single'?<div className="admin-form-grid">
    <div className="field"><label htmlFor="bk-account">{platform==='youtube'?'YouTube @handle, channel link or UC… id':'Instagram username or link'}</label><input id="bk-account" value={single.account} onChange={e=>setSingle(p=>({...p,account:e.target.value}))} maxLength={200} placeholder={platform==='youtube'?'@channelname':'username'}/></div>
    <div className="field"><label htmlFor="bk-person">Person name (optional)</label><input id="bk-person" value={single.person} onChange={e=>setSingle(p=>({...p,person:e.target.value}))} maxLength={120} placeholder="Type the exact name to link to an existing person"/></div>
    <div className="field"><label htmlFor="bk-niche">Niche (optional)</label><select id="bk-niche" value={single.niche} onChange={e=>setSingle(p=>({...p,niche:e.target.value}))}><option value="">No niche yet</option>{activeCategories.map(c=><option key={c.id} value={c.slug}>{c.label}</option>)}</select></div>
   </div>:<div className="field"><label htmlFor="bk-bulk">One account per line (up to 200)</label><textarea id="bk-bulk" rows={10} className="admin-code" value={bulk} onChange={e=>setBulk(e.target.value)} placeholder={'@handle\n@handle, Person name\n@handle, Person name, niche-slug'}/><span className="field-hint">Format: account, person name (optional), niche (optional). Lines starting with # are ignored.</span></div>}
   <p className="fineprint">A person is linked to an existing person only when you type their name exactly (capitals and spacing are ignored). Without a typed name every account becomes a new person. Check first: nothing is saved by Check.</p>
   <div className="admin-inline-actions">
    <button type="button" className="btn btn-secondary" disabled={!canSubmit} onClick={()=>run('preview')}>{busy?'Working…':'Check'}</button>
    <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={()=>run('add')}>Add valid rows</button>
   </div>
   {result&&<><p role="status">{result.added!==undefined?`${result.added} added`:`${result.summary.addable} of ${result.summary.total} ready to add`}.</p>
    <TableWrap><thead><tr><th>Line</th><th>Input</th><th>Account</th><th>Person</th><th>Niche</th><th>Result</th></tr></thead><tbody>{result.rows.map(r=><tr key={r.index}>
     <td>{r.line}</td><td>{r.input}</td><td>{r.handle??'—'}</td><td>{r.person??'—'}</td><td>{r.niche??'—'}</td>
     <td><Badge variant={STATUS[r.status]?.tone??'muted'}>{STATUS[r.status]?.label??r.status}</Badge>{r.hint&&<div className="fineprint">{r.hint}</div>}</td></tr>)}</tbody></TableWrap></>}
  </Card>

  <Card>
   <div className="admin-toolbar"><h2>People in the bucket ({total})</h2>
    <div className="admin-inline-actions">
     <input aria-label="Search people" value={q} onChange={e=>{setQ(e.target.value);setOffset(0);}} placeholder="Search name"/>
     <select aria-label="Platform filter" value={filter} onChange={e=>{setFilter(e.target.value as 'all'|Platform);setOffset(0);}}><option value="all">All platforms</option><option value="youtube">YouTube</option><option value="instagram">Instagram</option></select>
    </div>
   </div>
   {isOwner&&<div className="admin-inline-actions">
    <span>{selected.length} selected</span>
    <input aria-label="Type DELETE to confirm" value={confirmText} onChange={e=>setConfirmText(e.target.value)} placeholder="Type DELETE to enable" disabled={!selected.length}/>
    <button type="button" className="btn btn-danger" disabled={deleting||!selected.length||confirmText!=='DELETE'} onClick={deleteSelected}>{deleting?'Deleting…':'Delete selected permanently'}</button>
   </div>}
   <DataBlock loading={list.loading} error={list.error} empty={!rows.length}>
    <TableWrap><thead><tr>{isOwner&&<th>Select</th>}<th>Person</th><th>YouTube</th><th>Instagram</th><th>Niches</th><th>Added</th><th>Actions</th></tr></thead><tbody>{rows.map(p=>{
     const yt=p.accounts.find(a=>a.platform==='youtube'),ig=p.accounts.find(a=>a.platform==='instagram');
     return <tr key={p.id}>
      {isOwner&&<td><input type="checkbox" aria-label={`Select ${p.displayName}`} checked={selected.includes(p.id)} onChange={()=>setSelected(s=>toggle(s,p.id))}/></td>}
      <td><span className="person-cell"><span className="top-avatar" aria-hidden="true">{initials(p.displayName)}</span><strong>{p.displayName}</strong></span></td><td>{yt?.handle??'—'}</td><td>{ig?.handle??'—'}</td>
      <td>{p.categories.length?p.categories.map(c=><Badge key={c.slug} variant={c.primary?'normal':'muted'}>{c.label}</Badge>):'—'}</td>
      <td>{fmtDate(p.createdAt)}</td>
      <td><button type="button" className="btn btn-secondary" onClick={()=>startEdit(p)}>Niches</button></td></tr>;})}</tbody></TableWrap>
    <div className="admin-inline-actions">
     <button type="button" className="btn btn-secondary" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-PAGE))}>Previous</button>
     <span>{total?`${offset+1}–${Math.min(total,offset+PAGE)} of ${total}`:''}</span>
     <button type="button" className="btn btn-secondary" disabled={offset+PAGE>=total} onClick={()=>setOffset(offset+PAGE)}>Next</button>
    </div>
   </DataBlock>
  </Card>

  {editing&&<Card><h2 className="admin-box-title">Niches for {editing.displayName}</h2>
   <fieldset className="admin-fieldset"><legend>Categories</legend><div className="admin-check-grid">{activeCategories.map(c=><label className="admin-check" key={c.id}>
    <input type="checkbox" checked={editCats.includes(c.slug)} onChange={()=>setEditCats(s=>toggle(s,c.slug))}/>{c.label}
    {editCats.includes(c.slug)&&<label className="admin-check"><input type="radio" name="primary" checked={(editPrimary||editCats[0])===c.slug} onChange={()=>setEditPrimary(c.slug)}/>primary</label>}</label>)}</div></fieldset>
   <div className="admin-inline-actions"><button type="button" className="btn btn-primary" disabled={busy} onClick={saveEdit}>Save niches</button><button type="button" className="btn btn-secondary" onClick={()=>setEditing(null)}>Cancel</button></div>
  </Card>}
  <Notice>Adding or deleting here changes the bucket immediately. Rankings change when you Rank and Publish on the Pipeline page, except a delete, which removes the person from every live ranking at once.</Notice>
 </AdminPage></RoleGate>;
}
