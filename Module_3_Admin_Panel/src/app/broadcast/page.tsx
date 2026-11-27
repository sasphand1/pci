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
 const [previewChannel,setPreviewChannel]=useState('email');
 const publicChannels=[{id:'email',name:'Email',symbol:'✉',mode:'Not connected'},{id:'push',name:'Web Push',symbol:'◉',mode:'Not connected'},{id:'whatsapp',name:'WhatsApp Channel',symbol:'◌',mode:'Manual only'},{id:'facebook',name:'Facebook',symbol:'f',mode:'Not connected'},{id:'rss',name:'RSS',symbol:'◔',mode:'Not connected'},{id:'feed',name:'PCI Live Feed',symbol:'≋',mode:'Not connected'}];
 const connected=(data?.destinations??[]).map(id=>({id,name:labels[id],symbol:id==='youtube'?'▶':id==='instagram'?'◎':'♫',mode:'Queue only'}));
 const channels=[...publicChannels,...connected];
 const editing=Boolean(title||body||mediaRef||targets.length);
 const previewSaved=selected&&!editing;
 const deliveries=jobs.filter(j=>j.state==='confirmed').flatMap(j=>j.deliveries);
 const delivered=deliveries.filter(d=>d.status==='delivered').length;
 const attention=deliveries.filter(d=>['failed','uncertain'].includes(d.status)).length;
 const pendingCount=deliveries.filter(d=>['pending','claimed'].includes(d.status)).length;
 const dayKeys=Array.from({length:7},(_,i)=>{const d=new Date();d.setUTCDate(d.getUTCDate()-6+i);return d.toISOString().slice(0,10);});
 const trend=dayKeys.map(day=>({day,created:jobs.filter(j=>j.created_at.slice(0,10)===day).length,confirmed:jobs.filter(j=>j.created_at.slice(0,10)===day&&j.state==='confirmed').length}));
 const chartMax=Math.max(2,Math.ceil(Math.max(0,...trend.map(r=>r.created))/2)*2);
 const points=(key:'created'|'confirmed')=>trend.map((r,i)=>`${40+i*54},${127-105*r[key]/chartMax}`).join(' ');
 const [activeDay,setActiveDay]=useState<number|null>(null);
 const previewTitle=previewSaved?selected.title:title;
 const previewBody=previewSaved?selected.body:body;
 const previewMedia=previewSaved?selected.media_ref:mediaRef;
 const previewName=channels.find(ch=>ch.id===previewChannel)?.name??'Email';
 return <section className="pci-broadcast bc-console bc-live-engine" aria-label="Broadcast control room">
  <header className="bc-hero"><img className="bc-hero-art" src="/broadcast/earth.svg" alt=""/><div className="bc-hero-copy"><p className="bc-kicker">PCI / TRANSMISSION CONTROL</p><h1><span className="bc-hero-icon" aria-hidden="true"><svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 14 8 29m8-15 8 15M11 24h10M12 5a10 10 0 0 0 0 16m8-16a10 10 0 0 1 0 16M8 1a15 15 0 0 0 0 24M24 1a15 15 0 0 1 0 24"/><circle cx="16" cy="13" r="3"/></svg></span>Broadcast</h1><p>Compose · Authorize · Transmit · Measure</p></div><div className="bc-hero-status"><span className="bc-mode"><i/>{data?'ENGINE CONNECTED':'ENGINE PENDING'}</span><span>COMMUNICATIONS CONTROL ROOM</span><button className="btn btn-secondary" onClick={()=>void refresh()}>Refresh engine</button></div></header>
  <div className="bc-topstrip" role="status"><span>{!data?'Engine connection pending':data.dispatchConfigured?'Dispatch credential configured — adapter readiness not verified':'Dispatch disabled — no external transmissions'}</span><span>Latest {jobs.length} of up to 50 jobs</span><span>Provider quotas unavailable</span></div>
  {error&&<p className="pci-broadcast-alert bc-engine-notice" role="alert">{error}</p>}{ok&&<p className="pci-broadcast-signal bc-engine-notice" role="status">{ok}</p>}
  <div className="bc-grid">
   <section className="bc-panel bc-compose"><div className="bc-panel-heading"><h2>Create broadcast</h2><span className="bc-tag">COMPOSER</span></div><p className="bc-sub">Prepare an immutable draft for authorization.</p>
    <form className="bc-fields" onSubmit={create}>
     <label className="bc-field" htmlFor="broadcast-title">Campaign title <span>{title.length}/160</span><input id="broadcast-title" required maxLength={160} value={title} onChange={e=>{setTitle(e.target.value);setReview(false);}} disabled={busy}/></label>
     <label className="bc-field" htmlFor="broadcast-body">Message / caption <span>{body.length}/5000</span><textarea id="broadcast-body" rows={5} maxLength={5000} value={body} onChange={e=>{setBody(e.target.value);setReview(false);}} disabled={busy}/></label>
     <label className="bc-field" htmlFor="broadcast-media">Original media reference <span>OPTIONAL</span><input id="broadcast-media" placeholder="assets/original.png" maxLength={512} value={mediaRef} onChange={e=>{setMediaRef(e.target.value);setReview(false);}} disabled={busy}/></label><small className="bc-help">Controlled asset reference only. No upload or video generation.</small>
     <fieldset className="bc-channel-field"><legend>Distribution channels <span>{targets.length} selected</span></legend><div className="bc-channels">{connected.map(ch=><label key={ch.id} className={`bc-channel bc-channel-${ch.id}${targets.includes(ch.id)?' bc-selected':''}`}><input type="checkbox" checked={targets.includes(ch.id)} disabled={busy} onChange={e=>{setReview(false);setTargets(prev=>e.target.checked?[...prev,ch.id]:prev.filter(t=>t!==ch.id));}}/><span className="bc-channel-icon" aria-hidden="true">{ch.symbol}</span><span>{ch.name}<small>{ch.mode}</small></span><span className="bc-check" aria-hidden="true">{targets.includes(ch.id)?'✓':'+'}</span></label>)}</div>{!connected.length&&<p className="bc-help">No destination contract loaded.</p>}</fieldset>
     <div className="bc-actions"><button className="btn btn-secondary" type="submit" disabled={!data||busy||!title.trim()||!targets.length}>Save draft</button><button type="button" disabled={busy} onClick={()=>{setTitle('');setBody('');setMediaRef('');setTargets([]);setReview(false);}}>Clear composer</button></div>
    </form>
    <div className="bc-future"><h3>Public distribution roadmap</h3><p className="bc-help">Preview only. These channels cannot be selected for live jobs.</p><div className="bc-channels">{publicChannels.map(ch=><div key={ch.id} className={`bc-channel bc-channel-${ch.id} bc-unavailable`}><span className="bc-channel-icon" aria-hidden="true">{ch.symbol}</span><span>{ch.name}<small>{ch.mode}</small></span></div>)}</div></div>
   </section>
   <div className="bc-middle">
    <section className="bc-panel bc-preview"><div className="bc-panel-heading"><h2>Message preview</h2><span className="bc-tag">{previewSaved?'SAVED DRAFT':'COMPOSER'}</span></div><p className="bc-sub">Illustrative channel formatting; exact saved payload appears below.</p><label className="bc-field bc-preview-select">Preview channel<select value={previewChannel} onChange={e=>setPreviewChannel(e.target.value)}>{channels.map(ch=><option key={ch.id} value={ch.id}>{ch.name}</option>)}</select></label>
     <div className={`bc-message bc-message-${previewChannel}`}><div className="bc-message-brand"><span className="bc-brand">PCI</span><div><strong>Pakistan Creator Index</strong><small>{previewName} · Preview</small></div></div><h3>{previewTitle||'Your headline'}</h3><p>{previewBody||'Your message will appear here.'}</p><div className="bc-preview-art"><img src="/broadcast/earth.svg" alt=""/><span>PCI</span><strong>CREATOR<br/>INTELLIGENCE</strong><small>PAKISTAN · DATA · INSIGHTS</small></div>{previewMedia&&<span className="bc-preview-url">Media reference<small>{previewMedia}</small></span>}</div>
     {selected&&<div className="bc-selected-job"><strong>Selected job: {selected.title}</strong><small>{display(selected.status)} · {selected.deliveries.map(d=>labels[d.destination]).join(', ')}</small></div>}
    </section>
    <section className="bc-launch" aria-label="Broadcast authorization"><div className="bc-launch-caption">{editing?'SAVE COMPOSER FIRST':selected?.state==='draft'?'REVIEW READY':'SELECT A SAVED DRAFT'}</div><div className={`bc-reactor${busy?' bc-transmitting':''}`}><button className="bc-launch-button pci-broadcast-trigger" type="button" disabled={!selected||selected.state!=='draft'||busy||editing} onClick={()=>setReview(true)} aria-label="Review broadcast"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M16 14 8 29m8-15 8 15M11 24h10M12 5a10 10 0 0 0 0 16m8-16a10 10 0 0 1 0 16M8 1a15 15 0 0 0 0 24M24 1a15 15 0 0 1 0 24"/><circle cx="16" cy="13" r="3"/></svg><strong>BROADCAST</strong><small>REVIEW TO AUTHORIZE</small></button></div><p>Only explicit confirmation enters the durable queue.</p>
     {review&&selected?.state==='draft'&&!editing&&<div className="pci-broadcast-confirm bc-confirm-box"><h3>Authorize this exact saved payload?</h3><strong>{selected.title}</strong><p className="bc-exact-body">{selected.body||'No caption'}</p><small>Media: {selected.media_ref||'None'}</small><small>Channels: {selected.deliveries.map(d=>labels[d.destination]).join(', ')}</small><p>It may be transmitted when an external dispatcher is configured, even if currently disabled.</p><div className="bc-actions"><button className="btn btn-primary" disabled={busy} onClick={()=>void act('confirm')}>Confirm transmission</button><button className="btn btn-secondary" disabled={busy} onClick={()=>setReview(false)}>Back</button></div></div>}
     {canCancel&&<div className="bc-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>void act('cancel')}>Cancel unclaimed broadcast</button></div>}
    </section>
   </div>
   <div className="bc-analytics">
    <section className="bc-panel"><div className="bc-panel-heading"><h2>Broadcast analytics</h2><span className="bc-tag">ENGINE RECORDS</span></div><p className="bc-sub">Latest 50 jobs · destination outcomes, not audience reach</p><div className="bc-kpis"><div><small>Delivered</small><strong>{data?delivered:'—'}</strong><span>Dispatcher reported</span></div><div><small>Failed / uncertain</small><strong>{data?attention:'—'}</strong><span>Needs attention</span></div><div><small>Pending / claimed</small><strong>{data?pendingCount:'—'}</strong><span>Confirmed jobs</span></div></div>
     <div className="bc-chart-head"><h3>Campaign activity · 7 days UTC</h3></div><p className="bc-help">Jobs created by day; confirmed reflects their current state. Latest 50 only.</p>{data?<><div className="bc-legend"><span><i/> Created</span><span><i/> Confirmed</span></div><div className="bc-chart"><svg viewBox="0 0 400 160" role="img" aria-label="Recent job creation and current confirmation counts by creation date"><defs><linearGradient id="bc-real-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#168fff" stopOpacity=".35"/><stop offset="100%" stopColor="#168fff" stopOpacity="0"/></linearGradient></defs>{[0,.5,1].map(r=><g key={r}><line className="bc-gridline" x1="40" x2="364" y1={127-105*r} y2={127-105*r}/><text className="bc-svg-label" x="34" y={130-105*r} textAnchor="end">{Number((chartMax*r).toFixed(1))}</text></g>)}<polygon points={`40,127 ${points('created')} 364,127`} fill="url(#bc-real-area)"/><polyline className="bc-line bc-line-blue" points={points('created')}/><polyline className="bc-line bc-line-cyan" points={points('confirmed')}/>{trend.map((r,i)=><g key={r.day}><circle className="bc-point" cx={40+i*54} cy={127-105*r.created/chartMax} r="3"/><text className="bc-svg-label" x={40+i*54} y="148" textAnchor="middle">{r.day.slice(5)}</text></g>)}</svg><div className="bc-chart-keys">{trend.map((r,i)=><button key={r.day} aria-pressed={activeDay===i} onClick={()=>setActiveDay(i)} onFocus={()=>setActiveDay(i)} onMouseEnter={()=>setActiveDay(i)}>{r.day.slice(5)}</button>)}</div><p className="bc-chart-detail">{activeDay===null?'Select a date for counts.':`${trend[activeDay].day}: ${trend[activeDay].created} created, ${trend[activeDay].confirmed} currently confirmed`}</p></div></>:<p className="bc-help">Waiting for engine data.</p>}
    </section>
    <section className="bc-panel"><div className="bc-panel-heading"><h2>Channel distribution</h2><span className="bc-tag">RECEIPTS</span></div><p className="bc-sub">Confirmed jobs · outcomes reported to PCI</p>{connected.map(ch=>{const rows=deliveries.filter(d=>d.destination===ch.id);const success=rows.filter(d=>d.status==='delivered').length;return <div className="bc-quota-row" key={ch.id}><div><span>{ch.name}</span><small>{success} / {rows.length} delivered</small></div><progress value={success} max={Math.max(1,rows.length)} aria-label={`${ch.name} delivered destinations`}/></div>;})}<div className="bc-map"><img className="bc-map-art" src="/broadcast/map.svg" alt="Decorative world map"/><p className="bc-help">Audience location and reach are not yet collected. No geographic metrics available.</p></div></section>
   </div>
   <section className="bc-panel bc-quota"><div className="bc-panel-heading"><h2>Channel capacity</h2><span className="bc-tag">NO LIVE QUOTA API</span></div><p className="bc-sub">No invented limits or combined quota. Each adapter will report its own usage when integrated.</p>{channels.map(ch=><div className="bc-quota-row" key={ch.id}><div><span>{ch.name}</span><small>{ch.mode}</small></div><span className="bc-quota-none">{ch.id==='whatsapp'?'Manual posting only':'Quota unavailable'}</span></div>)}</section>
  </div>
  <section className="bc-panel bc-log"><div className="bc-panel-heading"><h2>Transmission history</h2><span className="bc-tag">PERSISTED JOBS</span></div><div className="bc-job-summary" aria-label="Latest 50 broadcasts">{[['Drafts',count(['draft'])],['Queued / dispatching',count(['queued','dispatching'])],['Delivered',count(['delivered'])],['Attention / failed',count(['attention','failed','partial'])]].map(([label,value])=><span key={label}>{label}: <strong>{data?value:'—'}</strong></span>)}</div>{!jobs.length&&<p className="bc-help">{data?'No broadcasts yet.':'Waiting for engine data.'}</p>}<div className="pci-broadcast-job-list">{jobs.map(j=><button key={j.id} className="pci-broadcast-job" aria-pressed={j.id===selectedId} disabled={busy} onClick={()=>{setSelectedId(j.id);setReview(false);}}><span><strong>{j.title}</strong><small>{fmtDate(j.created_at)} · {j.deliveries.map(d=>labels[d.destination]).join(', ')}</small></span><span>{display(j.status)}</span></button>)}</div></section>
  {selected&&<div className="bc-detail-grid"><section className="bc-panel"><div className="bc-panel-heading"><h2>Channel delivery</h2></div>{selected.deliveries.map(d=><div key={d.id} className="pci-broadcast-delivery"><strong>{labels[d.destination]}</strong><span>{display(d.status)}</span>{d.external_id&&<small>Provider ID: {d.external_id}</small>}{d.result_code&&<small>Result: {d.result_code}</small>}{d.status==='uncertain'&&<small>Reconcile with provider. Do not automatically resend.</small>}</div>)}</section><section className="bc-panel"><div className="bc-panel-heading"><h2>Audit trail</h2></div>{history.length?history.map(h=><p key={h.id}>{display(h.event)} · {fmtDate(h.created_at)}</p>):<p className="bc-help">No events loaded.</p>}</section></div>}
 </section>;
}
export default function BroadcastPage(){return <RoleGate roles={['owner','editor']}><ControlRoom/></RoleGate>;}
