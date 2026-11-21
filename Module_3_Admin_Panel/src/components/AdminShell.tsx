'use client';
import {useState,type ReactNode} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Notice} from '@pci/ui';
import {useAuth} from './AuthProvider';
import {OverviewProvider,useOverview} from './OverviewProvider';
import {SessionGuard} from './SessionGuard';
import {Icon} from './Icons';
import {visibleGroups} from '@/lib/nav';
import {errorText} from '@/lib/api';

function Login(){
 const {login,notice,clearNotice}=useAuth();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[totp,setTotp]=useState('');
 const [pending,setPending]=useState(false),[message,setMessage]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setPending(true);setMessage('');clearNotice();try{await login(email.trim(),password,totp);}catch(e){setMessage(errorText(e));setPassword('');setTotp('');}finally{setPending(false);}}
 return <main className="admin-login-shell"><div className="admin-login-panel">
  <div className="admin-login-mark">PCI</div><p className="eyebrow">Restricted access</p><h1>Management console</h1>
  <p className="muted">Sign in with your administrator credentials and current six-digit authenticator code.</p>
  {notice&&<Notice tone="warning">{notice}</Notice>}
  {message&&<Notice tone="danger">{message}</Notice>}
  <form className="form" onSubmit={submit}>
   <div className="field"><label htmlFor="login-email">Email</label><input id="login-email" type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
   <div className="field"><label htmlFor="login-pass">Password</label><input id="login-pass" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
   <div className="field"><label htmlFor="login-totp">Authenticator code</label><input id="login-totp" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoComplete="one-time-code" value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,'').slice(0,6))} required/></div>
   <button className="btn btn-primary" type="submit" disabled={pending||totp.length!==6}>{pending?'Signing in…':'Sign in securely'}</button>
  </form><p className="fineprint">Only authorized Owner, Editor and Moderator accounts may access this panel. The first Owner is created using Module 1’s CLI.</p>
 </div></main>;
}

function StatusPill({canOpen}:{canOpen:boolean}){
 const {data,error,loading}=useOverview();
 if(loading&&!data)return <span className="state-pill state-idle" role="status">Checking…</span>;
 if(!data)return <span className="state-pill state-attention" title={error||undefined}>Status unavailable</span>;
 const s=data.state;const cls=`state-pill state-${s.level}`;
 const reasons=s.reasons.join('. ');
 return canOpen?<Link className={cls} href="/pipeline" title={reasons||undefined} aria-label={`System status: ${s.label}${reasons?`. ${reasons}`:''}`}><span className="state-dot" aria-hidden="true"/>{s.label}</Link>
  :<span className={cls} title={reasons||undefined}><span className="state-dot" aria-hidden="true"/>{s.label}</span>;
}

function Shell({children}:{children:ReactNode}){
 const {identity,logout}=useAuth();const path=usePathname();const [menu,setMenu]=useState(false);const [exitError,setExitError]=useState('');
 if(!identity)return null;
 const groups=visibleGroups(identity.role);
 const initials=identity.email.slice(0,2).toUpperCase();
 const canOpenStatus=identity.role!=='moderator';
 return <div className="admin-app">
  <aside className={`admin-sidebar${menu?' is-open':''}`} aria-label="Admin navigation">
   <div className="admin-logo"><span className="brand-mark">PCI</span><span><strong>Creator Index</strong><small>Management</small></span></div>
   <nav className="admin-nav">{groups.map((g,i)=><div className="nav-group" key={g.label??`g${i}`}>
    {g.label&&<p className="nav-label">{g.label}</p>}
    {g.items.map(item=><Link className="nav-link" onClick={()=>setMenu(false)} aria-current={path===item.href||(item.href!=='/'&&path.startsWith(item.href+'/'))?'page':undefined} href={item.href} key={item.href}><Icon name={item.icon}/>{item.title}</Link>)}
   </div>)}</nav>
   <div className="admin-sidebar-bottom"><span className="badge badge-muted">{identity.role}</span><p className="fineprint">{identity.email}</p><a className="admin-public-link" href={process.env.NEXT_PUBLIC_SITE_URL||'http://localhost:3000'} target="_blank" rel="noreferrer">Open public site</a></div>
  </aside>
  <div className="admin-workspace">
   <header className="admin-topbar"><button type="button" className="btn btn-secondary admin-mobile-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Icon name="menu"/>Menu</button>
    <div className="admin-top-title"><strong>Pakistan Creator Index</strong><span className="admin-top-subtitle">Secure administration</span></div>
    <div className="admin-top-actions"><StatusPill canOpen={canOpenStatus}/><span className="admin-avatar" aria-hidden="true">{initials}</span><span className="admin-top-identity">{identity.email}</span><button type="button" className="btn btn-secondary" onClick={async()=>{setExitError('');try{await logout();}catch(e){setExitError(errorText(e));}}}>Sign out</button></div>
   </header>
   <main className="admin-main" id="main">{exitError&&<Notice tone="danger">{exitError}</Notice>}{children}</main>
  </div>
  <SessionGuard/>
 </div>;
}

export function AdminShell({children}:{children:ReactNode}){
 const {identity,loading}=useAuth();
 if(loading)return <main className="admin-login-shell" role="status"><div className="admin-login-panel">Verifying administrative session…</div></main>;
 if(!identity)return <Login/>;
 return <OverviewProvider><Shell>{children}</Shell></OverviewProvider>;
}
