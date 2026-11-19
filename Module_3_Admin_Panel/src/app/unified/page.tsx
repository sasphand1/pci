'use client';
import {useState} from 'react';
import {Card} from '@pci/ui';
import {AdminPage,RoleGate,Status,DataBlock,TableWrap,useData} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
type Person={id:string;displayName:string;channelId:string;humanReviewStatus:'pending'|'approved'|'rejected';enabled:boolean;categoryIds:string[]};
type Category={id:string;label:string;slug:string};
type EngineStatus={summary:{total:number;eligible:number;ineligible:number;byReason:Record<string,number>;byPrimaryReason:Record<string,number>};
 creators:{id:string;reasons:string[];lastOutcome:string|null;lastDetail:string|null}[];
 worker:{anyAlive:boolean;apiSyncEnabled:boolean;youtubeKeyConfigured:boolean;embeddedScheduler:boolean;heartbeats:{workerId:string;lastSeenAt:string;alive:boolean}[]};
 recentRuns:{status:string;createdAt:string;finishedAt:string|null;channelCount:number;errorCode:string|null}[];publishedAt:string|null};
const REASON_TEXT:Record<string,string>={disabled:'Disabled',rejected:'Rejected by reviewer',not_approved:'Awaiting human approval',no_snapshot:'Never synchronized',not_returned_by_youtube:'YouTube did not return this channel ID',sync_failed:'Last sync failed',metric_hidden:'Subscriber count hidden or missing',stale:'Statistics older than 36 hours'};
export default function UnifiedReview(){
 const {identity}=useAuth(),csrf=identity?.csrfToken;
 const engine=useData<EngineStatus>('/admin/engine/status');const [selected,setSelected]=useState<string[]>([]);
 const people=useData<Person[]>('/admin/unified/creators');const categories=useData<Category[]>('/admin/categories');
 const [search,setSearch]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function action(work:()=>Promise<unknown>,message:string){setBusy(true);setError('');setOk('');try{await work();setOk(message);people.reload();engine.reload();}catch(e){setError(errorText(e));}finally{setBusy(false)}}
 async function review(p:Person,decision:'approved'|'rejected'|'pending'){
  if(decision==='approved'&&!window.confirm(`I have verified that ${p.displayName} is one real individual human YouTuber, not a business, brand, production house, institution, team or generic channel. Approve?`))return;
  await action(()=>api(`/admin/unified/creators/${p.id}/review`,{method:'PATCH',csrf,body:{decision,humanConfirmed:decision==='approved'}}),`Human eligibility set to ${decision}.`);
 }
 async function bulkReview(decision:'approved'|'rejected'|'pending'){
  if(!selected.length)return;
  if(decision==='approved'&&!window.confirm(`I have personally verified that each of the ${selected.length} selected creators is one real individual human YouTuber, not a business, brand, production house, institution, team or generic channel. Approve all ${selected.length}?`))return;
  await action(async()=>{await api('/admin/unified/creators/bulk-review',{method:'POST',csrf,body:{ids:selected,decision,humanConfirmed:decision==='approved',expectedCount:selected.length}});setSelected([]);},`${selected.length} creators set to ${decision}.`);
 }
 async function updateCategories(p:Person,categoryId:string,checked:boolean){
  const categoryIds=checked?[...new Set([...p.categoryIds,categoryId])]:p.categoryIds.filter(id=>id!==categoryId);
  await action(()=>api(`/admin/creators/${p.id}`,{method:'PATCH',csrf,body:{categoryIds}}),'Category updated for this person across linked accounts.');
 }
 const reasonById=new Map((engine.data?.creators??[]).map(c=>[c.id,c]));
 const visible=(people.data??[]).filter(p=>`${p.displayName} ${p.channelId}`.toLowerCase().includes(search.toLowerCase()));
 return <RoleGate roles={['owner','editor']}><AdminPage title="Unified human creators" description="One identity per human YouTuber. Verify eligibility and assign shared editorial categories. The original YouTube and Instagram registration screens remain available." action={<button className="btn btn-secondary" onClick={()=>people.reload()}>Reload</button>}>
 <Status error={error} ok={ok}/><Card><p className="muted">Only manually approved individuals qualify for the unified Top 20 wheel and Top 100 table. Organizations and generic channels remain stored in YouTube but excluded from human rankings.</p>
 {engine.data&&<div className="pci-engine-status"><p><strong>Engine status:</strong> {engine.data.summary.eligible} of {engine.data.summary.total} enabled creators are eligible for subscriber rankings. Worker: <strong>{engine.data.worker.anyAlive?'running':'NOT RUNNING'}</strong>{engine.data.worker.anyAlive&&!engine.data.worker.apiSyncEnabled?' (sync disabled by configuration)':''}. Last published: {engine.data.publishedAt?new Date(engine.data.publishedAt).toLocaleString():'never'}.</p>
 {!engine.data.worker.anyAlive&&<p className="fineprint">No worker heartbeat in the last 90 seconds. Set RUN_WORKER_IN_API=true and YOUTUBE_SYNC_ENABLED=true on the API host, or start the worker process.</p>}
 <ul className="fineprint">{Object.entries(engine.data.summary.byReason).map(([k,v])=><li key={k}>{v} × {REASON_TEXT[k]??k}</li>)}</ul></div>}
 <div className="admin-inline-actions"><button className="btn btn-secondary" disabled={busy||!selected.length} onClick={()=>bulkReview('approved')}>Approve selected humans ({selected.length})</button><button className="btn btn-secondary" disabled={busy||!selected.length} onClick={()=>bulkReview('rejected')}>Reject selected</button><button className="btn btn-secondary" disabled={busy} onClick={()=>setSelected(visible.filter(p=>p.humanReviewStatus==='pending').map(p=>p.id))}>Select all pending shown</button><button className="btn btn-secondary" disabled={busy||!selected.length} onClick={()=>setSelected([])}>Clear selection</button></div>
 <div className="field"><label htmlFor="pci-unified-search">Find person</label><input id="pci-unified-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Name or YouTube channel ID"/></div>
 <DataBlock loading={people.loading} error={people.error} empty={!visible.length}><TableWrap><thead><tr><th>Select</th><th>Creator</th><th>Human review</th><th>Shared categories</th><th>Actions</th></tr></thead>
 <tbody>{visible.map(p=><tr key={p.id}><td><input type="checkbox" aria-label={`Select ${p.displayName}`} disabled={busy} checked={selected.includes(p.id)} onChange={e=>setSelected(e.target.checked?[...new Set([...selected,p.id])]:selected.filter(id=>id!==p.id))}/></td><td><strong>{p.displayName}</strong><p className="fineprint">{p.channelId}</p>{(reasonById.get(p.id)?.reasons??[]).length>0&&<p className="fineprint">{(reasonById.get(p.id)?.reasons??[]).map(r=>REASON_TEXT[r]??r).join(' · ')}</p>}</td><td>{p.humanReviewStatus}</td><td><div className="pci-unified-checks">{(categories.data??[]).map(c=><label key={c.id} className="fineprint"><input type="checkbox" disabled={busy} checked={p.categoryIds.includes(c.id)} onChange={e=>updateCategories(p,c.id,e.target.checked)}/> {c.label}</label>)}</div></td>
 <td><div className="admin-inline-actions"><button className="btn btn-secondary" disabled={busy} onClick={()=>review(p,'approved')}>Approve human</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(p,'rejected')}>Reject</button><button className="btn btn-secondary" disabled={busy} onClick={()=>review(p,'pending')}>Reset</button></div></td></tr>)}</tbody></TableWrap></DataBlock>
 </Card></AdminPage></RoleGate>;
}
