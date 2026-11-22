'use client';

import Link from 'next/link';
import {useCallback, useEffect, useRef, useState} from 'react';
import type {PointerEvent, WheelEvent} from 'react';
import {formatCount, safeYoutubeImage} from '@/lib/format.mjs';
import type {PubRanking, PubEntry} from '@/lib/public';
import {StageScene} from './StageScene';

const WHEEL_STEP = 60;
const WHEEL_GAP_MS = 550;
const SLOTS:{slot:number;step:number}[] = [
  {slot:-2,step:-2},
  {slot:-1,step:-1},
  {slot:0,step:0},
  {slot:1,step:1},
  {slot:2,step:2}
];

function PlatformChips({entry}:{entry:PubEntry}){
  const seen = Array.from(new Set(entry.person.accounts.map(a=>a.platform)));
  return (
    <span className="stage-chips">
      {seen.map(p=>(
        <span key={p} className="stage-chip" data-platform={p}>
          <i aria-hidden="true"/>
          {p === 'youtube' ? 'YouTube' : 'Instagram'}
        </span>
      ))}
    </span>
  );
}

function glanceTone(label:string,index:number){
  const key=label.toLowerCase();
  if(key.includes('youtube')) return 'youtube';
  if(key.includes('instagram')) return 'instagram';
  if(key.includes('view')) return 'views';
  if(key.includes('sub')) return 'subscribers';
  if(key.includes('published')) return 'published';
  return 'tracked';
}

function GlanceIcon({tone}:{tone:string}){
  if(tone==='youtube') return <svg viewBox="0 0 24 24" aria-hidden="true" className="glance-icon glance-icon-youtube"><path fill="#FF0033" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.6 3.6 12 3.6 12 3.6s-7.6 0-9.4.5A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.8.5 9.4.5 9.4.5s7.6 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8Z"/><path fill="#fff" d="m9.6 16.3 6.3-4.3-6.3-4.3z"/></svg>;
  if(tone==='instagram') return <svg viewBox="0 0 24 24" aria-hidden="true" className="glance-icon glance-icon-instagram"><defs><linearGradient id="pci-instagram-glance" x1="0" x2="1" y1="1" y2="0"><stop offset="0" stopColor="#FEDA75"/><stop offset=".3" stopColor="#FA7E1E"/><stop offset=".56" stopColor="#D62976"/><stop offset=".78" stopColor="#962FBF"/><stop offset="1" stopColor="#4F5BD5"/></linearGradient></defs><rect x="1" y="1" width="22" height="22" rx="6" fill="url(#pci-instagram-glance)"/><rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="17.5" cy="6.7" r="1.2" fill="white"/></svg>;
  if(tone==='views') return <svg viewBox="0 0 24 24" aria-hidden="true" className="glance-icon"><path d="M2 12s3.7-6 10-6 10 6 10 6-3.7 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>;
  if(tone==='subscribers') return <svg viewBox="0 0 24 24" aria-hidden="true" className="glance-icon"><path d="m3 17 6-6 4 4 8-9M15 6h6v6"/></svg>;
  if(tone==='published') return <svg viewBox="0 0 24 24" aria-hidden="true" className="glance-icon"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="glance-icon"><circle cx="9" cy="8" r="3"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M16 6a3 3 0 0 1 0 6M18 15a5 5 0 0 1 4 5v1"/></svg>;
}
export function PublishedWheel({sorts,stats}:{sorts:PubRanking[];stats?:{label:string;value:string}[]}){
  const [sort,setSort]=useState(0);
  const [active,setActive]=useState(0);

  const drag=useRef<number|null>(null);
  const ignore=useRef(false);
  const lastWheel=useRef(0);
  const acc=useRef(0);

  const current=sorts[sort];
  const cards=current?.entries ?? [];
  const index=Math.max(0,Math.min(active,cards.length-1));
  const metricLabel=current?.scope.includes('subscribed') ? 'followers' :
    current?.scope.includes('viewed') ? 'views' :
    current?.scope.includes('active') ? 'videos' : (current?.unit ?? '');

  const move=useCallback((diff:number)=>{
    setActive(i=>cards.length ? ((i+diff)%cards.length+cards.length)%cards.length : 0);
  },[cards.length]);

  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      const target=document.activeElement as HTMLElement | null;
      if(!target?.closest('.pci-stage')) return;
      if(e.key==='ArrowRight' || e.key==='ArrowLeft'){
        e.preventDefault();
        move(e.key==='ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[move]);

  function pointerDown(e:PointerEvent<HTMLElement>){
    if(e.pointerType==='mouse' && e.button!==0) return;
    drag.current=e.clientX;
  }

  function pointerUp(e:PointerEvent<HTMLElement>){
    if(drag.current===null) return;
    const diff=e.clientX-drag.current;
    drag.current=null;
    if(Math.abs(diff)>12){
      ignore.current=true;
      move(diff<0 ? Math.max(1,Math.round(-diff/100)) : -Math.max(1,Math.round(diff/100)));
      window.setTimeout(()=>{ ignore.current=false; },150);
    }
  }

  function wheel(e:WheelEvent<HTMLElement>){
    if(!cards.length) return;
    const dx = Math.abs(e.deltaX)>Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if(!dx) return;
    e.preventDefault();
    const now=Date.now();
    if(now-lastWheel.current < WHEEL_GAP_MS) return;
    acc.current += dx;
    if(Math.abs(acc.current) < WHEEL_STEP) return;
    move(acc.current > 0 ? 1 : -1);
    acc.current = 0;
    lastWheel.current = now;
  }

  const shown = SLOTS
    .filter(({step})=>cards.length>=5 || (cards.length>0 && Math.abs(step)<=Math.floor((cards.length-1)/2)))
    .map(({slot,step})=>({slot,entry:cards.length ? cards[((index+step)%cards.length+cards.length)%cards.length] : undefined}))
    .filter((x):x is {slot:number;entry:PubEntry}=>Boolean(x.entry));

  return (
    <section className="pci-stage" tabIndex={0} aria-label="Top creators">
      <StageScene/>

      <div className="stage-inner">
        <div className="stage-heading">
          <div className="stage-kicker">
            <span/>
            THE PAKISTAN CREATOR INDEX
            <span/>
          </div>
          <h1>Pakistan&apos;s Top <em>Digital Creators</em></h1>
          <p>A unified, data-driven ranking of Pakistan&apos;s leading creators across major platforms.</p>
        </div>

        <div className="stage-modes" role="group" aria-label="Choose ranking">
          {sorts.map((s,i)=>(
            <button
              type="button"
              key={s.scope}
              className="stage-mode"
              data-active={sort===i}
              data-kind={s.scope.split('.')[1]}
              aria-pressed={sort===i}
              onClick={()=>{ setSort(i); setActive(0); }}
            >
              <i aria-hidden="true"/>
              {s.label}
            </button>
          ))}
        </div>

        <div
          className="stage-wheel"
          onPointerDown={pointerDown}
          onPointerUp={pointerUp}
          onPointerCancel={()=>{drag.current=null;}}
          onWheel={wheel}
        >
          <button
            type="button"
            className="stage-arrow"
            data-side="left"
            disabled={cards.length<=1}
            aria-label="Previous creator"
            onClick={()=>move(-1)}
          >
            &lt;
          </button>


          {shown.map(({slot,entry:c})=>(
            <Link
              key={`${current.scope}:${c.person.slug}`}
              href={`/creators/${encodeURIComponent(c.person.slug)}`}
              draggable={false}
              className="stage-card"
              data-slot={slot}
              data-center={slot===0}
              onClick={e=>{ if(ignore.current) e.preventDefault(); }}
            >
              {slot===0 && c.rank===1 && (
                <span className="stage-crown" aria-hidden="true">
                  <svg viewBox="0 0 64 40">
                    <path d="M4 34 8 8l14 14L32 2l10 20L56 8l4 26Z"/>
                    <rect x="6" y="34" width="52" height="5" rx="2"/>
                  </svg>
                </span>
              )}

              <span className="stage-rank">#{c.rank}</span>

              <span className="stage-photo">
                {safeYoutubeImage(c.person.avatarUrl)
                  ? <img src={safeYoutubeImage(c.person.avatarUrl)!} alt="" draggable={false}/>
                  : <span className="stage-monogram">{c.person.displayName.slice(0,1)}</span>}
              </span>

              <span className="stage-body">
                <strong>{c.person.displayName}</strong>
                <span className="stage-count">
                  <b>{formatCount(c.value,true)}</b>
                  <small>{metricLabel}</small>
                </span>
              </span>
            </Link>
          ))}

          {!cards.length && (
            <div className="stage-empty">
              <h2>Rankings are being prepared</h2>
              <p>This ranking appears as soon as it is published.</p>
            </div>
          )}

          <button
            type="button"
            className="stage-arrow"
            data-side="right"
            disabled={cards.length<=1}
            aria-label="Next creator"
            onClick={()=>move(1)}
          >
            &gt;
          </button>
        </div>

        <div className="stage-dots" role="group" aria-label="Choose creator">
          {cards.map((c,i)=>(
            <button
              type="button"
              key={c.person.slug}
              data-active={i===index}
              aria-label={`Show ${c.person.displayName}, rank ${c.rank}`}
              onClick={()=>setActive(i)}
            />
          ))}
        </div>

        {stats && stats.length > 0 && (
          <div className="stage-glance" aria-label="Creator statistics">
            <strong className="stage-glance-title"><svg viewBox="0 0 24 24" className="glance-icon" aria-hidden="true"><path d="M4 13v7M10 9v11M16 4v16M22 11v9"/></svg>At a glance</strong>
            {stats.slice(0,5).map((s,i)=>(
              <span className="stage-glance-stat" key={s.label} data-tone={glanceTone(s.label,i)}>
                <GlanceIcon tone={glanceTone(s.label,i)}/>
                <span className="stage-glance-data"><em>{s.value}</em><small>{s.label}</small></span>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

