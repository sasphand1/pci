'use client';
import {useState,useEffect} from 'react';
import {Card,Notice} from '@pci/ui';
import {AdminPage,Status,useData,RoleGate} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {Setting} from '@/lib/types';
type Entry={key:string;label:string;description:string;type:'boolean'|'number'|'time'|'text'|'lines'|'sort'};
const ITEMS:Entry[]=[
 {key:'wall_enabled',label:'Live wall enabled',description:'Disable public posting and wall access in an emergency.',type:'boolean'},
 {key:'wall_read_only',label:'Wall read-only',description:'Visitors can view messages but cannot post.',type:'boolean'},
 {key:'wall_slow_mode_seconds',label:'Minimum delay between messages (seconds)',description:'0–60 seconds for the global wall.',type:'number'},
 {key:'wall_blocked_terms',label:'Blocked terms',description:'One term per line. Enforce with the backend filter.',type:'lines'},
 {key:'ranking_default',label:'Default ranking',description:'Public default; visitors can still choose other raw metrics.',type:'sort'},
 {key:'sync_schedule_enabled',label:'Daily sync enabled',description:'The background worker checks this setting each minute.',type:'boolean'},
 {key:'sync_schedule_time',label:'Pakistan refresh time',description:'Time in Asia/Karachi (HH:MM).',type:'time'},
 {key:'homepage_announcement',label:'Homepage announcement',description:'Displayed above the directory when nonempty (maximum 500 characters).',type:'text'}
];
function SettingEditor({item,value,canWrite,csrf,onSaved}:{item:Entry;value:unknown;canWrite:boolean;csrf?:string;onSaved:()=>void}){
 const initial=item.type==='lines'?(Array.isArray(value)?value.join('\n'):''):item.type==='boolean'?Boolean(value):String(value??'');
 const [draft,setDraft]=useState<string|boolean>(initial),[pending,setPending]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 useEffect(()=>setDraft(initial),[initial]);
 async function submit(e:React.FormEvent){e.preventDefault();setPending(true);setError('');setOk('');try{
  const v=item.type==='lines'?String(draft).split(/\r?\n/).map(s=>s.trim()).filter(Boolean):item.type==='number'?Number(draft):draft;
  await api('/admin/settings',{method:'PATCH',csrf,body:{key:item.key,value:v}});setOk('Saved.');onSaved();
 }catch(e){setError(errorText(e));}finally{setPending(false);}}
 return <section className="admin-setting-card"><h3>{item.label}</h3><p>{item.description}</p><form className="form" onSubmit={submit}>
  {item.type==='boolean'?<label className="admin-check"><input type="checkbox" disabled={!canWrite} checked={Boolean(draft)} onChange={e=>setDraft(e.target.checked)}/>{Boolean(draft)?'Enabled':'Disabled'}</label>:
   item.type==='lines'?<textarea aria-label={item.label} rows={5} disabled={!canWrite} value={String(draft)} onChange={e=>setDraft(e.target.value)}/>:
   item.type==='sort'?<select aria-label={item.label} disabled={!canWrite} value={String(draft)} onChange={e=>setDraft(e.target.value)}><option value="subscribers">Subscribers</option><option value="views">Lifetime views</option><option value="videos">Public video count</option></select>:
   <input aria-label={item.label} type={item.type==='time'?'time':item.type==='number'?'number':'text'} min={item.type==='number'?0:undefined} max={item.type==='number'?60:undefined} maxLength={item.type==='text'?500:undefined} disabled={!canWrite} value={String(draft)} onChange={e=>setDraft(e.target.value)} />}
  <Status error={error} ok={ok}/>{canWrite?<button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Saving…':'Save setting'}</button>:<span className="fineprint">Read-only: Owner permission required to change this setting.</span>}
 </form></section>;
}
export default function SettingsPage(){
 const {identity}=useAuth();const list=useData<Setting[]>('/admin/settings');
 return <RoleGate roles={['owner','editor','moderator']}><AdminPage title="Platform settings" description="Centralized operational controls. Owner changes are validated and audited by Module 1." action={<button className="btn btn-secondary" onClick={list.reload}>Reload settings</button>}>
   {list.error&&<Notice tone="danger">{list.error}</Notice>}{list.loading&&<p role="status">Loading settings…</p>}
   {list.data&&<div className="admin-setting-grid">{ITEMS.map(item=><SettingEditor key={item.key} item={item} value={list.data!.find(s=>s.key===item.key)?.value} canWrite={identity?.role==='owner'} csrf={identity?.csrfToken} onSaved={list.reload}/>)}</div>}
   <div className="admin-callout">YouTube integration credentials, cryptographic keys and database passwords are environment variables and must never be editable through this web panel.</div>
 </AdminPage></RoleGate>;
}
