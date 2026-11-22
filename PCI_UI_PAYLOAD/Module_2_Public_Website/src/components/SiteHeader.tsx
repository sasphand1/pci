'use client';

import {useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const primaryLinks=[
 {href:'/',label:'Explore'},
 {href:'/#top-100',label:'Top 100'},
 {href:'/wall',label:'Live Wall'}
] as const;

export function SiteHeader(){
 const [open,setOpen]=useState(false);
 const pathname=usePathname();
 return <header className="site-header pci-site-header">
  <div className="container nav-inner pci-nav-inner">
   <Link href="/" className="nav-brand pci-nav-brand" aria-label="Pakistan Creator Index home" onClick={()=>setOpen(false)}>
    <span className="brand-mark">PCI</span>
    <span className="pci-brand-copy">Pakistan Creator Index<span className="brand-sub">Creator directory</span></span>
   </Link>
   <nav id="main-nav" className="nav-links pci-primary-nav" data-open={open} aria-label="Primary navigation">
    {primaryLinks.map(({href,label})=><Link key={href} href={href} onClick={()=>setOpen(false)} aria-current={href==='/'&&pathname==='/'?'page':href==='/wall'&&pathname.startsWith('/wall')?'page':undefined}>{label}</Link>)}
   </nav>
   <div className="pci-header-actions">
    <Link href="/#discover" className="pci-header-search" aria-label="Search creators" onClick={()=>setOpen(false)}>
     <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.7" cy="10.7" r="6.4"/><path d="m15.5 15.5 5 5"/></svg>
     <span>Search</span>
    </Link>
    <button type="button" className="nav-toggle pci-nav-toggle" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-controls="main-nav" aria-label={open?'Close navigation':'Open navigation'}>{open?'Close':'Menu'}</button>
   </div>
  </div>
 </header>;
}
