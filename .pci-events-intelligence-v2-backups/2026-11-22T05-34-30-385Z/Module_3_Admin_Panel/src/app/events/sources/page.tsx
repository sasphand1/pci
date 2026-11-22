'use client';
import {useMemo,useState,useEffect} from 'react';
import {Card,Notice} from '@pci/ui';
import {AdminPage,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';

type Source={id:string;name:string;feed_type:'rss'|'ics'|'json';feed_url:string;category:string;city_hint:string|null;enabled:boolean;official_confirmed:boolean;rights_confirmed:boolean;last_status:string;last_sync_at:string|null;last_error:string|null;last_imported:number;total_events:number;reviewed_events:number};
type EventItem={id:string;name:string;source_name:string;source_feed_url:string;start_at:string;city:string;category:string;venue:string;latitude:number|null;longitude:number|null;approved:boolean;event_url:string|null;ticket_type:string;price_text:string};
type Run={id:string;source_name:string;status:string;imported:number;rejected:number;detail:string|null;created_at:string};
type EditorialEvent={id:string;name:string;city:string;venue:string;start_at:string;source_url:string;approved:boolean};
type ProviderPreset={key:string;name:string;feed_type:'json'|'ics'|'rss';category:string;feed_url:string;documentation:string;attribution:string;notes:string;verification:string};
type FeedProbe={inspected:number;candidates:number;rejected:number;geolocated:number;published:number;note:string};
const CATEGORY_OPTIONS=[['sports','Sports'],['education','Education & Learning'],['gaming','Gaming & Esports'],['technology','Technology & Innovation'],['business','Business & Expos'],['arts','Arts & Entertainment'],['community','Community & Festivals'],['expos','Legacy: Expos'],['conferences','Legacy: Conferences']];
const empty:Omit<Source,'id'|'last_status'|'last_sync_at'|'last_error'|'last_imported'|'total_events'|'reviewed_events'>={name:'',feed_type:'ics',feed_url:'',category:'community',city_hint:null,enabled:false,official_confirmed:false,rights_confirmed:false};
const fresh=()=>({...empty});
function SourceEditor({source,onSave,onCancel,busy}:{source:Partial<Source>;onSave:(draft:typeof empty)=>Promise<void>;onCancel:()=>void;busy:boolean}){
 const [form,setForm]=useState<typeof empty>({...fresh(),...source});
 useEffect(()=>setForm({...fresh(),...source}),[source.id]);
 const set=<K extends keyof typeof empty>(key:K,value:(typeof empty)[K])=>setForm(p=>({...p,[key]:value}));
 return <form className="pci-ef-form" onSubmit={async e=>{e.preventDefault();await onSave(form);}}>
  <div className="pci-ef-grid">
   <label>Source name<input value={form.name} onChange={e=>set('name',e.target.value)} required minLength={2} maxLength={140} placeholder="Official organizer calendar" /></label>
   <label>Format<select value={form.feed_type} onChange={e=>set('feed_type',e.target.value as typeof form.feed_type)}><option value="ics">iCalendar (.ics)</option><option value="rss">RSS / Atom</option><option value="json">Structured JSON</option></select></label>
   <label className="pci-ef-wide">Official HTTPS feed URL<input type="url" value={form.feed_url} onChange={e=>set('feed_url',e.target.value)} required pattern="https://.*" placeholder="https://organizer.example/calendar.ics" /></label>
   <label>Category<select value={form.category} onChange={e=>set('category',e.target.value)}>{CATEGORY_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   <label>City scope<select value={form.city_hint||''} onChange={e=>set('city_hint',e.target.value||null)}><option value="">Detect city from event</option><option>Karachi</option><option>Lahore</option><option>Islamabad</option></select></label>
  </div>
  <p className="fineprint">City scope is for a verified single-city organizer feed. Do not use it to guess where an event takes place. RSS must contain event dates, not only article publishing dates.</p>
  <div className="pci-ef-checks">
   <label><input type="checkbox" checked={form.official_confirmed} onChange={e=>set('official_confirmed',e.target.checked)}/> I verified this is an official event source</label>
   <label><input type="checkbox" checked={form.rights_confirmed} onChange={e=>set('rights_confirmed',e.target.checked)}/> PCI has permission to reuse the event details</label>
   <label><input type="checkbox" checked={form.enabled} onChange={e=>set('enabled',e.target.checked)}/> Enable collection</label>
  </div>
  <div className="pci-ef-actions"><button disabled={busy} className="btn btn-primary">{busy?'Saving…':'Save source'}</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
 </form>;
}
function EventReview({item,busy,onReview}:{item:EventItem;busy:boolean;onReview:(item:EventItem,approved:boolean,latitude:number|null,longitude:number|null)=>Promise<void|boolean>}){
 const [lat,setLat]=useState(item.latitude===null?'':String(item.latitude));const [lng,setLng]=useState(item.longitude===null?'':String(item.longitude));
 useEffect(()=>{setLat(item.latitude===null?'':String(item.latitude));setLng(item.longitude===null?'':String(item.longitude));},[item.latitude,item.longitude]);
 const apply=(approved:boolean)=>onReview(item,approved,lat.trim()===''?null:Number(lat),lng.trim()===''?null:Number(lng));
 return <tr><td><strong>{item.name}</strong><div className="fineprint">{item.source_name}</div></td><td>{item.city}<div className="fineprint">{item.venue}</div></td>
  <td>{fmtDate(item.start_at)}</td><td><label className="pci-ef-coord">Latitude<input aria-label={`Latitude for ${item.name}`} value={lat} onChange={e=>setLat(e.target.value)} inputMode="decimal"/></label><label className="pci-ef-coord">Longitude<input aria-label={`Longitude for ${item.name}`} value={lng} onChange={e=>setLng(e.target.value)} inputMode="decimal"/></label></td>
  <td>{item.event_url?<a href={item.event_url} rel="noopener noreferrer" target="_blank">Event announcement</a>:<a href={item.source_feed_url} rel="noopener noreferrer" target="_blank">Original feed</a>}</td>
  <td><span className={`pci-ef-status ${item.approved?'is-good':'is-waiting'}`}>{item.approved?'Published':'Pending'}</span></td>
  <td className="pci-ef-row-actions"><button type="button" className="btn btn-primary" disabled={busy||item.approved} onClick={()=>apply(true)}>Approve</button><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>apply(false)}>{item.approved?'Unpublish':'Reject'}</button></td></tr>;
}
export default function EventSources(){
 const {identity}=useAuth();const owner=identity?.role==='owner';
 const [sources,setSources]=useState<Source[]>([]),[events,setEvents]=useState<EventItem[]>([]),[runs,setRuns]=useState<Run[]>([]),[catalog,setCatalog]=useState<ProviderPreset[]>([]),[probes,setProbes]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true),[working,setWorking]=useState(''),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [editorialRows,setEditorialRows]=useState<EditorialEvent[]>([]);
 const [editorialDraft,setEditorialDraft]=useState({name:'',start_local:'',end_local:'',city:'Islamabad',category:'expos',venue:'',latitude:'',longitude:'',source_url:'',organizer:'',confirmed_official:false});
 const [editing,setEditing]=useState<Source|null|undefined>(undefined);const [showAdd,setShowAdd]=useState(false);
 const [city,setCity]=useState('all'),[review,setReview]=useState('pending');
 async function load(){setLoading(true);try{const [a,b,c,d]=await Promise.all([
 api<Source[]>('/admin/events/sources'),api<EventItem[]>('/admin/events/list?limit=300'),api<Run[]>('/admin/events/runs'),api<ProviderPreset[]>('/admin/events/catalog')]);
 setSources(a);setEvents(b);setRuns(c);
 const editorials=await api<EditorialEvent[]>('/admin/events/editorial');setEditorialRows(editorials);setCatalog(d);setError('');}catch(e){setError(errorText(e));}finally{setLoading(false);}}
 useEffect(()=>{if(identity&&identity.role!=='moderator')void load();},[identity?.id]);
 async function action(key:string,work:()=>Promise<unknown>,message:string):Promise<boolean>{setWorking(key);setError('');setOk('');try{await work();setOk(message);await load();return true;}catch(e){setError(errorText(e));return false;}finally{setWorking('');}}
 async function probePreset(key:string){
 setWorking(key+'-probe');setError('');
 try{const result=await api<FeedProbe>('/admin/events/catalog/'+encodeURIComponent(key)+'/test',{method:'POST',csrf:identity?.csrfToken});
  setProbes(p=>({...p,[key]:`${result.candidates} suitable Pakistan event candidates · ${result.inspected} scanned · ${result.rejected} rejected · ${result.geolocated} geolocated. No records published.`}));
 }catch(e){setProbes(p=>({...p,[key]:'Feed test failed: '+errorText(e)}));}
 finally{setWorking('');}
}
async function publishEditorial(){
  const v=editorialDraft;
  if(!v.confirmed_official){setError('Verify the primary announcement and real venue before publishing.');return;}
  const iso=(s:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)?s+':00+05:00':s;
  const body={name:v.name,start_at:iso(v.start_local),end_at:iso(v.end_local),city:v.city,category:v.category,
   venue:v.venue,latitude:Number(v.latitude),longitude:Number(v.longitude),source_url:v.source_url,
   organizer:v.organizer,description:'',confirmed_official:true};
  const saved=await action('editorial-publish',()=>api('/admin/events/editorial',{method:'POST',csrf:identity?.csrfToken,body}),
   'Verified event published. It will appear on the public map.');
  if(saved)setEditorialDraft({name:'',start_local:'',end_local:'',city:'Islamabad',category:'expos',venue:'',latitude:'',longitude:'',source_url:'',organizer:'',confirmed_official:false});
 }
 async function setEditorialVisibility(id:string,approved:boolean){
  await action('editorial-'+id,()=>api('/admin/events/editorial/'+id+'/visibility',{method:'PATCH',csrf:identity?.csrfToken,body:{approved}}),
   approved?'Verified event republished.':'Editorial event unpublished.');
 }
 async function save(body:typeof empty){const saved=await action('save',async()=>{
  if(editing)await api('/admin/events/sources/'+editing.id,{method:'PATCH',csrf:identity?.csrfToken,body});
  else await api('/admin/events/sources',{method:'POST',csrf:identity?.csrfToken,body});
 },'Source saved. Material feed changes reset event approvals.');if(saved){setEditing(undefined);setShowAdd(false);}}
 const visible=useMemo(()=>events.filter(e=>(city==='all'||e.city===city)&&(review==='all'||(review==='published'?e.approved:!e.approved))),[events,city,review]);
 return <RoleGate roles={['owner','editor']}><AdminPage title="Event sources" description="Manage official event APIs, RSS and public calendars for Karachi, Lahore and Islamabad. Imported items never go live without review." action={<button className="btn btn-secondary" type="button" onClick={()=>void load()} disabled={loading}>Refresh</button>}>
  {error&&<Notice tone="danger">{error}</Notice>}{ok&&<Notice>{ok}</Notice>}
  <div className="pci-ef-stats"><div><strong>{sources.length}</strong><span>Configured sources</span></div><div><strong>{sources.filter(s=>s.enabled&&s.official_confirmed&&s.rights_confirmed).length}</strong><span>Approved & enabled</span></div><div><strong>{events.filter(e=>!e.approved).length}</strong><span>Awaiting event review</span></div><div><strong>{events.filter(e=>e.approved).length}</strong><span>Approved records</span></div></div>
  <div className="admin-callout">Only original organizer/API/calendar feeds should be added. No newspaper scraping. No fabricated coordinates, event dates or ticket prices. Public events are visible only after Owner approval. If a feed changes material details, its event automatically returns to review.</div>
  <Card><div className="pci-ef-heading"><h2>Live data integrations</h2><span className="muted">Free public feed endpoints · verify coverage before activation</span></div>
    <p className="muted">These are real, documented third-party feeds, not seeded events. Test each feed to see whether it contains future Pakistan events. Adding a source never authorizes publication: the Owner must confirm provenance and reuse rights, enable the source, sync, and approve event coordinates.</p>
    <div className="pci-ef-source-list">{catalog.map(p=><article key={p.key} className="pci-ef-source">
      <div className="pci-ef-source-main"><div><h3>{p.name}</h3><p className="fineprint">{p.feed_type.toUpperCase()} · {p.category} · {p.attribution}</p><p className="fineprint">{p.notes}</p>
      <a className="pci-ef-url" href={p.documentation} target="_blank" rel="noopener noreferrer">Provider documentation</a></div>
      <span className="pci-ef-status">{sources.some(s=>s.feed_url===p.feed_url)?'Installed':'Available'}</span></div>
      {probes[p.key]&&<p role="status" className="fineprint">{probes[p.key]}</p>}
      {owner&&<div className="pci-ef-actions"><button type="button" className="btn btn-secondary" disabled={!!working} onClick={()=>void probePreset(p.key)}>{working===p.key+'-probe'?'Testing…':'Test live feed'}</button>
      <button type="button" className="btn btn-primary" disabled={!!working||sources.some(s=>s.feed_url===p.feed_url)} onClick={()=>void action(p.key+'-install',()=>api('/admin/events/catalog/'+encodeURIComponent(p.key)+'/install',{method:'POST',csrf:identity?.csrfToken}),'Feed added in DISABLED state. Verify rights, activate, synchronize and review results below.')}>Add to my sources</button></div>}
     </article>)}</div>
    {!catalog.length&&!loading&&<p className="muted">No catalog response. Check backend deployment and reload.</p>}
  </Card>

  <Card><div className="pci-ef-heading"><h2>Publish verified organiser announcement</h2><span className="muted">Owner only · direct, source-linked event publication</span></div>
   <p className="fineprint">Use this when the organizer has a real announcement but no machine-readable feed. Confirm the actual venue, date and coordinates using the official announcement. No fabricated tickets, maps or dates.</p>
   {owner&&<form className="pci-ef-form" onSubmit={e=>{e.preventDefault();void publishEditorial();}}>
     <div className="pci-ef-grid">
       <label className="pci-ef-wide">Official event name<input required maxLength={180} value={editorialDraft.name} onChange={e=>setEditorialDraft(p=>({...p,name:e.target.value}))} placeholder="Name exactly as announced"/></label>
       <label>Start (Pakistan time)<input required type="datetime-local" value={editorialDraft.start_local} onChange={e=>setEditorialDraft(p=>({...p,start_local:e.target.value}))}/></label>
       <label>End (Pakistan time)<input required type="datetime-local" value={editorialDraft.end_local} onChange={e=>setEditorialDraft(p=>({...p,end_local:e.target.value}))}/></label>
       <label>City<select value={editorialDraft.city} onChange={e=>setEditorialDraft(p=>({...p,city:e.target.value}))}><option>Karachi</option><option>Lahore</option><option>Islamabad</option></select></label>
       <label>Category<select value={editorialDraft.category} onChange={e=>setEditorialDraft(p=>({...p,category:e.target.value}))}>{CATEGORY_OPTIONS.map(([id,title])=><option key={id} value={id}>{title}</option>)}</select></label>
       <label className="pci-ef-wide">Verified venue<input required maxLength={200} value={editorialDraft.venue} onChange={e=>setEditorialDraft(p=>({...p,venue:e.target.value}))}/></label>
       <label>Venue latitude<input required type="number" step="any" value={editorialDraft.latitude} onChange={e=>setEditorialDraft(p=>({...p,latitude:e.target.value}))}/></label>
       <label>Venue longitude<input required type="number" step="any" value={editorialDraft.longitude} onChange={e=>setEditorialDraft(p=>({...p,longitude:e.target.value}))}/></label>
       <label className="pci-ef-wide">Official organizer or venue announcement URL<input required type="url" pattern="https://.*" value={editorialDraft.source_url} onChange={e=>setEditorialDraft(p=>({...p,source_url:e.target.value}))} placeholder="https://official-organizer.example/event"/></label>
       <label className="pci-ef-wide">Organizer (optional)<input value={editorialDraft.organizer} onChange={e=>setEditorialDraft(p=>({...p,organizer:e.target.value}))}/></label>
     </div>
     <div className="pci-ef-checks"><label><input required type="checkbox" checked={editorialDraft.confirmed_official} onChange={e=>setEditorialDraft(p=>({...p,confirmed_official:e.target.checked}))}/> I checked the organizer announcement and exact venue coordinates</label></div>
     <button type="submit" className="btn btn-primary" disabled={!!working}>{working==='editorial-publish'?'Publishing…':'Publish verified event'}</button>
   </form>}
   {!owner&&<p className="muted">Only the Owner can publish or unpublish editorial events.</p>}
   {editorialRows.length>0&&<div className="table-wrap"><table className="data-table admin-table"><thead><tr><th>Verified event</th><th>City</th><th>Start</th><th>Original source</th><th>Publication</th></tr></thead><tbody>{editorialRows.map(ev=><tr key={ev.id}><td><strong>{ev.name}</strong><div className="fineprint">{ev.venue}</div></td><td>{ev.city}</td><td>{fmtDate(ev.start_at)}</td><td><a target="_blank" rel="noopener noreferrer" href={ev.source_url}>Original announcement</a></td><td>{owner?<button className="btn btn-secondary" type="button" disabled={!!working} onClick={()=>void setEditorialVisibility(ev.id,!ev.approved)}>{ev.approved?'Unpublish':'Republish'}</button>:(ev.approved?'Published':'Unpublished')}</td></tr>)}</tbody></table></div>}
  </Card>
  <Card><div className="pci-ef-heading"><h2>Source connections</h2>{owner&&<button className="btn btn-primary" onClick={()=>{setShowAdd(true);setEditing(null);}}>Add source</button>}</div>
    {(showAdd||editing)&&owner&&<SourceEditor key={editing?.id||'new'} source={editing||fresh()} busy={working==='save'} onSave={save} onCancel={()=>{setShowAdd(false);setEditing(undefined);}}/>}
    {loading&&<p role="status">Loading sources…</p>}
    {!loading&&!sources.length&&<p className="muted">No sources configured. Add an authorized RSS, iCalendar or structured JSON feed. Nothing will be published until approved.</p>}
    <div className="pci-ef-source-list">{sources.map(s=><article key={s.id} className="pci-ef-source"><div className="pci-ef-source-main"><div><h3>{s.name}</h3><p className="fineprint">{s.feed_type.toUpperCase()} · {s.city_hint||'Detect city'} · {s.category}</p><a className="pci-ef-url" href={s.feed_url} target="_blank" rel="noopener noreferrer">{s.feed_url}</a></div><span className={`pci-ef-status ${s.enabled&&s.official_confirmed&&s.rights_confirmed?'is-good':'is-waiting'}`}>{s.enabled&&s.official_confirmed&&s.rights_confirmed?'Enabled':'Inactive'}</span></div>
      <div className="pci-ef-source-meta">Last sync: {fmtDate(s.last_sync_at)} · {s.last_status} · {s.last_imported||0} imported · {s.reviewed_events||0} approved {s.last_error&&<span className="pci-ef-error"> · {s.last_error}</span>}</div>
      {owner&&<div className="pci-ef-actions"><button className="btn btn-secondary" disabled={!!working} onClick={()=>{setEditing(s);setShowAdd(false);}}>Edit / Enable / Disable</button><button className="btn btn-secondary" disabled={!!working} onClick={()=>void action(s.id+'test',()=>api('/admin/events/sources/'+s.id+'/test',{method:'POST',csrf:identity?.csrfToken}),'Feed test completed. It does not publish any entries.')}>{working===s.id+'test'?'Testing…':'Test feed'}</button><button className="btn btn-primary" disabled={!!working||!s.enabled||!s.official_confirmed||!s.rights_confirmed} onClick={()=>void action(s.id+'sync',()=>api('/admin/events/sources/'+s.id+'/sync',{method:'POST',csrf:identity?.csrfToken}),'Feed synchronized. Review imported events before publication.')}>{working===s.id+'sync'?'Syncing…':'Sync now'}</button></div>}
     </article>)}</div>
  </Card>
  <Card><div className="pci-ef-heading"><h2>Event review queue</h2><div className="pci-ef-filters"><select aria-label="Filter city" value={city} onChange={e=>setCity(e.target.value)}><option value="all">All three cities</option><option>Karachi</option><option>Lahore</option><option>Islamabad</option></select><select aria-label="Filter review status" value={review} onChange={e=>setReview(e.target.value)}><option value="pending">Pending</option><option value="published">Published</option><option value="all">All events</option></select></div></div>
  {!visible.length?<p className="muted">No matching imported events.</p>:<div className="table-wrap"><table className="data-table admin-table pci-ef-table"><thead><tr><th>Event</th><th>Venue</th><th>Date</th><th>Location coordinates</th><th>Evidence</th><th>Status</th><th>Review</th></tr></thead><tbody>{visible.map(e=><EventReview key={e.id} item={e} busy={!!working||!owner} onReview={(it,approved,latitude,longitude)=>action(it.id,()=>api('/admin/events/list/'+it.id,{method:'PATCH',csrf:identity?.csrfToken,body:{approved,latitude,longitude}}),approved?'Event published after review.':'Event unpublished.')}/>)}</tbody></table></div>}
  </Card>
  <Card><h2>Recent source syncs</h2>{!runs.length?<p className="muted">No sync runs recorded.</p>:<div className="table-wrap"><table className="data-table admin-table"><thead><tr><th>Source</th><th>Started</th><th>Status</th><th>Imported</th><th>Rejected</th><th>Note</th></tr></thead><tbody>{runs.slice(0,30).map(r=><tr key={r.id}><td>{r.source_name}</td><td>{fmtDate(r.created_at)}</td><td>{r.status}</td><td>{r.imported}</td><td>{r.rejected}</td><td>{r.detail||'—'}</td></tr>)}</tbody></table></div>}</Card>
 </AdminPage></RoleGate>;
}
