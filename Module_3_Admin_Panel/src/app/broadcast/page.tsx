'use client';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import {RoleGate} from '@/components/Shared';
import {useAuth} from '@/components/AuthProvider';
import {api,errorText,fmtDate} from '@/lib/api';

type Destination='youtube'|'instagram'|'tiktok';
type Delivery={id:string;destination:Destination;state:string;status:string;external_id:string|null;result_code:string|null;claim_deadline:string|null};
type Job={id:string;title:string;body:string;media_ref:string|null;state:string;status:string;created_at:string;deliveries:Delivery[]};
type History={id:string;event:string;created_at:string;delivery_id:string|null};
type Overview={jobs:Job[];dispatchConfigured:boolean;destinations:Destination[]};
const labels:Record<Destination,string>={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok'};
const display=(s:string)=>s.replaceAll('_',' ');

function ControlRoom(){
 const {identity}=useAuth();
 const [data,setData]=useState<Overview|null>(null),[error,setError]=useState(''),[ok,setOk]=useState(''),[busy,setBusy]=useState(false);
 const [title,setTitle]=useState(''),[body,setBody]=useState(''),[mediaRef,setMediaRef]=useState(''),[targets,setTargets]=useState<Destination[]>([]);
 const [selectedId,setSelectedId]=useState(''),[history,setHistory]=useState<History[]>([]),[review,setReview]=useState(false);
 const request=useRef<{signature:string;id:string}|null>(null);
 const running=useRef(false);
 const revision=useRef(0);
 const refresh=useCallback(async(background=false)=>{
  if(running.current)return;
  running.current=true;const version=revision.current;
  try{const result=await api<Overview>('/admin/broadcast',{background});if(version===revision.current)setData(result);if(!background)setError('');}
  catch(e){setError(errorText(e));}finally{running.current=false;}
 },[]);
 useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(true),15000);return()=>window.clearInterval(timer);},[refresh]);
 const selected=data?.jobs.find(j=>j.id===selectedId);
 useEffect(()=>{let active=true;setHistory([]);if(!selectedId)return;async function load(){try{const d=await api<Job & {history:History[]}>(`/admin/broadcast/${selectedId}`,{background:true});if(active)setHistory(d.history);}catch(e){if(active)setError(errorText(e));}}void load();const timer=window.setInterval(()=>void load(),15000);return()=>{active=false;window.clearInterval(timer);};},[selectedId]);
 const replace=(job:Job)=>{revision.current++;setData(d=>d?{...d,jobs:[job,...d.jobs.filter(j=>j.id!==job.id)].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,50)}:d);};
 async function create(e:FormEvent){e.preventDefault();if(busy||!identity||!targets.length)return;setBusy(true);setError('');setOk('');setReview(false);
  const content={title:title.trim(),body:body.trim(),mediaRef:mediaRef.trim()||null,destinations:[...targets].sort()};const signature=JSON.stringify(content);
  const pending=request.current?.signature===signature?request.current:{signature,id:crypto.randomUUID()};request.current=pending;
  try{const job=await api<Job>('/admin/broadcast',{method:'POST',csrf:identity.csrfToken,body:{...content,requestId:pending.id}});replace(job);setSelectedId(job.id);request.current=null;setTitle('');setBody('');setMediaRef('');setTargets([]);setOk('Draft saved. Review the exact content before confirming.');}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function act(action:'confirm'|'cancel'){
  if(!identity||!selected||busy)return;
  if(action==='confirm'&&!review)return;
  if(action==='cancel'&&!window.confirm('Cancel this broadcast before dispatch begins?'))return;
  const jobId=selected.id;setBusy(true);setError('');setOk('');
  try{const job=await api<Job>(`/admin/broadcast/${jobId}/${action}`,{method:'POST',csrf:identity.csrfToken,body:{confirm:true}});replace(job);setReview(false);setOk(action==='confirm'?'Broadcast confirmed. Delivery is queued until a configured dispatcher claims it.':'Broadcast cancelled.');}
  catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 const jobs=data?.jobs??[];
 const count=(states:string[])=>jobs.filter(j=>states.includes(j.status)).length;
 const canCancel=selected&&(selected.state==='draft'||(selected.state==='confirmed'&&selected.deliveries.every(d=>d.state==='pending')));
 return <section className="pci-broadcast" aria-label="Broadcast control room">
  <header className="pci-broadcast-header"><div><p className="pci-broadcast-kicker">PCI / TRANSMISSION CONTROL</p><h1>Broadcast command</h1><p>Prepare · Review · Authorize · Track</p></div><button className="btn btn-secondary" onClick={()=>void refresh()}>Refresh engine</button></header>
  <div className="pci-broadcast-signal" role="status">{!data?'Engine connection pending':data.dispatchConfigured?'Dispatch credential configured — adapter readiness not verified':'Dispatch disabled — no external transmissions'} </div>
  {error&&<p className="pci-broadcast-alert" role="alert">{error}</p>}{ok&&<p className="pci-broadcast-signal" role="status">{ok}</p>}
  <div className="pci-broadcast-metrics" aria-label="Latest 50 broadcasts">
   {[['Drafts',count(['draft'])],['Queued / dispatching',count(['queued','dispatching'])],['Delivered',count(['delivered'])],['Attention / failed',count(['attention','failed','partial'])]].map(([label,value])=><div className="pci-broadcast-panel" key={label}><span>{label}</span><strong>{data?value:'—'}</strong><small>Latest 50 jobs</small></div>)}
  </div>
  <div className="pci-broadcast-grid">
   <div className="pci-broadcast-panel"><h2>01 / Compose payload</h2><form className="form" onSubmit={create}>
    <div className="field"><label htmlFor="broadcast-title">Title</label><input id="broadcast-title" required maxLength={160} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/></div>
    <div className="field"><label htmlFor="broadcast-body">Message / caption</label><textarea id="broadcast-body" rows={5} maxLength={5000} value={body} onChange={e=>setBody(e.target.value)} disabled={busy}/></div>
    <div className="field"><label htmlFor="broadcast-media">Original media reference (optional)</label><input id="broadcast-media" placeholder="assets/video-001.mp4" maxLength={512} value={mediaRef} onChange={e=>setMediaRef(e.target.value)} disabled={busy}/><small>Use a controlled asset reference, not a URL. PCI does not upload or download media here.</small></div>
    <fieldset className="admin-fieldset"><legend>Destination channels</legend>{(data?.destinations??[]).map(d=><label className="admin-check" key={d}><input type="checkbox" checked={targets.includes(d)} disabled={busy} onChange={e=>setTargets(prev=>e.target.checked?[...prev,d]:prev.filter(t=>t!==d))}/>{labels[d]}</label>)}</fieldset>
    <button className="btn btn-secondary" type="submit" disabled={!data||busy||!title.trim()||!targets.length}>Save draft</button>
   </form></div>
   <div className="pci-broadcast-panel pci-broadcast-console"><h2>02 / Authorization</h2><p>{selected?`Selected: ${selected.title}`:'Select a saved draft below.'}</p>
    {selected&&<div className="pci-broadcast-preview"><h3>{selected.title}</h3><p>{selected.body||'No caption'}</p><small>Media: {selected.media_ref||'None'}</small><small>Channels: {selected.deliveries.map(d=>labels[d.destination]).join(', ')}</small><strong>State: {display(selected.status)}</strong></div>}
    <button className="pci-broadcast-trigger" disabled={!selected||selected.state!=='draft'||busy} onClick={()=>setReview(true)} aria-label="Review broadcast">BROADCAST</button>
    {review&&selected?.state==='draft'&&<div className="pci-broadcast-confirm"><p>Authorize this exact payload for the listed destinations? It may be transmitted when the external dispatcher is configured, even if it is currently disabled.</p><div className="admin-inline-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>void act('confirm')}>Confirm transmission</button><button className="btn btn-secondary" disabled={busy} onClick={()=>setReview(false)}>Back</button></div></div>}
    {canCancel&&<button className="btn btn-secondary" disabled={busy} onClick={()=>void act('cancel')}>Cancel unclaimed broadcast</button>}
    <p className="pci-broadcast-hint">The red button opens review. Only a confirmed draft enters the durable queue.</p>
   </div>
  </div>
  <div className="pci-broadcast-panel"><h2>03 / Transmission history</h2>{!jobs.length&&<p>{data?'No broadcasts yet.':'Waiting for engine data.'}</p>}
   <div className="pci-broadcast-job-list">{jobs.map(j=><button key={j.id} className="pci-broadcast-job" aria-pressed={j.id===selectedId} disabled={busy} onClick={()=>{setSelectedId(j.id);setReview(false);}}><span><strong>{j.title}</strong><small>{fmtDate(j.created_at)} · {j.deliveries.map(d=>labels[d.destination]).join(', ')}</small></span><span>{display(j.status)}</span></button>)}</div>
  </div>
  {selected&&<div className="pci-broadcast-grid"><div className="pci-broadcast-panel"><h2>04 / Channel delivery</h2>{selected.deliveries.map(d=><div key={d.id} className="pci-broadcast-delivery"><strong>{labels[d.destination]}</strong><span>{display(d.status)}</span>{d.external_id&&<small>Provider ID: {d.external_id}</small>}{d.result_code&&<small>Result: {d.result_code}</small>}{d.status==='uncertain'&&<small>Reconcile with provider. Do not automatically resend.</small>}</div>)}</div><div className="pci-broadcast-panel"><h2>05 / Audit trail</h2>{history.length?history.map(h=><p key={h.id}>{display(h.event)} · {fmtDate(h.created_at)}</p>):<p>No events loaded.</p>}</div></div>}
 </section>;
}
export default function BroadcastPage(){return <RoleGate roles={['owner','editor']}><ControlRoom/></RoleGate>;}
