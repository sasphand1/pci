'use client';
import {useEffect,useState} from 'react';
import {Card,Badge,Notice,MetricCard} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {LivePublication,ShadowCompare,ShadowResult,PipelineStatus,PublishOutcome,RankBatch,RefreshResultRow,RefreshRun,ScopeDraft,StartedRun} from '@/lib/types';

const SCOPE_LABEL:Record<string,string>={
 'wheel.subscribed':'Wheel: Combined followers across platforms','wheel.viewed':'Wheel: YouTube lifetime views','wheel.active':'Wheel: Posts in the last 30 days',
 'youtube.subscribed':'YouTube row','instagram.followers':'Instagram row'
};
const label=(scope:string)=>SCOPE_LABEL[scope]??(scope.startsWith('category.')?`Category row: ${scope.slice(9)}`:scope);
const tone=(status:string):'normal'|'muted'|'danger'=>['succeeded','published','ok'].includes(status)?'normal':['failed','rejected'].includes(status)?'danger':'muted';

export default function PipelinePage(){
 const {identity}=useAuth();
 const status=useData<PipelineStatus>('/admin/pipeline/status');
 const batch=useData<RankBatch|null>('/admin/rank/latest');
 const [runId,setRunId]=useState('');
 const results=useData<RefreshRun&{results:RefreshResultRow[]}>(`/admin/refresh/${runId||'none'}`,!!runId);
 const [scopeView,setScopeView]=useState('');
 const [showShadow,setShowShadow]=useState(false);
 const shadow=useData<ShadowResult>('/admin/shadow/youtube',showShadow);
 const live=useData<LivePublication>(`/admin/publications/${scopeView||'wheel.subscribed'}?limit=100`,!!scopeView);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[ok,setOk]=useState('');
 const csrf=identity?.csrfToken;
 const running=(status.data?.refresh??[]).some(r=>r.status==='queued'||r.status==='running')||(status.data?.pipeline??[]).some(p=>p.status==='running');

 // While something is running, look again every few seconds. No browser storage involved.
 useEffect(()=>{if(!running)return;const t=setInterval(()=>{status.reload(true);},4000);return()=>clearInterval(t);},[running]);

 async function act<T>(name:string,f:()=>Promise<T>,done:(r:T)=>string){
  setBusy(name);setError('');setOk('');
  try{const r=await f();setOk(done(r));}catch(e){setError(errorText(e));}finally{setBusy('');status.reload();batch.reload();}
 }
 const refresh=()=>act('refresh',()=>api<{runs:StartedRun[]}>('/admin/refresh',{method:'POST',body:{},csrf}),r=>r.runs.map(x=>`${x.platform}: ${x.started?'started':'already running'}`).join('; ')+'. Results appear below as accounts finish.');
 const rank=()=>act('rank',()=>api<{scopes:number;gateFailures:number}>('/admin/rank',{method:'POST',csrf}),r=>`${r.scopes} drafts built${r.gateFailures?`, ${r.gateFailures} would be blocked by a gate`:''}. Nothing is public yet. Review them, then Publish.`);
 const publish=()=>{
  const b=batch.data;if(!b)return;
  const n=b.scopes.filter(s=>s.status==='draft').length;
  if(!window.confirm(`Publish ${n} ranking${n===1?'':'s'}? Any draft that fails a safety gate is skipped and its current live ranking stays.`))return;
  return act('publish',()=>api<PublishOutcome>(`/admin/rank/${b.batchId}/publish`,{method:'POST',csrf}),r=>`${r.published.length} published${r.rejected.length?`, ${r.rejected.length} blocked by a gate (live ranking kept, see alerts)`:''}.`);
 };
 const runAll=()=>{
  if(!window.confirm('Run Refresh, Rank and Publish now? This uses API quota and publishes whatever passes the safety gates.'))return;
  return act('all',()=>api<{id:string;started:boolean}>('/admin/pipeline/run',{method:'POST',csrf}),r=>r.started?'Pipeline started. Progress shows below.':'A pipeline is already running.');
 };
 const rollback=(scope:string)=>{
  if(!window.confirm(`Restore the previous published ranking for "${label(scope)}"?`))return;
  return act('rollback',()=>api(`/admin/publications/${scope}/rollback`,{method:'POST',csrf}),()=>`${label(scope)} restored to the previous ranking.`);
 };
 const ack=(id:number)=>act('ack',()=>api(`/admin/pipeline/alerts/${id}/ack`,{method:'POST',csrf}),()=>'Alert acknowledged.');

 const s=status.data;
 const drafts:ScopeDraft[]=batch.data?.scopes??[];
 const pending=drafts.filter(d=>d.status==='draft').length;

 return <RoleGate roles={['owner','editor']}><AdminPage title="Pipeline" description="Refresh the numbers, Rank the bucket, Publish what passes the safety checks. The same three steps run by themselves every day at 09:00 Asia/Karachi.">
  <Status error={error||status.error} ok={ok}/>
  {(s?.alerts??[]).length>0&&<Card><h2 className="admin-box-title">Alerts</h2>{s!.alerts.map(a=><div key={a.id} className="admin-inline-actions"><Notice tone="warning">{fmtDate(a.createdAt)}: {a.message}</Notice><button type="button" className="btn btn-secondary" disabled={!!busy} onClick={()=>ack(a.id)}>Acknowledge</button></div>)}</Card>}
  <div className="admin-panel-grid">
   <MetricCard label="People in the bucket" value={fmtNum(s?.bucket.people)} note={`${fmtNum(s?.bucket.youtube)} YouTube, ${fmtNum(s?.bucket.instagram)} Instagram accounts`}/>
   <MetricCard label="Background worker" value={s?.worker?(s.worker.healthy?'Running':'Not responding'):'Not seen'} note={s?.worker?`Last seen ${fmtDate(s.worker.lastSeenAt)}`:'The daily run needs the worker (or RUN_WORKER_IN_API=true)'}/>
   <MetricCard label="Daily automatic run" value={s?.dailyRun.enabled?'On':'Off'} note={s?.dailyRun.schedule}/>
   <MetricCard label="Last pipeline" value={s?.pipeline[0]?.status??'—'} note={s?.pipeline[0]?fmtDate(s.pipeline[0].createdAt):'Never run'}/>
  </div>

  <Card><h2 className="admin-box-title">Run</h2>
   <div className="admin-inline-actions">
    <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={refresh}>{busy==='refresh'?'Starting…':'1. Refresh numbers'}</button>
    <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={rank}>{busy==='rank'?'Ranking…':'2. Rank (make drafts)'}</button>
    <button type="button" className="btn btn-primary" disabled={!!busy||!pending} onClick={publish}>{busy==='publish'?'Publishing…':`3. Publish${pending?` (${pending})`:''}`}</button>
    <button type="button" className="btn btn-secondary" disabled={!!busy||running} onClick={runAll}>{busy==='all'?'Starting…':'Run all three'}</button>
   </div>
   <p className="fineprint">Refresh fetches new numbers from YouTube and Instagram. Rank builds drafts and changes nothing public. Publish makes passing drafts live in one step. A ranking that fails a safety check never replaces the live one.</p>
   {(s?.pipeline??[]).slice(0,1).map(p=><div key={p.id}><p>Latest run ({p.trigger}): <Badge variant={tone(p.status)}>{p.status}</Badge> {fmtDate(p.createdAt)}</p>
    <ul>{p.steps.map(st=><li key={st.step}>{st.step}: <Badge variant={tone(st.status)}>{st.status}</Badge> {st.detail}</li>)}</ul></div>)}
  </Card>

  <Card><h2 className="admin-box-title">Refresh results</h2>
   <DataBlock loading={status.loading} error="" empty={!(s?.refresh??[]).length}>
    <TableWrap><thead><tr><th>Platform</th><th>Status</th><th>Started</th><th>Finished</th><th>Accounts</th><th>Outcomes</th><th>Detail</th></tr></thead><tbody>{(s?.refresh??[]).map(r=><tr key={r.id}>
     <td>{r.platform}</td><td><Badge variant={tone(r.status)}>{r.status}</Badge></td><td>{fmtDate(r.createdAt)}</td><td>{fmtDate(r.finishedAt)}</td><td>{r.counts?.accounts??'—'}</td>
     <td>{Object.entries(r.counts??{}).filter(([k])=>k!=='accounts').map(([k,v])=>`${k}: ${v}`).join(', ')||'—'}</td>
     <td><button type="button" className="btn btn-secondary" onClick={()=>setRunId(r.id)}>Accounts</button></td></tr>)}</tbody></TableWrap>
   </DataBlock>
   {runId&&<><h3>Per-account results ({results.data?.platform})</h3><DataBlock loading={results.loading} error={results.error} empty={!(results.data?.results??[]).length}>
    <TableWrap><thead><tr><th>Account</th><th>Outcome</th><th>Tries</th><th>Detail</th></tr></thead><tbody>{(results.data?.results??[]).map(r=><tr key={r.accountId}><td>{r.handle}</td><td><Badge variant={tone(r.outcome)}>{r.outcome}</Badge></td><td>{r.attempts}</td><td>{r.detail??'—'}</td></tr>)}</tbody></TableWrap></DataBlock></>}
  </Card>

  <Card><h2 className="admin-box-title">Drafts from the last Rank</h2>
   <DataBlock loading={batch.loading} error={batch.error} empty={!drafts.length}>
    <TableWrap><thead><tr><th>Ranking</th><th>Status</th><th>People ranked</th><th>Entered</th><th>Left</th><th>Moved</th><th>Top 3</th><th>Checks</th></tr></thead><tbody>{drafts.map(d=><tr key={d.runId}>
     <td>{label(d.scope)}</td><td><Badge variant={tone(d.status)}>{d.status}</Badge></td><td>{d.covered} of {d.population}{d.unranked?` (${d.unranked} without fresh data)`:''}</td>
     <td>{d.diff.counts.entered}</td><td>{d.diff.counts.left}</td><td>{d.diff.counts.moved}</td>
     <td>{d.top.slice(0,3).map(t=>`${t.slot}. ${t.displayName}`).join(', ')||'—'}</td>
     <td>{d.gateFailures.length?d.gateFailures.map(g=><div key={g.gate}><Badge variant="danger">{g.gate}</Badge> {g.message}</div>):<Badge>passed</Badge>}</td></tr>)}</tbody></TableWrap>
    {drafts.filter(d=>d.diff.moved.length||d.diff.entered.length||d.diff.left.length).slice(0,6).map(d=><div key={d.runId}><h3>{label(d.scope)}: what changes</h3><ul>
     {d.diff.entered.slice(0,5).map(x=><li key={`e${x.personId}`}>{x.displayName} enters at {x.to}</li>)}
     {d.diff.left.slice(0,5).map(x=><li key={`l${x.personId}`}>{x.displayName} leaves (was {x.from})</li>)}
     {d.diff.moved.slice(0,5).map(x=><li key={`m${x.personId}`}>{x.displayName}: {x.from} to {x.to}</li>)}</ul></div>)}
   </DataBlock>
  </Card>

  <Card><h2 className="admin-box-title">Compare with the old site (YouTube)</h2>
   <p className="fineprint">Before switching over, check that the new YouTube ranking agrees with the old one. Differences are expected when the bucket holds different people than the old list.</p>
   <button type="button" className="btn btn-secondary" onClick={()=>setShowShadow(true)} disabled={showShadow&&shadow.loading}>{showShadow?'Refresh comparison':'Compare now'}</button>
   <DataBlock loading={showShadow&&shadow.loading} error={shadow.error} empty={!showShadow||!shadow.data}>
    {shadow.data&&shadow.data.available===false&&<Notice>{shadow.data.reason}</Notice>}
    {shadow.data&&shadow.data.available&&<>{[['Top 15',shadow.data.top15],['Top 100',shadow.data.top100]].map(([name,c])=>{const x=c as ShadowCompare;return <div key={name as string}><h3>{name as string}: {x.overlapPct}% the same people{x.sameOrder?', same order':''}</h3>
     <p>{x.overlap} people appear in both lists. {x.moved.length} are in a different position.</p>
     {x.onlyLegacy.length>0&&<p>Only in the old list: {x.onlyLegacy.map(r=>r.name).join(', ')}</p>}
     {x.onlyNew.length>0&&<p>Only in the new list: {x.onlyNew.map(r=>r.name).join(', ')}</p>}
     {x.moved.length>0&&<ul>{x.moved.slice(0,10).map(m=><li key={m.key}>{m.name}: old {m.legacy}, new {m.published}</li>)}</ul>}</div>;})}<p className="fineprint">{shadow.data.note}</p></>}
   </DataBlock>
  </Card>

  <Card><h2 className="admin-box-title">Live rankings</h2>
   <DataBlock loading={status.loading} error="" empty={!(s?.live??[]).length}>
    <TableWrap><thead><tr><th>Ranking</th><th>Published</th><th>Age</th><th>People ranked</th><th>Actions</th></tr></thead><tbody>{(s?.live??[]).map(l=><tr key={l.scope}>
     <td>{label(l.scope)}</td><td>{fmtDate(l.publishedAt)}</td><td>{l.ageHours==null?'—':`${l.ageHours} h`} {l.stale&&<Badge variant="danger">stale (over 36 h)</Badge>}</td><td>{l.covered}{l.population!=null?` of ${l.population}`:''}</td>
     <td><div className="admin-inline-actions"><button type="button" className="btn btn-secondary" onClick={()=>setScopeView(l.scope)}>View</button><button type="button" className="btn btn-secondary" disabled={!!busy} onClick={()=>rollback(l.scope)}>Restore previous</button></div></td></tr>)}</tbody></TableWrap>
   </DataBlock>
   {scopeView&&<><h3>{label(scopeView)}</h3><DataBlock loading={live.loading} error={live.error} empty={!(live.data?.entries??[]).length}>
    <TableWrap><thead><tr><th>Slot</th><th>Rank</th><th>Person</th><th>Value</th><th>Accounts counted</th></tr></thead><tbody>{(live.data?.entries??[]).map(e=><tr key={e.personId}><td>{e.slot}</td><td>{e.rank}</td><td>{e.displayName}</td><td>{fmtNum(e.value)}</td><td>{e.counted} of {e.linked}</td></tr>)}</tbody></TableWrap>
    {(live.data?.unranked??[]).length>0&&<><h3>Not ranked</h3><ul>{live.data!.unranked.map(u=><li key={u.personId}>{u.displayName}: {u.reason==='no_valid_value'?'no fresh number (older than 7 days or not returned)':'no account on a platform that supplies this number'}</li>)}</ul></>}
   </DataBlock></>}
  </Card>
 </AdminPage></RoleGate>;
}
