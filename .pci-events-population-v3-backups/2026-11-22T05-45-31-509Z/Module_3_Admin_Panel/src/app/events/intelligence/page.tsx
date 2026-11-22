'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AdminPage,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import {EventsSourcesDiscovery} from '@/components/EventsSourcesDiscovery';

type Category={id:string;label:string};
type Source={id:string;name:string;feed_type:string;enabled:boolean;official_confirmed:boolean;rights_confirmed:boolean;last_status:string;last_error:string|null;last_sync_at:string|null;last_success_at:string|null;last_imported:number;recently_healthy:boolean};
type Overview={counts:{total:number;pending:number;published:number;rejected:number;unclassified:number;ambiguous:number;editorial_total:number;editorial_published:number};categories:Category[];breakdown:{category:string;total:number;published:number}[];sources:Source[];engineVersion:string;safety:{automaticPublication:boolean}};
type BucketEvent={id:string;origin:'feed'|'editorial';name:string;city:string;venue:string;start_at:string;latitude:number|null;longitude:number|null;category:string;confidence:number|null;classification_state:string;reason:string|null;approved:boolean;review_decision:string;source_url:string|null;source_name:string;source_ready:boolean;possible_duplicate:boolean;deleted_at:string|null};
const STATUS_OPTIONS=[['pending','Pending review'],['published','Published'],['rejected','Rejected'],['expired','Expired'],['deleted','Deleted'],['all','All events']] as const;
function normalizeError(e:unknown){return errorText(e);}
function SourceCard({source}:{source:Source}){
 const ready=source.enabled&&source.official_confirmed&&source.rights_confirmed;
 return <article className="admin-setting-card pci-ei-source">
  <div className="pci-ei-source-top"><h3>{source.name}</h3><span className={`pci-ei-pill ${ready?'is-ready':''}`}>{ready?'Enabled':'Disabled / unverified'}</span></div>
  <p>{source.feed_type.toUpperCase()} · {source.last_status} · {source.last_imported||0} imported</p>
  <p className="fineprint">Last sync: {fmtDate(source.last_sync_at)} · Last success: {fmtDate(source.last_success_at)}</p>
  {source.last_error&&<p className="pci-ei-error" role="status">{source.last_error}</p>}
 </article>;
}
function BucketRow({item,categories,owner,busy,onAction,onDelete,onRestore}:{item:BucketEvent;categories:Category[];owner:boolean;busy:boolean;onAction:(e:BucketEvent,category:string,decision:'categorize'|'approve'|'reject'|'review')=>Promise<void>;onDelete:(e:BucketEvent)=>Promise<void>;onRestore:(e:BucketEvent)=>Promise<void>}){
 const [category,setCategory]=useState(item.category);
 useEffect(()=>setCategory(item.category),[item.category]);
 const ready=item.origin==='editorial'||item.source_ready;
 const located=typeof item.latitude==='number'&&typeof item.longitude==='number';
 const status=item.deleted_at?'Deleted':item.approved?(ready?'Published':'Hidden: source disabled'):item.review_decision==='rejected'?'Rejected':'Needs review';
 return <tr>
  <td><strong>{item.name}</strong><small className="pci-ei-source-label">{item.source_name}</small></td>
  <td>{item.city}<small className="pci-ei-source-label">{item.venue}</small></td>
  <td>{fmtDate(item.start_at)}</td>
  <td><select aria-label={`Category for ${item.name}`} disabled={!owner||busy||Boolean(item.deleted_at)} value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select><small className="pci-ei-source-label">{item.confidence??'—'}% · {item.classification_state}</small></td>
  <td><span className={`pci-ei-pill ${item.approved?'is-ready':''}`}>{status}</span><small className="pci-ei-source-label">{item.possible_duplicate?'Possible duplicate; review source':!ready?'Source not approved':!located?'Venue coordinates missing':item.reason||'Verified'}</small></td>
  <td>{item.source_url?.startsWith('https://')?<a href={item.source_url} target="_blank" rel="noopener noreferrer">Source</a>:'—'}</td>
  <td><div className="pci-ei-actions">
   <button type="button" className="btn btn-secondary" disabled={!owner||busy||Boolean(item.deleted_at)||category===item.category} onClick={()=>void onAction(item,category,'categorize')}>Set category</button>
   <button type="button" className="btn btn-primary" disabled={!owner||busy||Boolean(item.deleted_at)||!ready||!located||item.approved} title={!located?'Verify venue coordinates in Event sources first':undefined} onClick={()=>void onAction(item,category,'approve')}>Approve</button>
   <button type="button" className="btn btn-secondary" disabled={!owner||busy||Boolean(item.deleted_at)||(!item.approved&&item.review_decision==='rejected')} onClick={()=>void onAction(item,category,'reject')}>Reject</button>
   {owner&&(item.deleted_at?<button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>void onRestore(item)}>Restore</button>:<button type="button" className="btn pci-ei-delete" disabled={busy} onClick={()=>void onDelete(item)}>Delete</button>)}
  </div></td>
 </tr>;
}
export default function EventsIntelligence(){
 const {identity}=useAuth();const owner=identity?.role==='owner';
 const [overview,setOverview]=useState<Overview|null>(null);
 const [bucket,setBucket]=useState<BucketEvent[]>([]);
 const [category,setCategory]=useState('all'),[status,setStatus]=useState('pending'),[search,setSearch]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 async function load(){setLoading(true);try{
  const q=new URLSearchParams({category,status,search,limit:'100'});
  const [summary,rows]=await Promise.all([
   api<Overview>('/admin/events/intelligence/overview'),
   api<BucketEvent[]>('/admin/events/intelligence/bucket?'+q.toString())
  ]);
  setOverview(summary);setBucket(rows);setError('');
 }catch(e){setError(normalizeError(e));}finally{setLoading(false);}}
 useEffect(()=>{if(identity&&identity.role!=='moderator')void load();},[identity?.id,category,status,search]);
 async function update(item:BucketEvent,nextCategory:string,decision:'categorize'|'approve'|'reject'|'review'){
  setBusy(true);setError('');setNotice('');try{
   await api(`/admin/events/intelligence/bucket/${item.origin}/${item.id}`,{method:'PATCH',csrf:identity?.csrfToken,body:{category:nextCategory,decision}});
   setNotice(decision==='categorize'?'Category saved; publication requires review.':'Event review saved.');await load();
  }catch(e){setError(normalizeError(e));}finally{setBusy(false);}
 }
 async function deleteEvent(item:BucketEvent){
  if(!owner||!window.confirm(`Remove "${item.name}" from all public listings? This can be restored only as pending review.`))return;
  const reason=window.prompt('Deletion reason (minimum 5 characters; recorded in audit log):');
  if(!reason||reason.trim().length<5)return;
  setBusy(true);setError('');setNotice('');
  try{await api(`/admin/events/intelligence/bucket/${item.origin}/${item.id}`,{method:'DELETE',csrf:identity?.csrfToken,body:{confirm:'DELETE',reason:reason.trim()}});setNotice('Event deleted. Scheduled sync cannot restore it.');await load();}
  catch(e){setError(normalizeError(e));}finally{setBusy(false);}
 }
 async function restoreEvent(item:BucketEvent){
  if(!owner||!window.confirm(`Restore "${item.name}" into the review bucket? It will NOT be published automatically.`))return;
  setBusy(true);setError('');setNotice('');
  try{await api(`/admin/events/intelligence/bucket/${item.origin}/${item.id}/restore`,{method:'POST',csrf:identity?.csrfToken,body:{confirm:'RESTORE',reason:'Owner restored for manual review'}});setNotice('Event restored as pending review.');await load();}
  catch(e){setError(normalizeError(e));}finally{setBusy(false);}
 }
 async function classifyPending(){setBusy(true);setError('');setNotice('');try{
  const r=await api<{processed:number;alreadyRunning:boolean}>('/admin/events/intelligence/classify-pending',{method:'POST',csrf:identity?.csrfToken});
  setNotice(r.alreadyRunning?'Another classification batch is already running.':`${r.processed} older events classified. Approval status unchanged.`);await load();
 }catch(e){setError(normalizeError(e));}finally{setBusy(false);}}
 const categories=overview?.categories??[];
 const counts=overview?.counts;
 const stats=useMemo(()=>[
  ['Imported',counts?.total??0],['Pending',counts?.pending??0],['Published',(counts?.published??0)+(counts?.editorial_published??0)],
  ['Ambiguous',counts?.ambiguous??0],['Unclassified',counts?.unclassified??0],['Rejected',counts?.rejected??0]
 ],[counts]);
 return <RoleGate roles={['owner','editor']}><AdminPage title="Events Intelligence" description="Ten-category event classification, safe review buckets, data-source health and controlled publication. Same management layout as Satellite APIs." action={<button className="btn btn-secondary" disabled={loading||busy} onClick={()=>void load()}>Refresh</button>}>
  {error&&<p role="alert" className="pci-ei-error">{error}</p>}{notice&&<p role="status" className="admin-callout">{notice}</p>}
  <div className="pci-ei-stats" aria-label="Events engine totals">{stats.map(([title,value])=><div key={title}><strong>{value}</strong><span>{title}</span></div>)}</div>
  <div className="admin-callout">Classification uses deterministic, auditable rules. Low-confidence records are flagged for review. Source authorization, actual venue coordinates and Owner approval are required before an imported event appears publicly. The creator engine and Satellite pipeline remain isolated.</div>
  <section className="pci-ei-section"><div className="pci-ei-heading"><div><h2>Events Bucket</h2><p className="muted">Classify, review, approve or reject. Changes are audited.</p></div><button type="button" className="btn btn-secondary" disabled={!owner||busy} onClick={()=>void classifyPending()}>Classify older records</button></div>
   <div className="pci-ei-filters">
    <label>Status<select value={status} onChange={e=>setStatus(e.target.value)}>{STATUS_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
    <label>Category<select value={category} onChange={e=>setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
    <label>Search<input type="search" placeholder="Event name or venue" value={search} onChange={e=>setSearch(e.target.value)}/></label>
   </div>
   <div className="table-wrap pci-ei-table-wrap"><table className="data-table admin-table pci-ei-table"><thead><tr><th>Event</th><th>Location</th><th>Date (PKT)</th><th>Classification</th><th>Review status</th><th>Evidence</th><th>Actions</th></tr></thead><tbody>
    {bucket.map(e=><BucketRow key={`${e.origin}-${e.id}`} item={e} categories={categories} owner={owner} busy={busy} onAction={update} onDelete={deleteEvent} onRestore={restoreEvent}/>)}
   </tbody></table>{!loading&&!bucket.length&&<p className="muted pci-ei-empty">No events match this bucket filter.</p>}{loading&&<p role="status">Loading events…</p>}</div>
   <p className="fineprint">Displays up to 100 records per view. Missing coordinates can be corrected at <Link href="/events/sources">Event sources</Link>; they are never guessed.</p>
  </section>
  <section className="pci-ei-section"><div className="pci-ei-heading"><div><h2>Ten Categories</h2><p className="muted">Central classification labels; no extra top-level public navigation tabs.</p></div></div><div className="pci-ei-category-grid">
   {categories.map(c=>{const b=overview?.breakdown.find(x=>x.category===c.id);return <div className="admin-setting-card" key={c.id}><strong>{c.label}</strong><p>{b?.total??0} imported · {b?.published??0} published</p></div>;})}
  </div></section>
  <EventsSourcesDiscovery/>
  <section className="pci-ei-section"><div className="pci-ei-heading"><div><h2>Sources & Engine Health</h2><p className="muted">Read-only health summary. Source edits, test fetch and sync remain in the existing Events Sources page.</p></div><Link className="btn btn-secondary" href="/events/sources">Manage sources</Link></div><div className="admin-setting-grid">
    {(overview?.sources??[]).map(s=><SourceCard key={s.id} source={s}/>)}
   </div>{!overview?.sources.length&&<p className="muted">No sources configured yet. Configure verified feeds through Event sources.</p>}
   <p className="fineprint">Rule version: {overview?.engineVersion??'Unavailable'}. Sources with missing permissions or disabled credentials are not fetched. Published records require human approval.</p>
  </section>
 </AdminPage></RoleGate>;
}
