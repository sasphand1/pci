'use client';
import {useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
const links=[['/','Home'],['/rankings','Rankings'],['/creators','Creators'],['/videos','Videos'],['/categories','Categories'],['/compare','Compare'],['/wall','Live Wall'],['/account','Account']];
export function SiteHeader(){const [open,setOpen]=useState(false);const path=usePathname();return <header className="site-header"><div className="container nav-inner"><Link href="/" className="nav-brand" aria-label="Pakistan Creator Index home" onClick={()=>setOpen(false)}><span className="brand-mark">PCI</span><span>Pakistan Creator Index<span className="brand-sub">YouTube creator directory</span></span></Link><button type="button" className="nav-toggle" onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="main-nav">{open?'Close':'Menu'}</button><nav id="main-nav" className="nav-links" data-open={open} aria-label="Main navigation">{links.map(([url,label])=><Link key={url} href={url} onClick={()=>setOpen(false)} aria-current={url==='/'?path==='/'?'page':undefined:path===url||path.startsWith(url+'/')?'page':undefined}>{label}</Link>)}</nav></div></header>}
