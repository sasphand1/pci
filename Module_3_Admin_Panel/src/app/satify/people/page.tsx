'use client';
import {Fragment,useState} from 'react';
import {Card,Badge} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';

type Sub={id:number;phone:string;created_at:string;opted_out_at:string|null;last_inbound_at:string|null;packs:{pack:string;scope:string}[]};
type Msg={id:number;pack_slug:string;scope:string;kind:string;body:string;created_at:string;recipients:number;sent:number;failed:number;dry_run:number;last_error:string|null};
type School={id:number;school_name:string;city:string;contact_name:string;phone:string;email:string|null;parents_estimate:number|null;status:string;created_at:string};
type Tab='messages'|'subscribers'|'schools';

export default function SatifyPeople(){
 const {identity}=useAuth();const csrf=identity?.csrfToken;
 const [tab,setTab]=useState<Tab>('messages');
 const msgs=useData<Msg[]>('/admin/satify/messages',tab==='messages');
 const subs=useData<Sub[]>('/admin/satify/subscribers',tab==='subscribers');
 const schools=useData<School[]>('/admin/satify/schools',tab==='schools');
 const [error,setError]=useState(''),[open,setOpen]=useState<number|null>(null);
 async function setStatus(id:number,status:string){setError('');try{await api(`/admin/satify/schools/${id}`,{method:'PATCH',csrf,body:{status}});schools.reload();}catch(e){setError(errorText(e));}}
 return <RoleGate roles={['owner','editor']}><AdminPage title="Satify messages & people" description="Every message Satify created, who is subscribed (numbers masked), and schools that registered for Pulsr for Schools.">
  <Status error={error}/>
  <Card><div className="admin-inline-actions">{(['messages','subscribers','schools'] as Tab[]).map(t=><button key={t} type="button" className={`btn ${tab===t?'btn-primary':'btn-secondary'}`} onClick={()=>setTab(t)}>{t==='messages'?'Message log':t==='subscribers'?'Subscribers':'School registrations'}</button>)}</div></Card>
  {tab==='messages'&&<Card><DataBlock loading={msgs.loading} error={msgs.error} empty={!msgs.data?.length}><TableWrap><thead><tr><th>When</th><th>Pack</th><th>Place</th><th>Type</th><th>Recipients</th><th>Result</th><th></th></tr></thead><tbody>
   {msgs.data?.map(m=><Fragment key={m.id}><tr><td>{fmtDate(m.created_at)}</td><td>{m.pack_slug}</td><td>{m.scope}</td><td>{m.kind}</td><td>{m.recipients}</td>
    <td>{m.sent>0&&<Badge>{m.sent} sent</Badge>} {m.dry_run>0&&<Badge variant="muted">{m.dry_run} dry run</Badge>} {m.failed>0&&<Badge variant="danger">{m.failed} failed</Badge>}{m.last_error&&<span className="fineprint"> {m.last_error}</span>}</td>
    <td><button type="button" className="btn btn-secondary" onClick={()=>setOpen(open===m.id?null:m.id)}>{open===m.id?'Hide':'Show'}</button></td></tr>
    {open===m.id&&<tr><td colSpan={7}><pre className="satify-pre">{m.body}</pre></td></tr>}</Fragment>)}
  </tbody></TableWrap></DataBlock></Card>}
  {tab==='subscribers'&&<Card><DataBlock loading={subs.loading} error={subs.error} empty={!subs.data?.length}><TableWrap><thead><tr><th>Number</th><th>Joined</th><th>Packs</th><th>Status</th></tr></thead><tbody>
   {subs.data?.map(s=><tr key={s.id}><td>{s.phone}</td><td>{fmtDate(s.created_at)}</td><td>{s.packs.map(p=>`${p.pack} (${p.scope})`).join(', ')||'—'}</td><td>{s.opted_out_at?<Badge variant="muted">left</Badge>:<Badge>active</Badge>}</td></tr>)}
  </tbody></TableWrap></DataBlock></Card>}
  {tab==='schools'&&<Card><DataBlock loading={schools.loading} error={schools.error} empty={!schools.data?.length}><TableWrap><thead><tr><th>When</th><th>School</th><th>City</th><th>Contact</th><th>Parents</th><th>Status</th></tr></thead><tbody>
   {schools.data?.map(s=><tr key={s.id}><td>{fmtDate(s.created_at)}</td><td>{s.school_name}</td><td>{s.city}</td><td>{s.contact_name} · +{s.phone}{s.email?` · ${s.email}`:''}</td><td>{s.parents_estimate??'—'}</td>
    <td><select value={s.status} onChange={e=>void setStatus(s.id,e.target.value)}>{['new','contacted','active','declined'].map(v=><option key={v} value={v}>{v}</option>)}</select></td></tr>)}
  </tbody></TableWrap></DataBlock></Card>}
 </AdminPage></RoleGate>;
}
