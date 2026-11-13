'use client';
import {useState} from 'react';
import {Card,Badge,Notice} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate,fmtNum} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {SyncRun} from '@/lib/types';
export default function SyncPage(){
 const {identity}=useAuth();const list=useData<SyncRun[]>('/admin/sync-runs?limit=75');
 const [pending,setPending]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function queue(){if(!window.confirm('Queue a full YouTube refresh for all enabled creators? This consumes API quota.'))return;setPending(true);setError('');setOk('');try{
  const r=await api<{id:string}>('/admin/sync-runs',{method:'POST',csrf:identity?.csrfToken});setOk(`Sync request accepted: ${r.id}. The background worker will process it.`);list.reload();
 }catch(e){setError(errorText(e));}finally{setPending(false);}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="YouTube sync" description="Scheduled at 09:00 Asia/Karachi when enabled. Manual requests are queued in Module 1 and handled by the worker." action={<div className="admin-inline-actions"><button className="btn btn-secondary" onClick={list.reload}>Refresh history</button><button className="btn btn-primary" disabled={pending} onClick={queue}>{pending?'Queuing…':'Queue manual sync'}</button></div>}>
  <Status error={error} ok={ok}/><div className="admin-callout">A sync request is not a completed refresh. The public snapshot changes only when Module 1 publishes verified results. API quota consumption is recorded with each job.</div>
  <Card><h2 className="admin-box-title">Sync runs</h2><DataBlock loading={list.loading} error={list.error} empty={!list.data?.length}><TableWrap><thead><tr><th>Requested</th><th>Source</th><th>Status</th><th>Channels</th><th>Videos</th><th>Quota units</th><th>Completed</th><th>Error</th></tr></thead><tbody>{list.data?.map(r=><tr key={r.id}><td>{fmtDate(r.created_at)}</td><td>{r.source}</td><td><Badge variant={r.status==='failed'?'danger':'muted'}>{r.status}</Badge></td><td>{fmtNum(r.channel_count)}</td><td>{fmtNum(r.video_count)}</td><td>{fmtNum(r.quota_used)}</td><td>{fmtDate(r.finished_at)}</td><td className="admin-trunc" title={r.error_message||r.error_code||''}>{r.error_code||'—'}</td></tr>)}</tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>;
}
