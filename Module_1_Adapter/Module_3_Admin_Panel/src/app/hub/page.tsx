'use client';
import {useState} from 'react';
import {AdminPage,DataBlock,RoleGate,Status,TableWrap,useData} from '@/components/Shared';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
type Source={id:string;platform:string;method:'api'|'http'|'manual';enabled:boolean;category?:string;label?:string|null;expectedHours?:number;lastSuccessAt:string|null;lastAttemptAt:string|null;lastError:string|null;status:'ok'|'degraded'|'down'|'disabled';consecutiveFailures:number;checkedAt:string|null};
type Alert={id:string;createdAt:string;kind:string;scope:string|null;severity:'info'|'warning'|'critical';sourceId:string|null;message:string};
type Job={id:string;sourceId:string;trigger:string;status:string;startedAt:string|null;finishedAt:string|null;errorCode:string|null};
type Stored={category:string;entities:number;fields:number;latestAt:string|null};
type Health={sources:Source[];openAlerts:Alert[];recentJobs:Job[];discrepancies7d:number;categories?:Stored[]};
type Coverage={byTier:{platform:string;tier:string;n:number}[];byCategory:{platform:string;category:string;n:number;noData:number}[];freshness:{platform:string;registered:number;fresh:number;withPicture:number;noData:number}[]};
type Discrepancy={entityId:string;metric:string;apiValue:string;httpValue:string;detectedAt:string};
const TIERS:[string,string][]=[['1m_plus','1M+'],['500k_1m','500K–1M'],['100k_500k','100K–500K'],['under_100k','Under 100K'],['no_data','No data']];
const badge=(s:string)=>s==='ok'?'badge':s==='down'||s==='critical'?'badge badge-danger':'badge badge-muted';
const HTTP_IDS=['youtube.http','instagram.http','tiktok.http'];

function SourceCard({s,owner,csrf,reload}:{s:Source;owner:boolean;csrf?:string;reload:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const switchable=HTTP_IDS.includes(s.id);
 async function toggle(next:boolean){
  if(next&&!window.confirm('Enable this web (non-API) source? It reads public pages and may be restricted by the platform terms. It stays under monitoring and can be switched off here at any time.'))return;
  setBusy(true);setError('');
  try{await api(`/admin/ingest/sources/${s.id}`,{method:'PATCH',csrf,body:{enabled:next}});reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 return <article className="admin-setting-card"><h3>{s.label||s.id}</h3>
  <p><span className={badge(s.status)}>{s.status}</span> · {s.method==='api'?'Official API':s.method==='manual'?'Admin entry':'Public web page'}{s.category?` · ${s.category}`:''}</p>
  {s.expectedHours&&<p className="fineprint">{s.id} · expected every {s.expectedHours<48?`${s.expectedHours} hours`:`${Math.round(s.expectedHours/24)} days`}</p>}
  <p className="fineprint">Last success: {fmtDate(s.lastSuccessAt)} · Last attempt: {fmtDate(s.lastAttemptAt)}</p>
  {s.consecutiveFailures>0&&<p className="fineprint">Consecutive failures: {s.consecutiveFailures}</p>}
  {s.lastError&&<p role="alert">Last error: {s.lastError}</p>}
  {switchable&&owner&&<label className="admin-check"><input type="checkbox" checked={s.enabled} disabled={busy} onChange={e=>void toggle(e.target.checked)}/> Enabled (kill switch)</label>}
  {switchable&&!owner&&<p className="fineprint">Only the Owner can switch this source.</p>}
  <Status error={error}/></article>;
}

export default function DataHub(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;const owner=identity?.role==='owner';
 const health=useData<Health>('/admin/ingest/health');
 const coverage=useData<Coverage>('/admin/ingest/coverage');
 const disc=useData<Discrepancy[]>('/admin/ingest/discrepancies');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState(''),[showDisc,setShowDisc]=useState(10);
 const reloadAll=()=>{health.reload();coverage.reload();disc.reload();};
 async function run(){setBusy(true);setError('');setOk('');try{const r=await api<{sources:number;alertsOpened:number}>('/admin/ingest/check',{method:'POST',csrf});setOk(`Checked ${r.sources} sources; ${r.alertsOpened} new alert(s).`);reloadAll();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function fillGraphPictures(){
  setBusy(true);setError('');setOk('');
  try{
   const r=await api<{status:string;reason?:string;nextEligibleAt?:string;tried:number;filled:number;missing:number;rejected:number;unsupported:number;failed:number;stoppedEarly:boolean}>(
    '/admin/ingest/instagram/avatars/graph/fill',{method:'POST',csrf,body:{limit:5},timeoutMs:60000});
   if(r.status==='skipped')setOk(`Meta picture recovery skipped: ${(r.reason??'').replace(/_/g,' ')}.${r.nextEligibleAt?` Next eligible: ${fmtDate(r.nextEligibleAt)}.`:''}`);
   else setOk(`Meta pictures: tried ${r.tried}, saved ${r.filled}, not provided ${r.missing}, rejected ${r.rejected}, unsupported ${r.unsupported}, failed ${r.failed}${r.stoppedEarly?` (stopped: ${(r.reason??'safety').replace(/_/g,' ')})`:''}.`);
   reloadAll();
  }catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
 async function fillPictures(){setBusy(true);setError('');setOk('');try{const r=await api<{status:string;reason?:string;tried:number;filled:number;failed:number;stoppedEarly:boolean}>('/admin/ingest/instagram/avatars/fill',{method:'POST',csrf,body:{limit:5},timeoutMs:60000});setOk(r.status==='skipped'?`Picture fill skipped: ${(r.reason??'').replace(/_/g,' ')}.`:`Picture fill: tried ${r.tried}, filled ${r.filled}, failed ${r.failed}${r.stoppedEarly?' (stopped early after repeated failures)':''}.`);reloadAll();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function ack(id:string){setError('');try{await api(`/admin/pipeline/alerts/${id}/ack`,{method:'POST',csrf});health.reload();}catch(e){setError(errorText(e));}}
 const h=health.data;const c=coverage.data;
 const tierMap=new Map((c?.byTier??[]).map(t=>[`${t.platform}:${t.tier}`,t.n]));
 const platforms=[...new Set((c?.freshness??[]).map(f=>f.platform))];
 return <RoleGate roles={['owner','editor']}><AdminPage title="Data Hub" description="One place for source health, alerts, data coverage and freshness. Official API sources come first; web sources fill in only when allowed and healthy."
  action={<><button className="btn btn-secondary" onClick={reloadAll}>Reload</button><button className="btn btn-secondary" disabled={busy} onClick={()=>void fillGraphPictures()}>Recover Instagram pictures (Meta API)</button><button className="btn btn-secondary" disabled={busy} onClick={()=>void fillPictures()}>Fill missing Instagram pictures (web)</button><button className="btn btn-primary" disabled={busy} onClick={()=>void run()}>{busy?'Working…':'Run check now'}</button></>}>
  <Status error={error} ok={ok}/>
  <DataBlock loading={health.loading} error={health.error} empty={!h}>
   <h2>Sources</h2>
   <div className="admin-setting-grid">{h?.sources.map(s=><SourceCard key={`${s.id}-${s.enabled}`} s={s} owner={Boolean(owner)} csrf={csrf} reload={health.reload}/>)}</div>
   <h2>Stored in the hub</h2>
   {(h?.categories?.length??0)===0?<p className="muted">Nothing stored yet.</p>:
    <TableWrap><thead><tr><th>Category</th><th>Items</th><th>Latest values</th><th>Newest reading</th></tr></thead><tbody>
     {h?.categories?.map(x=><tr key={x.category}><td>{x.category}</td><td>{fmtNum(x.entities)}</td><td>{fmtNum(x.fields)}</td><td>{fmtDate(x.latestAt)}</td></tr>)}
    </tbody></TableWrap>}
   <h2>Open alerts {h&&h.openAlerts.length>0&&<span className="badge badge-danger">{h.openAlerts.length}</span>}</h2>
   {h&&h.openAlerts.length===0?<p className="muted">No open hub alerts. Alerts clear themselves when the problem goes away.</p>:
    <TableWrap><thead><tr><th>Severity</th><th>Kind</th><th>Message</th><th>Opened</th><th></th></tr></thead><tbody>
     {h?.openAlerts.map(a=><tr key={a.id}><td><span className={badge(a.severity)}>{a.severity}</span></td><td>{a.kind.replace('hub_','')}</td><td>{a.message}</td><td>{fmtDate(a.createdAt)}</td>
      <td><button className="btn btn-secondary" onClick={()=>void ack(a.id)}>Acknowledge</button></td></tr>)}
    </tbody></TableWrap>}
  </DataBlock>
  <p className="fineprint">Meta API recovery targets missing pictures without refreshing YouTube. It respects a shared 60-minute gap after Meta requests and a 6-hour pause after rate limits. Some profiles do not expose pictures through Business Discovery; those are recorded as missing, not falsely reported as filled.</p>
  <h2>Coverage</h2>
  <DataBlock loading={coverage.loading} error={coverage.error} empty={!c||c.freshness.length===0}>
   <TableWrap><thead><tr><th>Platform</th><th>Registered</th><th>Fresh (48h)</th><th>With picture</th><th>No data</th>{TIERS.map(t=><th key={t[0]}>{t[1]}</th>)}</tr></thead><tbody>
    {c?.freshness.map(f=><tr key={f.platform}><td>{f.platform}</td><td>{fmtNum(f.registered)}</td><td>{fmtNum(f.fresh)}</td><td>{fmtNum(f.withPicture)}</td><td>{fmtNum(f.noData)}</td>
     {TIERS.map(t=><td key={t[0]}>{fmtNum(tierMap.get(`${f.platform}:${t[0]}`)??0)}</td>)}</tr>)}
   </tbody></TableWrap>
   {platforms.map(p=><details key={p}><summary>{p}: accounts by primary category</summary>
    <TableWrap><thead><tr><th>Category</th><th>Accounts</th><th>No data</th></tr></thead><tbody>
     {c?.byCategory.filter(x=>x.platform===p).map(x=><tr key={x.category}><td>{x.category}</td><td>{fmtNum(x.n)}</td><td>{fmtNum(x.noData)}</td></tr>)}
    </tbody></TableWrap></details>)}
  </DataBlock>
  <h2>Source disagreements (last 7 days: {h?.discrepancies7d??0})</h2>
  <DataBlock loading={disc.loading} error={disc.error} empty={!disc.data||disc.data.length===0}>
   <TableWrap><thead><tr><th>Entity</th><th>Metric</th><th>API</th><th>Web</th><th>Seen</th></tr></thead><tbody>
    {disc.data?.slice(0,showDisc).map((d,i)=><tr key={`${d.entityId}-${d.metric}-${i}`}><td>{d.entityId}</td><td>{d.metric}</td><td>{fmtNum(d.apiValue)}</td><td>{fmtNum(d.httpValue)}</td><td>{fmtDate(d.detectedAt)}</td></tr>)}
   </tbody></TableWrap>
   {disc.data&&disc.data.length>showDisc&&<button className="btn btn-secondary" onClick={()=>setShowDisc(v=>v+10)}>Show 10 more</button>}
  </DataBlock>
  <h2>Recent monitor and collection jobs</h2>
  <DataBlock loading={health.loading} error="" empty={!h||h.recentJobs.length===0}>
   <TableWrap><thead><tr><th>Source</th><th>Trigger</th><th>Status</th><th>Started</th><th>Finished</th><th>Error</th></tr></thead><tbody>
    {h?.recentJobs.map(j=><tr key={j.id}><td>{j.sourceId}</td><td>{j.trigger}</td><td>{j.status}</td><td>{fmtDate(j.startedAt)}</td><td>{fmtDate(j.finishedAt)}</td><td>{j.errorCode??'—'}</td></tr>)}
   </tbody></TableWrap>
  </DataBlock>
  <div className="admin-callout">Alerts you can see here: no new data, stale data, endpoint or page format changed, platform blocking requests, API quota nearly used, low coverage. Critical alerts are also emailed when HUB_ALERT_EMAIL is set in Module 1. Web sources are off by default; only the Owner can enable them.</div>
 </AdminPage></RoleGate>;
}
