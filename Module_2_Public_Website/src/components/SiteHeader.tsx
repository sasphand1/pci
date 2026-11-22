'use client';

import {useState} from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';

const primaryLinks = [
  {href:'/',label:'Home'},
  {href:'/#top-100',label:'Rankings'},
  {href:'/#discover',label:'Creators'},
  {href:'/events',label:'Events'},
  {href:'/satellite',label:'Satellite'},
  {href:'/methodology',label:'Insights'},
  {href:'/about',label:'About'}
] as const;

export function SiteHeader(){
  const [open,setOpen]=useState(false);
  const pathname=usePathname();

  return (
    <header className="site-header pci-site-header">
      <div className="container nav-inner pci-nav-inner">
        <Link
          href="/"
          className="nav-brand pci-nav-brand"
          aria-label="Pakistan Creator Index home"
          onClick={()=>setOpen(false)}
        >
          <span className="brand-mark" aria-hidden="true"><span className="pci-logo-cut" /></span>
          <span className="pci-brand-copy">
            Pakistan
            <strong>Creator Index</strong>
          </span>
        </Link>

        <nav
          id="main-nav"
          className="pci-primary-nav"
          data-open={open}
          aria-label="Primary navigation"
        >
          {primaryLinks.map(({href,label})=>{
            const active = href === '/' ? pathname === '/'
              : href.startsWith('/#') ? false
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                onClick={()=>setOpen(false)}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="pci-header-actions">
          <Link
            href="/#discover"
            className="pci-header-search"
            aria-label="Search creators, platforms, or topics"
            onClick={()=>setOpen(false)}
          >
            <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
              <circle cx="11" cy="11" r="6.5"/>
              <path d="m16 16 4.5 4.5"/>
            </svg>
            <span>Search creators, platforms, or topics...</span><kbd className="pci-search-shortcut" aria-hidden="true">⌘K</kbd>
          </Link>

          <Link href="/wall" className="pci-header-icon" aria-label="Community live wall">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/>
              <path d="M10 20a2 2 0 0 0 4 0"/>
            </svg>
          </Link>

          <Link href="/account" className="pci-header-ghost">Sign In</Link>
          <Link href="/contact" className="pci-header-cta"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>Get Updates</Link>

          <button
            type="button"
            className="nav-toggle pci-nav-toggle"
            onClick={()=>setOpen(v=>!v)}
            aria-expanded={open}
            aria-controls="main-nav"
            aria-label={open?'Close navigation':'Open navigation'}
          >
            {open?'Close':'Menu'}
          </button>
        </div>
      </div>
    </header>
  );
}
