'use client';
import {useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';

type Source={id:string;label:string;kind:string;min_minutes:number;enabled:boolean;last_attempt_at:string|null;last_success_at:string|null;last_error:string|null;fail_count:number};
type Overview={subscribers:{total:number;active:number};packs:{slug:string;name:string;status:string;subscribers:number}[];deliveries24h:Record<string,number>;
 sources:Source[];notes:{pack_slug:string;scope:string;note:string;created_at:string}[];newSchools:number;interest:{pack_slug:string;n:number}[];
 signals:{signal_id:string;scopes:number;newest:string}[];jobs:{connector:string;run_key:string;status:string;error:string|null;attempts:number;updated_at:string}[];copernicus:{ads:boolean;ewds:boolean};whatsapp:{configured:boolean;webhookReady:boolean;templateReady:boolean;mode:'live'|'dry_run';number:string|null;template:string;graphVersion:string}};

const fresh=(at:string|null,hours:number)=>Boolean(at)&&Date.now()-new Date(at!).getTime()<hours*3600000;

export default function SatifyOverview(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;
 const o=useData<Overview>('/admin/satify/overview');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function refresh(){setBusy(true);setError('');setOk('');try{await api('/admin/satify/sources/refresh',{method:'POST',csrf,timeoutMs:90000});setOk('Sources refreshed and signals recalculated.');o.reload();}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 async function template(){setBusy(true);setError('');setOk('');try{const r=await api<{id:string;status:string}>('/admin/satify/whatsapp/template',{method:'POST',csrf,timeoutMs:30000});setOk(`Template sent to Meta for approval (status: ${r.status}). Check WhatsApp Manager; approval usually takes minutes to hours.`);}catch(e){setError(errorText(e));}finally{setBusy(false);}}
 const d=o.data;
 return <RoleGate roles={['owner','editor']}><AdminPage title="Satify" description="Satisfy yourself: free public data turned into WhatsApp packs. Every number carries its source, time and badge (Measured, Official, Forecast, Estimate)."
  action={<><button className="btn btn-secondary" onClick={()=>o.reload()}>Reload</button><button className="btn btn-primary" disabled={busy} onClick={()=>void refresh()}>{busy?'Working…':'Refresh sources now'}</button></>}>
  <Status error={error} ok={ok}/>
  <DataBlock loading={o.loading} error={o.error} empty={!d}>{d&&<>
   <div className="admin-panel-grid">
    <Card><h2 className="admin-box-title">WhatsApp</h2>
     <p>Mode: {d.whatsapp.mode==='live'?<Badge>Live: messages are sent</Badge>:<Badge variant="muted">Dry run: messages are logged, not sent</Badge>}</p>
     <p className="muted">Number: {d.whatsapp.number?`+${d.whatsapp.number}`:'WHATSAPP_NUMBER not set (QR codes need it)'}</p>
     <p className="muted">Sending: {d.whatsapp.configured?'ready':'set WHATSAPP_TOKEN and WHATSAPP_PHONE_ID'} · Webhook: {d.whatsapp.webhookReady?'ready':'set WHATSAPP_VERIFY_TOKEN and WHATSAPP_APP_SECRET'} · Graph {d.whatsapp.graphVersion}</p>
     <p className="muted">Shared alert template “{d.whatsapp.template}” serves every pack, so new packs need no extra Meta approval.</p>
     <div className="admin-inline-actions"><button className="btn btn-secondary" disabled={busy||!d.whatsapp.templateReady||identity?.role!=='owner'} onClick={()=>void template()}>Submit alert template to Meta</button></div>
     <p className="fineprint">Go live: set SATIFY_DELIVERY_MODE=live in the Module 1 Hostinger environment once the template is approved and a test message looks right.</p>
    </Card>
    <Card><h2 className="admin-box-title">Audience</h2>
     <p><strong>{d.subscribers.active}</strong> active subscribers ({d.subscribers.total} ever joined)</p>
     <p className="muted">Last 24h: {Object.keys(d.deliveries24h).length?Object.entries(d.deliveries24h).map(([k,v])=>`${v} ${k.replace('_',' ')}`).join(' · '):'no messages'}</p>
     <p className="muted">New school registrations: {d.newSchools}</p>
     {d.interest.length>0&&<p className="muted">“Notify me” interest: {d.interest.map(i=>`${i.pack_slug} ${i.n}`).join(' · ')}</p>}
    </Card>
   </div>
   <Card><h2 className="admin-box-title">Packs</h2><TableWrap><thead><tr><th>Pack</th><th>Status</th><th>Subscribers</th></tr></thead><tbody>
    {d.packs.map(p=><tr key={p.slug}><td>{p.name}</td><td>{p.status==='live'?<Badge>live</Badge>:<Badge variant="muted">{p.status==='soon'?'coming soon':p.status}</Badge>}</td><td>{p.subscribers}</td></tr>)}
   </tbody></TableWrap></Card>
   <Card><h2 className="admin-box-title">Held-back messages</h2>
    {!d.notes.length?<p className="muted">Nothing held back. Packs only send when their data is present and fresh.</p>:
    <TableWrap><thead><tr><th>When</th><th>Pack</th><th>Place</th><th>Reason</th></tr></thead><tbody>{d.notes.map((n,i)=><tr key={i}><td>{fmtDate(n.created_at)}</td><td>{n.pack_slug}</td><td>{n.scope}</td><td>{n.note}</td></tr>)}</tbody></TableWrap>}
   </Card>
   <Card><h2 className="admin-box-title">Satify sources</h2><TableWrap><thead><tr><th>Source</th><th>Health</th><th>Last success</th><th>Every</th><th>Error</th></tr></thead><tbody>
    {d.sources.map(s=><tr key={s.id}><td>{s.label}</td><td>{!s.enabled?<Badge variant="muted">off</Badge>:fresh(s.last_success_at,Math.max(6,s.min_minutes/30))?<Badge>ok</Badge>:<Badge variant="danger">{s.fail_count?`failing (${s.fail_count})`:'waiting'}</Badge>}</td><td>{fmtDate(s.last_success_at)}</td><td>{s.min_minutes} min</td><td>{s.last_error??'—'}</td></tr>)}
   </tbody></TableWrap><p className="fineprint">Weather comes from MET Norway; air quality (CAMS) and river flow (GloFAS) from Copernicus as background jobs below. Fires, rain history, sunlight and alerts stay on the Satify sources page.</p></Card>
   <Card><h2 className="admin-box-title">Copernicus jobs</h2>
    <p className="muted">Keys: ADS {d.copernicus.ads?'set':'missing (COPERNICUS_ADS_KEY)'} · EWDS {d.copernicus.ewds?'set':'missing (COPERNICUS_EWDS_KEY)'}. Copernicus prepares each file in a queue; a job usually finishes within minutes.</p>
    {!d.jobs.length?<p className="muted">No jobs yet. They start within a minute once the keys are set.</p>:
    <TableWrap><thead><tr><th>Connector</th><th>Model run</th><th>Status</th><th>Tries</th><th>Updated</th><th>Error</th></tr></thead><tbody>
     {d.jobs.map(j=><tr key={`${j.connector}-${j.run_key}`}><td>{j.connector}</td><td>{j.run_key}</td><td>{j.status==='done'?<Badge>done</Badge>:j.status==='failed'?<Badge variant="danger">failed</Badge>:<Badge variant="muted">{j.status}</Badge>}</td><td>{j.attempts}</td><td>{fmtDate(j.updated_at)}</td><td>{j.error??'—'}</td></tr>)}
    </tbody></TableWrap>}
   </Card>
   <Card><h2 className="admin-box-title">Signals</h2><TableWrap><thead><tr><th>Signal</th><th>Places</th><th>Newest reading</th></tr></thead><tbody>
    {d.signals.map(s=><tr key={s.signal_id}><td>{s.signal_id}</td><td>{s.scopes}</td><td>{fmtDate(s.newest)}{!fresh(s.newest,30)&&<> <Badge variant="danger">stale</Badge></>}</td></tr>)}
   </tbody></TableWrap></Card>
  </>}</DataBlock>
 </AdminPage></RoleGate>;
}
