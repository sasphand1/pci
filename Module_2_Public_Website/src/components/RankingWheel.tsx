'use client';

import Link from 'next/link';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {PointerEvent,WheelEvent} from 'react';
import type {Creator,SortMetric} from '@/lib/types';
import {formatCount,safeYoutubeImage,displayDate} from '@/lib/format.mjs';

type WheelData=Record<SortMetric,Creator[]>;
const modes:{id:SortMetric;label:string;metric:string}[]=[
  {id:'views',label:'Most Viewed',metric:'Channel views'},
  {id:'subscribers',label:'Most Subscribed',metric:'Subscribers'},
  {id:'videos',label:'Most Active',metric:'Public videos'}
];
const field:Record<SortMetric,keyof Creator>={views:'viewCount',subscribers:'subscriberCount',videos:'videoCount'};
function verifiedCount(c:Creator,metric:SortMetric){return c[field[metric]] as string|null;}

export function RankingWheel({rankings,asOf}:{rankings:WheelData;asOf:string|null}){
 const [metric,setMetric]=useState<SortMetric>('views');
 const [selected,setSelected]=useState(0);
 const drag=useRef<{x:number;y:number;time:number;lastX:number;lastTime:number;moved:boolean}|null>(null);
 const ignoreClick=useRef(false);
 const wheelAcc=useRef(0);
 const cards=useMemo(()=>rankings[metric].filter(c=>verifiedCount(c,metric)!==null).slice(0,100),[metric,rankings]);
 const current=Math.min(selected,Math.max(0,cards.length-1));
 const move=useCallback((delta:number)=>setSelected(prev=>Math.max(0,Math.min(cards.length-1,prev+delta))),[cards.length]);
 const switchMetric=(next:SortMetric)=>{setMetric(next);setSelected(0);wheelAcc.current=0;};
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(!document.activeElement?.closest('.ranking-wheel'))return;if(e.key==='ArrowRight'){e.preventDefault();move(1);}else if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[move]);
 function pointerDown(e:PointerEvent<HTMLElement>){if(e.button!==0&&e.pointerType==='mouse')return;drag.current={x:e.clientX,y:e.clientY,time:performance.now(),lastX:e.clientX,lastTime:performance.now(),moved:false};}
 function pointerMove(e:PointerEvent<HTMLElement>){const d=drag.current;if(!d)return;const dx=e.clientX-d.x;if(Math.abs(dx)>7)d.moved=true;d.lastX=e.clientX;d.lastTime=performance.now();}
 function pointerUp(e:PointerEvent<HTMLElement>){const d=drag.current;drag.current=null;if(!d||!d.moved)return;const delta=e.clientX-d.x;ignoreClick.current=true;const steps=Math.max(1,Math.min(8,Math.round(Math.abs(delta)/95)));move(delta<0?steps:-steps);window.setTimeout(()=>{ignoreClick.current=false;},120);}
 function onWheel(e:WheelEvent<HTMLElement>){if(!cards.length)return;const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!dx)return;e.preventDefault();wheelAcc.current+=dx;const steps=Math.trunc(wheelAcc.current/70);if(steps!==0){move(Math.max(-5,Math.min(5,steps)));wheelAcc.current-=steps*70;}}
 // The landing pose keeps #1 in focus while showing five distinct profiles.
 const visible=cards.map((c,i)=>({c,i,offset:current===0&&cards.length>=5?([0,-1,1,-2,2][i]??10):i-current})).filter(({offset})=>Math.abs(offset)<=2);
 const active=cards[current];
 return <section className="ranking-wheel" aria-label="Pakistan Creator Index ranking wheel" tabIndex={0}>
  <div className="ranking-wheel-heading"><div className="ranking-wheel-kicker">PAKISTAN CREATOR INDEX</div><h1>Discover Pakistan’s<br/><span>Top YouTube Creators</span></h1><p>Explore creators, compare public channel statistics, and discover who leads among our tracked channels.</p></div>
  <div className="ranking-wheel-modes" role="group" aria-label="Choose ranking metric">{modes.map(m=><button key={m.id} type="button" className="ranking-wheel-mode" data-active={metric===m.id} aria-pressed={metric===m.id} onClick={()=>switchMetric(m.id)}>{m.label}</button>)}</div>
  <div className="ranking-wheel-stage" onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;}} onWheel={onWheel} aria-label="Swipe or scroll left and right to browse the rankings">
   <div className="ranking-wheel-light" aria-hidden="true"/>
   {visible.map(({c,i,offset})=>{const image=safeYoutubeImage(c.thumbnailUrl);const rank=c.rank??i+1;return <Link key={`${metric}:${c.id}`} href={`/creators/${encodeURIComponent(c.slug)}`} className="ranking-wheel-card" data-offset={offset} data-rank-one={rank===1} aria-label={`Rank ${rank}: ${c.displayName}. Open creator profile.`} aria-current={offset===0?'true':undefined} onClick={e=>{if(ignoreClick.current)e.preventDefault();}} draggable={false}>
      {rank===1&&<div className="ranking-wheel-crown" aria-label="Number one for selected metric"><svg viewBox="0 0 64 46" width="54" height="42" aria-hidden="true"><path d="M6 12 17 23 32 4 47 23 58 12 53 37H11L6 12Z" fill="currentColor" stroke="#fef1bb" strokeWidth="2" strokeLinejoin="round"/><path d="M11 42H53" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/><circle cx="6" cy="10" r="3" fill="currentColor"/><circle cx="32" cy="4" r="3" fill="currentColor"/><circle cx="58" cy="10" r="3" fill="currentColor"/></svg><small>#{rank} {modes.find(m=>m.id===metric)?.label}</small></div>}
      <div className="ranking-wheel-portrait">{image?<img src={image} alt="" draggable={false}/>:<span className="ranking-wheel-monogram" aria-hidden="true">{c.displayName.slice(0,1).toUpperCase()}</span>}</div>
      <div className="ranking-wheel-card-info"><span className="ranking-wheel-place">#{rank} · {modes.find(m=>m.id===metric)?.metric}</span><strong>{c.displayName}</strong><span className="ranking-wheel-figure">{formatCount(verifiedCount(c,metric),true)}</span><span className="ranking-wheel-profile">{offset===0?'View profile ↗':'Open profile ↗'}</span></div>
     </Link>;})}
   {!cards.length&&<div className="ranking-wheel-empty"><h2>Waiting for published statistics</h2><p>Creator profiles will appear after the next successful statistics update.</p></div>}
   <div className="ranking-wheel-stage-floor" aria-hidden="true"/>
  </div>
  <div className="ranking-wheel-controls"><button className="ranking-wheel-arrow" type="button" aria-label="Previous creator" disabled={current<=0} onClick={()=>move(-1)}>‹</button><div className="ranking-wheel-position" aria-live="polite">{active?<><strong>{current+1}</strong><span> / {cards.length} CREATOR PROFILES</span></>:<span>NO RANKED CREATORS</span>}</div><button className="ranking-wheel-arrow" type="button" aria-label="Next creator" disabled={current>=cards.length-1} onClick={()=>move(1)}>›</button></div>
  <div className="ranking-wheel-foot"><p>Ranked by reported {modes.find(m=>m.id===metric)?.metric.toLowerCase()}; not a composite influence score. Only selected tracked channels are included. Last updated: {displayDate(asOf)}.</p><Link className="ranking-wheel-all" href={`/rankings?sort=${metric}`}>View full rankings →</Link></div>
 </section>;
}
