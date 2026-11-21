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
  {slot:-4,step:6},
  {slot:-3,step:4},
  {slot:-2,step:3},
  {slot:-1,step:1},
  {slot:0,step:0},
  {slot:1,step:2},
  {slot:2,step:5},
  {slot:3,step:7}
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
  const key = label.toLowerCase();
  if (key.includes('tracked')) return 'tracked';
  if (key.includes('youtube')) return 'youtube';
  if (key.includes('instagram')) return 'instagram';
  if (key.includes('view')) return 'views';
  if (key.includes('sub')) return 'subscribers';
  return index % 2 === 0 ? 'tracked' : 'views';
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

  const move=useCallback((diff:number)=>{
    setActive(i=>Math.max(0,Math.min(cards.length-1,i+diff)));
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
    .map(({slot,step})=>({slot,entry:cards[index+step]}))
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

        <div className="stage-regions" aria-hidden="true">
          <span><i/>PUNJAB <b>LAHORE</b></span>
          <span><i/>SINDH <b>KARACHI</b></span>
          <span><i/>KHYBER PAKHTUNKHWA <b>PESHAWAR</b></span>
          <span><i/>BALOCHISTAN <b>QUETTA</b></span>
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
            disabled={index<=0}
            aria-label="Previous creator"
            onClick={()=>move(-1)}
          >
            ‹
          </button>

          <div className="stage-floor-rings" aria-hidden="true">
            <i/><i/><i/>
          </div>
          <div className="stage-podium" aria-hidden="true">
            <i/><i/>
          </div>

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
                <PlatformChips entry={c}/>
                {slot===0 ? (
                  <span className="stage-figure">
                    <small>{current.unit}</small>
                    <b>{formatCount(c.value,true)}</b>
                  </span>
                ) : (
                  <span className="stage-count">
                    <b>{formatCount(c.value,true)}</b> {current.unit}
                  </span>
                )}
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
            disabled={index>=cards.length-1}
            aria-label="Next creator"
            onClick={()=>move(1)}
          >
            ›
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
          <div className="stage-glance">
            <strong>At a glance</strong>
            {stats.slice(0,5).map((s,i)=>(
              <span key={s.label} data-tone={glanceTone(s.label,i)}>
                <i aria-hidden="true"/>
                <em>{s.value}</em>
                <small>{s.label}</small>
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
