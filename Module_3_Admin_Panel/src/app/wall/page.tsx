'use client';
import {useState} from 'react';
import {Card,Badge,Notice} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {WallMessage,WallReport} from '@/lib/types';
export default function WallPage(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;
 const [filter,setFilter]=useState<'pending'|'resolved'|'dismissed'>('pending');
 const reports=useData<WallReport[]>(`/admin/wall/reports?status=${filter}`);const messages=useData<WallMessage[]>('/admin/wall/messages');
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[ok,setOk]=useState('');
 const [authorType,setAuthorType]=useState<'guest'|'user'>('guest'),[authorRef,setAuthorRef]=useState(''),[reason,setReason]=useState(''),[duration,setDuration]=useState('60');
 async function action(path:string,method:'POST'|'PATCH'|'DELETE',body?:unknown){setBusy(path);setError('');setOk('');try{await api(path,{method,csrf,body});setOk('Moderation action applied and audit recorded.');reports.reload();messages.reload();}catch(e){setError(errorText(e));}finally{setBusy('');}}
 function selectAuthor(m:WallMessage){setAuthorType(m.author_type);setAuthorRef(m.author_ref);setReason('Violation of community rules');}
 function review(id:string,status:'resolved'|'dismissed'){return action(`/admin/wall/reports/${id}`,'PATCH',{status});}
 return <RoleGate roles={['owner','moderator']}><AdminPage title="Live wall moderation" description="One shared public wall. Review reports, remove abusive content, ban or unban a guest/member identity." action={<button className="btn btn-secondary" onClick={()=>{reports.reload();messages.reload();}}>Reload</button>}>
  <Status error={error} ok={ok}/><div className="admin-panel-grid"><Card>
   <div className="admin-section-header"><h2>Reported messages</h2><div className="field"><label htmlFor="report-filter">Report status</label><select id="report-filter" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option></select></div></div>
   <DataBlock loading={reports.loading} error={reports.error} empty={!reports.data?.length}><div className="admin-card-stack">{reports.data?.map(r=><div key={r.id} className="admin-report"><div className="admin-toolbar"><strong>{r.nickname}</strong><span className="fineprint">{fmtDate(r.created_at)}</span></div><p>{r.body}</p><p className="fineprint">Report reason: {r.reason}</p><div className="admin-inline-actions">{r.status==='pending'&&<><button className="btn btn-secondary" disabled={!!busy} onClick={()=>review(r.id,'dismissed')}>Dismiss report</button><button className="btn btn-primary" disabled={!!busy} onClick={()=>review(r.id,'resolved')}>Resolve report</button></>} {!r.deleted_at&&<button className="btn btn-danger" disabled={!!busy} onClick={()=>{if(window.confirm('Remove this message from the public wall?'))void action(`/admin/wall/messages/${r.message_id}`,'DELETE');}}>Delete message</button>}</div></div>)}</div></DataBlock>
  </Card><Card><h2 className="admin-box-title">Ban or unban identity</h2><p className="muted text-sm">Select a recent message to fill author details automatically, or paste a valid UUID. Use temporary bans for most violations.</p>
   <form className="form" onSubmit={async e=>{e.preventDefault();await action('/admin/wall/bans','POST',{authorType,authorRef,reason,durationMinutes:duration===''?null:Number(duration)});}}>
    <div className="field"><label htmlFor="ban-type">Identity type</label><select id="ban-type" value={authorType} onChange={e=>setAuthorType(e.target.value as typeof authorType)}><option value="guest">Guest</option><option value="user">Registered user</option></select></div>
    <div className="field"><label htmlFor="ban-uuid">Identity UUID</label><input id="ban-uuid" pattern="[0-9a-fA-F-]{36}" value={authorRef} onChange={e=>setAuthorRef(e.target.value)} required/></div>
    <div className="field"><label htmlFor="ban-reason">Reason</label><input id="ban-reason" minLength={3} maxLength={250} value={reason} onChange={e=>setReason(e.target.value)} required/></div>
    <div className="field"><label htmlFor="ban-duration">Duration (minutes)</label><input id="ban-duration" type="number" min={1} max={525600} value={duration} onChange={e=>setDuration(e.target.value)}/><p className="field-hint">Leave blank for a ban without an automatic expiry.</p></div>
    <div className="admin-inline-actions"><button type="submit" className="btn btn-danger" disabled={!!busy||!authorRef}>Apply ban</button><button type="button" className="btn btn-secondary" disabled={!!busy||!authorRef} onClick={()=>{if(window.confirm('Remove this identity ban?'))void action(`/admin/wall/bans/${authorType}/${authorRef}`,'DELETE');}}>Unban identity</button></div>
   </form><p className="fineprint">Module 1 does not yet expose a list-bans endpoint. Use the identity UUID in recent messages to manage bans. Expired bans stop applying automatically.</p>
  </Card></div>
  <Card><h2 className="admin-box-title">Recent messages (up to 200)</h2><DataBlock loading={messages.loading} error={messages.error} empty={!messages.data?.length}><TableWrap><thead><tr><th>Time</th><th>Nickname</th><th>Message</th><th>Identity</th><th>Status</th><th>Moderate</th></tr></thead><tbody>{messages.data?.map(m=><tr key={m.id}><td>{fmtDate(m.created_at)}</td><td>{m.nickname}</td><td>{m.body}</td><td className="small">{m.author_type}</td><td><Badge variant={m.deleted_at?'danger':'muted'}>{m.deleted_at?'Deleted':'Visible'}</Badge></td><td><div className="admin-inline-actions"><button className="btn btn-secondary" onClick={()=>selectAuthor(m)}>Select author</button>{!m.deleted_at&&<button className="btn btn-danger" disabled={!!busy} onClick={()=>{if(window.confirm('Delete message for everyone?'))void action(`/admin/wall/messages/${m.id}`,'DELETE');}}>Delete</button>}</div></td></tr>)}</tbody></TableWrap></DataBlock></Card>
 </AdminPage></RoleGate>;
}
