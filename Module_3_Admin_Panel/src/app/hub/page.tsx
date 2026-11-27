'use client';
import {useState} from 'react';
import {AdminPage,DataBlock,RoleGate,Status,TableWrap,useData} from '@/components/Shared';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
type Source={id:string;platform:string;method:'api'|'http'|'manual';enabled:boolean;category?:string;label?:string|null;expectedHours?:number;lastSuccessAt:string|null;lastAttemptAt:string|null;lastError:string|null;status:'ok'|'degraded'|'down'|'disabled';consecutiveFailures:number;checkedAt:string|null};
type Alert={id:string;createdAt:string;kind:string;scope:string|null;severity:'info'|'warning'|'critical';sourceId:string|null;message:string};
type Job={id:string;sourceId:string;trigger:string;status:string;startedAt:string|null;finishedAt:string|null;errorCode:string|null};
type Stored={category:string;entities:number;fields:number;latestAt:string|null};
type CreatorsBucketStatus={name:string;platform:string;source:string;registered:number;withFollowers:number;withViews:number;withVideoCount:number;withUploads:number;withContent:number;trackedVideos:number;latestAt:string|null};
type ScrappaKeyUsage={id:string;label:string;active:boolean;cap:number;used:number;legacyUsed:number;remaining:number;lastRequestAt:string|null};
type ScrappaRun={id:string;trigger:string;status:string;started_at:string|null;finished_at:string|null;error_code:string|null;handle:string|null;credits:number};
type ScrappaCreator={handle:string;last_attempt_at:string|null;last_success_at:string|null;last_error:string|null;next_due_at:string|null};
type ScrappaLedger={id:string;label:string;endpoint:string;handle:string;outcome:string;http_status:number|null;transport_failure:boolean;reserved_at:string;finished_at:string|null};
type ScrappaStatus={staged:number;linked:number;collected:number;fresh:number;full_samples:number;latest_at:string|null;enabled:boolean;autoConfigured:boolean;used:number;limit:number;scheduledLimit:number;keys?:ScrappaKeyUsage[];runs?:ScrappaRun[];creators?:ScrappaCreator[];ledger?:ScrappaLedger[]};
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
  <p><span className={badge(s.status)}>{s.status}</span> · {s.id==='scrappa.api'?'Third-party API':s.method==='api'?'Official API':s.method==='manual'?'Admin entry':'Public web page'}{s.category?` · ${s.category}`:''}</p>
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
 const creatorBucket=useData<CreatorsBucketStatus>('/admin/ingest/creators-bucket');
 const scrappa=useData<ScrappaStatus>('/admin/bucket/scrappa/status');
 const disc=useData<Discrepancy[]>('/admin/ingest/discrepancies');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState(''),[showDisc,setShowDisc]=useState(10);
 const reloadAll=()=>{health.reload();coverage.reload();disc.reload();creatorBucket.reload();scrappa.reload();};
 async function switchScrappa(enabled:boolean){
  if(enabled&&!window.confirm('Enable scheduled third-party TikTok data collection only after confirming source permissions and credit allowance?'))return;
  setBusy(true);setError('');setOk('');try{await api('/admin/bucket/scrappa/refresh-settings',{method:'POST',csrf,body:{enabled}});reloadAll();}catch(e){setError(errorText(e));}finally{setBusy(false);}
 }
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
   <h2>Creators Bucket</h2>
   <DataBlock loading={creatorBucket.loading} error={creatorBucket.error} empty={!creatorBucket.data}>
    <p className="fineprint">YouTube creator intelligence · read-only derived sub-bucket of the Data Hub. Counts below are coverage, not sums of followers.</p>
    {creatorBucket.data&&<TableWrap><thead><tr><th>Registered channels</th><th>Subscribers</th><th>Views</th><th>Public video count</th><th>30-day uploads</th><th>Video coverage</th><th>Tracked videos</th><th>Latest video reading</th></tr></thead><tbody><tr>{[creatorBucket.data.registered,creatorBucket.data.withFollowers,creatorBucket.data.withViews,creatorBucket.data.withVideoCount,creatorBucket.data.withUploads,creatorBucket.data.withContent,creatorBucket.data.trackedVideos].map((n,i)=><td key={i}>{fmtNum(n)}</td>)}<td>{fmtDate(creatorBucket.data.latestAt)}</td></tr></tbody></TableWrap>}
   </DataBlock>
   <h2>TikTok Creators Bucket (private staging)</h2>
   <DataBlock loading={scrappa.loading} error={scrappa.error} empty={!scrappa.data}>
    {scrappa.data&&<><p className="fineprint">Third-party Scrappa source; independent TikTok publication remains owner-controlled. Fresh means a collected snapshot within 15 days.</p>
     <TableWrap><thead><tr><th>Staged</th><th>Linked people</th><th>Collected</th><th>Fresh</th><th>10-video samples</th><th>Latest snapshot</th></tr></thead><tbody><tr>{[scrappa.data.staged,scrappa.data.linked,scrappa.data.collected,scrappa.data.fresh,scrappa.data.full_samples].map((n,i)=><td key={i}>{fmtNum(n)}</td>)}<td>{fmtDate(scrappa.data.latest_at)}</td></tr></tbody></TableWrap>
     <p className="fineprint">Active credential, UTC month: {scrappa.data.used}/{scrappa.data.limit} credits reserved. Automatic refresh stops at {scrappa.data.scheduledLimit}. Worker opt-in: {scrappa.data.autoConfigured?'configured':'off'}.</p>
     {owner&&<><h3>Credential balances</h3><TableWrap><thead><tr><th>Key title</th><th>Status</th><th>Used / cap</th><th>Remaining</th><th>Legacy allocation</th><th>Last request</th></tr></thead><tbody>{(scrappa.data.keys??[]).map(k=><tr key={k.id}><td>{k.label}</td><td>{k.active?'Active':'Inactive'}</td><td>{k.used} / {k.cap}</td><td>{k.remaining}</td><td>{k.legacyUsed}</td><td>{fmtDate(k.lastRequestAt)}</td></tr>)}</tbody></TableWrap>
     <details><summary>Recent request ledger (latest 100)</summary><TableWrap><thead><tr><th>Credential</th><th>Handle</th><th>Endpoint</th><th>Outcome</th><th>HTTP</th><th>Reserved</th><th>Finished</th></tr></thead><tbody>{(scrappa.data.ledger??[]).map(l=><tr key={l.id}><td>{l.label}</td><td>@{l.handle}</td><td>{l.endpoint}</td><td>{l.outcome}{l.transport_failure?' / transport failure':''}</td><td>{l.http_status??'—'}</td><td>{fmtDate(l.reserved_at)}</td><td>{fmtDate(l.finished_at)}</td></tr>)}</tbody></TableWrap></details></>}
     <details><summary>Recent collection runs (latest 30)</summary><TableWrap><thead><tr><th>Creator</th><th>Trigger</th><th>Status</th><th>Credits</th><th>Started</th><th>Finished</th><th>Stop reason</th></tr></thead><tbody>{(scrappa.data.runs??[]).map(r=><tr key={r.id}><td>{r.handle?`@${r.handle}`:'—'}</td><td>{r.trigger}</td><td>{r.status}</td><td>{r.credits}</td><td>{fmtDate(r.started_at)}</td><td>{fmtDate(r.finished_at)}</td><td>{r.error_code??'—'}</td></tr>)}</tbody></TableWrap></details>
     <details><summary>Creator refresh state (latest 200)</summary><TableWrap><thead><tr><th>Creator</th><th>Last attempt</th><th>Last success</th><th>Earliest next due</th><th>Last error</th></tr></thead><tbody>{(scrappa.data.creators??[]).map(r=><tr key={r.handle}><td>@{r.handle}</td><td>{fmtDate(r.last_attempt_at)}</td><td>{fmtDate(r.last_success_at)}</td><td>{fmtDate(r.next_due_at)}</td><td>{r.last_error??'—'}</td></tr>)}</tbody></TableWrap></details>
     {owner&&<button className="btn btn-secondary" disabled={busy||(!scrappa.data.enabled&&!scrappa.data.autoConfigured)} onClick={()=>void switchScrappa(!scrappa.data!.enabled)}>{scrappa.data.enabled?'Disable scheduled TikTok refresh':'Enable scheduled TikTok refresh'}</button>}
    </>}
   </DataBlock>
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
