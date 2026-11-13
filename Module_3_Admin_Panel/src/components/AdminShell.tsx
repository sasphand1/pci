'use client';
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Notice} from '@pci/ui';
import {useAuth} from './AuthProvider';
import {NAV} from '@/lib/nav';
import {errorText} from '@/lib/api';
function Login(){
 const {login}=useAuth();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[totp,setTotp]=useState('');
 const [pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setPending(true);setMessage('');try{await login(email.trim(),password,totp);}catch(e){setMessage(errorText(e));}finally{setPending(false);}}
 return <main className="admin-login-shell"><div className="admin-login-panel">
  <div className="admin-login-mark">PCI</div><p className="eyebrow">Restricted access</p><h1>Management console</h1>
  <p className="muted">Sign in with your administrator credentials and current six-digit authenticator code.</p>
  {message&&<Notice tone="danger">{message}</Notice>}
  <form className="form" onSubmit={submit}>
   <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
   <div className="field"><label htmlFor="login-pass">Password</label><input id="login-pass" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
   <div className="field"><label htmlFor="login-totp">Authenticator code</label><input id="login-totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))} required/></div>
   <button className="btn btn-primary" type="submit" disabled={pending||totp.length!==6}>{pending?'Signing in…':'Sign in securely'}</button>
  </form><p className="fineprint">Only authorized Owner, Editor and Moderator accounts may access this panel. The first Owner is created using Module 1’s CLI.</p>
 </div></main>;
}
export function AdminShell({children}:{children:ReactNode}){
 const {identity,loading,logout}=useAuth();const path=usePathname();const [menu,setMenu]=useState(false);const [exitError,setExitError]=useState('');
 if(loading)return <main className="admin-login-shell" role="status"><div className="admin-login-panel">Verifying administrative session…</div></main>;
 if(!identity)return <Login/>;
 const nav=NAV.filter(item=>item.roles.includes(identity.role));
 return <div className="admin-app">
  <aside className={`admin-sidebar${menu?' is-open':''}`} aria-label="Admin navigation">
   <div className="admin-logo"><span className="brand-mark">PCI</span><span><strong>Creator Index</strong><small>Management</small></span></div>
   <nav className="admin-nav">{nav.map(item=><Link onClick={()=>setMenu(false)} aria-current={path===item.href?'page':undefined} href={item.href} key={item.href}>{item.title}</Link>)}</nav>
   <div className="admin-sidebar-bottom"><span className="badge badge-muted">{identity.role}</span><p className="fineprint">{identity.email}</p><a className="admin-public-link" href={process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000"} target="_blank" rel="noreferrer">Public site (local)</a></div>
  </aside>
  <div className="admin-workspace">
   <header className="admin-topbar"><button type="button" className="btn btn-secondary admin-mobile-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>Menu</button>
    <div><strong>Pakistan Creator Index</strong><span className="admin-top-subtitle">Secure administration</span></div>
    <div className="admin-top-actions"><span className="admin-top-identity">{identity.email}</span><button className="btn btn-secondary" onClick={async()=>{setExitError('');try{await logout();}catch(e){setExitError(errorText(e));}}}>Sign out</button></div>
   </header>
   <main className="admin-main" id="main">{exitError&&<Notice tone="danger">{exitError}</Notice>}{children}</main>
  </div>
 </div>;
}
