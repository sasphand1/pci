'use client';
import {useState} from 'react';
import Link from 'next/link';
import {Notice} from '@pci/ui';
import {AdminPage} from '@/components/Shared';
import {AudienceChart} from '@/components/AudienceChart';
import {useOverview} from '@/components/OverviewProvider';
import {useAuth} from '@/components/AuthProvider';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {compact,initials,signedPct} from '@/lib/format';

export default function OverviewPage(){
 const {data,error,loading,reload}=useOverview();const {identity}=useAuth();
 const canWork=identity?.role==='owner'||identity?.role==='editor';
 const [busy,setBusy]=useState(false),[ok,setOk]=useState(''),[fail,setFail]=useState('');

 async function runNow(){
  if(!canWork||busy)return;
  if(!window.confirm('Run Refresh, Rank and Publish now? Rankings that pass the safety checks go live straight away.'))return;
  setBusy(true);setOk('');setFail('');
  try{
   const r=await api<{id:string;started:boolean}>('/admin/pipeline/run',{method:'POST',csrf:identity?.csrfToken});
   setOk(r.started?'The pipeline started. Follow it on the Pipeline page.':'A pipeline run is already in progress.');reload();
  }catch(e){setFail(errorText(e));}finally{setBusy(false);}
 }

 const action=<div className="admin-inline-actions">
  <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>{loading?'Refreshing…':'Refresh'}</button>
  {canWork&&<Link className="btn btn-secondary" href="/bucket">Add people</Link>}
  {canWork&&<button type="button" className="btn btn-primary" disabled={busy} onClick={runNow}>{busy?'Starting…':'Run pipeline now'}</button>}
 </div>;

 return <AdminPage title="Overview" description="What is in the index, how fresh it is, and what needs a person." action={action}>
  {ok&&<Notice>{ok}</Notice>}{fail&&<Notice tone="danger">{fail}</Notice>}
  {loading&&!data&&<p role="status" className="muted">Loading the overview…</p>}
  {error&&!data&&<Notice tone="danger">{error} <button type="button" className="btn btn-secondary" onClick={reload}>Try again</button></Notice>}
  {error&&data&&<Notice tone="warning">Could not refresh just now. These numbers are from the last successful load.</Notice>}
  {data&&<>
   {data.state.level==='down'&&<Notice tone="danger"><strong>{data.state.label}.</strong> {data.state.reasons.join('. ')}.</Notice>}
   <section className="glass-kpis" aria-label="Key numbers">
    <div className="glass-card kpi"><p className="kpi-label">People</p><p className="kpi-value">{fmtNum(data.people)}</p><p className="kpi-note">{data.people===0?'Add people to start':'In the bucket'}</p></div>
    <div className="glass-card kpi"><p className="kpi-label">Accounts tracked</p><p className="kpi-value">{fmtNum(data.accounts.total)}</p><p className="kpi-note">{fmtNum(data.accounts.youtube)} YouTube, {fmtNum(data.accounts.instagram)} Instagram · {fmtNum(data.accounts.withNumbers)} with numbers</p></div>
    <div className="glass-card kpi"><p className="kpi-label">Total audience</p><p className="kpi-value">{compact(data.audience.total)}</p><p className="kpi-note">{signedPct(data.audience.changePct)?`${signedPct(data.audience.changePct)} over the chart period`:'Fresh numbers only'}</p></div>
    <div className="glass-card kpi"><p className="kpi-label">Last publish</p><p className="kpi-value kpi-small">{data.lastPublishedAt?fmtDate(data.lastPublishedAt):'Nothing yet'}</p><p className="kpi-note">{data.worker.dailyEnabled?`Next automatic run ${data.worker.schedule}`:'Daily run is switched off'}</p></div>
   </section>

   <div className="glass-split">
    <section className="glass-card" aria-labelledby="ov-chart"><h2 id="ov-chart" className="glass-h">Audience over the last 30 days</h2>
     <div className="chart-legend"><span className="legend-yt">YouTube</span><span className="legend-ig">Instagram</span></div>
     <AudienceChart series={data.series}/>
     <p className="fineprint">Each day adds up the accounts measured that day, so a jump can mean new accounts joined the bucket.</p>
    </section>
    <section className="glass-card" aria-labelledby="ov-pipe"><h2 id="ov-pipe" className="glass-h">Pipeline</h2>
     <ul className="glass-list">
      <li><span>Background worker</span><span className={`state-pill state-${data.worker.healthy===true?'ok':data.worker.dailyEnabled?'down':'idle'}`}>{data.worker.healthy===true?'Running':data.worker.healthy===false?'Not responding':'Not seen'}</span></li>
      <li><span>Daily run</span><span>{data.worker.dailyEnabled?data.worker.schedule:'Off'}</span></li>
      <li><span>Last run</span><span>{data.pipeline?`${data.pipeline.status} · ${fmtDate(data.pipeline.createdAt)}`:'Never run'}</span></li>
      <li><span>Open alerts</span><span>{fmtNum(data.openAlerts)}</span></li>
     </ul>
     {canWork&&<Link className="btn btn-secondary" href="/pipeline">Open pipeline</Link>}
    </section>
   </div>

   <div className="glass-split glass-split-even">
    <section className="glass-card" aria-labelledby="ov-attn"><h2 id="ov-attn" className="glass-h">Needs attention</h2>
     {data.attention.length===0?<p className="muted">Nothing needs attention right now.</p>:<ul className="glass-list">{data.attention.map(a=><li key={a.key}>
      <span><span className={`count-pill count-${a.severity}`}>{fmtNum(a.count)}</span> {a.message}</span>
      {identity?.role!=='moderator'&&<Link className="glass-link" href={a.href}>Review</Link>}</li>)}</ul>}
    </section>
    <section className="glass-card" aria-labelledby="ov-top"><h2 id="ov-top" className="glass-h">Top of the wheel</h2>
     {data.top.length===0?<p className="muted">Appears after the first publish.</p>:<ol className="glass-list glass-top">{data.top.map(t=><li key={t.slot}>
      <span className="top-who"><span className="top-avatar" aria-hidden="true">{initials(t.displayName)}</span><span><strong>{t.displayName}</strong><span className="fineprint">Position {t.rank}</span></span></span>
      <span className="top-value">{compact(Number(t.value))}</span></li>)}</ol>}
    </section>
   </div>
  </>}
 </AdminPage>;
}
