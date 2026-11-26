'use client';
import {useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';

type Entry={id:number;signal_id:string;scope:string;value_numeric:number|null;value_text:string|null;source_url:string|null;note:string|null;valid_until:string|null;active:boolean;created_at:string};
type Manual={data:Entry[];meta:{signals:{id:string;label:string;scope:'city'|'pk'|'route';unit:string}[]}};
type Catalog={cities:Record<string,string>;routes:Record<string,{label:string}>};

/** Official entries: these are shown with the "Official" badge and their source link, and win over automatic values. */
export default function ManualSignals(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;
 const cat=useData<Catalog>('/admin/satify/catalog');
 const [rev,setRev]=useState(0);const list=useData<Entry[]>(`/admin/satify/manual?r=${rev}`);
 const meta=useData<Manual['meta']>('/admin/satify/manual-meta');
 const [signal,setSignal]=useState('petrol_price'),[scope,setScope]=useState('pk'),[value,setValue]=useState(''),[text,setText]=useState(''),[url,setUrl]=useState(''),[hours,setHours]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 const sig=meta.data?.signals.find(s=>s.id===signal);
 const places=sig?.scope==='route'?Object.entries(cat.data?.routes??{}).map(([k,v])=>[k,v.label]):sig?.scope==='city'?Object.entries(cat.data?.cities??{}):[['pk','Pakistan']];
 async function add(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setOk('');
  try{await api('/admin/satify/manual',{method:'POST',csrf,body:{signal,scope:sig?.scope==='pk'?'pk':scope,value:value.trim()===''?null:Number(value),text:text.trim()||null,sourceUrl:url.trim()||null,validHours:hours?Number(hours):undefined}});
   setOk('Saved. Packs that use it pick it up within a minute; urgent rules on it (e.g. school notice) send once.');setValue('');setText('');setUrl('');setRev(v=>v+1);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function off(id:number){setError('');try{await api(`/admin/satify/manual/${id}`,{method:'DELETE',csrf});setRev(v=>v+1);}catch(e){setError(errorText(e));}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Satify official entries" description="Things no free API provides: petrol and diesel prices, the Sarafa tola rate, open-market dollar, school-closure notices, NHMP motorway notices, Section 144 and today's top trend. Always add the source link.">
  <Status error={error} ok={ok}/>
  <Card><h2 className="admin-box-title">Add an entry</h2><form className="form" onSubmit={add}><div className="admin-form-grid">
   <div className="field"><label>What</label><select value={signal} onChange={e=>setSignal(e.target.value)}>{meta.data?.signals.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
   {sig?.scope!=='pk'&&<div className="field"><label>Where</label><select value={scope} onChange={e=>setScope(e.target.value)}>{places.map(([k,l])=><option key={k} value={k}>{l}</option>)}</select></div>}
   <div className="field"><label>Number {sig?.unit?`(${sig.unit})`:''}</label><input inputMode="decimal" value={value} onChange={e=>setValue(e.target.value)}/></div>
   <div className="field admin-form-wide"><label>Text (for notices)</label><input maxLength={300} value={text} placeholder="e.g. Punjab schools closed Thu–Fri due to smog" onChange={e=>setText(e.target.value)}/></div>
   <div className="field admin-form-wide"><label>Source link</label><input type="url" maxLength={400} value={url} placeholder="https://…" onChange={e=>setUrl(e.target.value)}/></div>
   <div className="field"><label>Expires after (hours, optional)</label><input type="number" min={1} max={2160} value={hours} onChange={e=>setHours(e.target.value)}/></div>
  </div><div className="admin-inline-actions"><button className="btn btn-primary" type="submit" disabled={busy}>{busy?'Saving…':'Save entry'}</button></div></form></Card>
  <Card><h2 className="admin-box-title">Entries</h2><DataBlock loading={list.loading} error={list.error} empty={!list.data?.length}>
   <TableWrap><thead><tr><th>Added</th><th>What</th><th>Where</th><th>Value</th><th>Source</th><th>Expires</th><th></th></tr></thead><tbody>
    {list.data?.map(m=><tr key={m.id}><td>{fmtDate(m.created_at)}</td><td>{m.signal_id}</td><td>{m.scope}</td><td>{m.value_numeric??m.value_text}</td><td>{m.source_url?<a href={m.source_url} target="_blank" rel="noreferrer">link</a>:'—'}</td><td>{fmtDate(m.valid_until)}</td>
     <td>{m.active?<button className="btn btn-secondary" onClick={()=>void off(m.id)}>Withdraw</button>:<Badge variant="muted">withdrawn</Badge>}</td></tr>)}
   </tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>;
}
