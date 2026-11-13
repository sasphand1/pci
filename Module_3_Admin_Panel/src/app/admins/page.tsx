'use client';
import {useState} from 'react';
import {Card,Badge,Notice} from '@pci/ui';
import {AdminPage,DataBlock,Status,TableWrap,useData,RoleGate} from '@/components/Shared';
import {api,errorText,fmtDate} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
import type {AdminUser,Role} from '@/lib/types';
type OneTime={id:string;email:string;role:Role;temporaryPassword:string;totpUri:string};
export default function AdminUsersPage(){
 const {identity}=useAuth();const list=useData<AdminUser[]>('/admin/admins',identity?.role==='owner');
 const [email,setEmail]=useState(''),[role,setRole]=useState<Role>('editor'),[pending,setPending]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState(''),[oneTime,setOneTime]=useState<OneTime|null>(null);
 async function create(e:React.FormEvent){e.preventDefault();setPending(true);setError('');setOk('');setOneTime(null);try{const result=await api<OneTime>('/admin/admins',{method:'POST',csrf:identity?.csrfToken,body:{email,role}});setOneTime(result);setEmail('');setOk('Admin created. Deliver one-time credentials securely and require password change.');list.reload();}catch(e){setError(errorText(e));}finally{setPending(false);}}
 async function update(u:AdminUser,body:{role?:Role;active?:boolean}){if(!window.confirm(`Change access for ${u.email}? Existing sessions will be revoked.`))return;setPending(true);setError('');setOk('');try{await api(`/admin/admins/${u.id}`,{method:'PATCH',csrf:identity?.csrfToken,body});setOk('Admin access changed and sessions invalidated.');list.reload();}catch(e){setError(errorText(e));}finally{setPending(false);}}
 return <RoleGate roles={['owner']}><AdminPage title="Administrator accounts" description="Manage Owner, Editor and Moderator roles. MFA is mandatory for all admin logins; new accounts receive one-time setup credentials.">
  <Status error={error} ok={ok}/><div className="admin-panel-grid"><Card><h2 className="admin-box-title">Create administrator</h2><form onSubmit={create} className="form">
    <div className="field"><label htmlFor="admin-email">Email</label><input id="admin-email" type="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div>
    <div className="field"><label htmlFor="admin-role">Role</label><select id="admin-role" value={role} onChange={e=>setRole(e.target.value as Role)}><option value="editor">Editor</option><option value="moderator">Moderator</option><option value="owner">Owner</option></select></div>
    <button type="submit" className="btn btn-primary" disabled={pending}>{pending?'Creating…':'Create admin & MFA secret'}</button>
  </form><p className="admin-form-note">The backend returns a temporary password and TOTP enrollment URI only once. Do not screenshot or email them in plain text. Use a secure delivery channel.</p></Card>
  <Card><h2 className="admin-box-title">One-time enrollment material</h2>{oneTime?<div className="admin-secret"><strong>{oneTime.email}</strong><label className="field-hint">Temporary password</label><code>{oneTime.temporaryPassword}</code><label className="field-hint">TOTP authenticator URI</label><code>{oneTime.totpUri}</code><button type="button" className="btn btn-secondary" onClick={()=>setOneTime(null)}>Clear from this screen</button><p className="fineprint">These credentials are not stored in this panel's local storage.</p></div>:<Notice tone="warning">No one-time credentials currently shown. After creating an account, the returned secret appears here only until you clear it or leave the page.</Notice>}</Card></div>
  <Card><div className="admin-section-header"><h2>Administrators</h2><button className="btn btn-secondary" onClick={list.reload}>Reload</button></div>
    <DataBlock loading={list.loading} error={list.error} empty={!list.data?.length}><TableWrap><thead><tr><th>Email</th><th>Role</th><th>Active</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{list.data?.map(u=><tr key={u.id}><td>{u.email}{u.id===identity?.id&&' (You)'}</td><td>{u.role}</td><td><Badge variant={u.active?'normal':'danger'}>{u.active?'Active':'Disabled'}</Badge></td><td>{fmtDate(u.last_login_at)}</td><td><div className="admin-inline-actions"><select aria-label={`Role for ${u.email}`} disabled={pending||u.id===identity?.id} value={u.role} onChange={e=>update(u,{role:e.target.value as Role})}><option value="owner">Owner</option><option value="editor">Editor</option><option value="moderator">Moderator</option></select><button className="btn btn-secondary" disabled={pending||u.id===identity?.id} onClick={()=>update(u,{active:!u.active})}>{u.active?'Disable':'Enable'}</button></div></td></tr>)}</tbody></TableWrap></DataBlock>
  </Card>
 </AdminPage></RoleGate>;
}
