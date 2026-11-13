'use client';
import {useState} from 'react';
import {Card,Notice} from '@pci/ui';
import {AdminPage,Status} from '@/components/Shared';
import {api,errorText} from '@/lib/api';
import {useAuth} from '@/components/AuthProvider';
export default function SecurityPage(){
 const {identity,refresh}=useAuth();const [currentPassword,setCurrentPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[totp,setTotp]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState(''),[ok,setOk]=useState('');
 async function change(e:React.FormEvent){e.preventDefault();if(newPassword.length<12)return;setPending(true);setError('');setOk('');try{
  await api('/admin/admin-password',{method:'POST',csrf:identity?.csrfToken,body:{currentPassword,newPassword,totp}});
  setCurrentPassword('');setNewPassword('');setTotp('');setOk('Password changed; all existing sessions were revoked. Sign in again.');await refresh();
 }catch(e){setError(errorText(e));}finally{setPending(false);}}
 return <AdminPage title="Account security" description="Rotate your own administrator password using your existing password and MFA code.">
  <Status error={error} ok={ok}/><div className="admin-panel-grid"><Card><h2 className="admin-box-title">Change password</h2><form className="form" onSubmit={change}>
   <div className="field"><label htmlFor="pw-old">Current password</label><input id="pw-old" type="password" autoComplete="current-password" required value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)}/></div>
   <div className="field"><label htmlFor="pw-new">New password (minimum 12 characters)</label><input id="pw-new" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={newPassword} onChange={e=>setNewPassword(e.target.value)}/></div>
   <div className="field"><label htmlFor="pw-totp">Current authenticator code</label><input id="pw-totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))}/></div>
   <button type="submit" disabled={pending||totp.length!==6||newPassword.length<12} className="btn btn-primary">{pending?'Rotating…':'Rotate password and revoke sessions'}</button>
  </form></Card><Card><h2 className="admin-box-title">Account session</h2><p>Signed in as <strong>{identity?.email}</strong></p><p className="fineprint">Role: {identity?.role}</p><Notice tone="warning">MFA resets/re-enrollment are not exposed by Module 1 V1; contact the Owner and use a secure operator recovery procedure. Do not disable MFA.</Notice></Card></div>
 </AdminPage>;
}
