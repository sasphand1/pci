'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PointerEvent,WheelEvent} from 'react';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';
import type {PubRanking} from '@/lib/public';

/** The wheel: three sorts, 12 cards each, straight from the published rankings. */
export function PublishedWheel({sorts}:{sorts:PubRanking[]}){
 const [sort,setSort]=useState(0);const [active,setActive]=useState(0);
 const drag=useRef<number|null>(null),ignore=useRef(false);
 const current=sorts[sort];const cards=current?.entries??[];
 const index=Math.max(0,Math.min(active,cards.length-1));
 const move=useCallback((diff:number)=>setActive(i=>Math.max(0,Math.min(cards.length-1,i+diff))),[cards.length]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!document.activeElement?.closest('.ranking-wheel'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[move]);
 function pointerDown(e:PointerEvent<HTMLElement>){if(e.pointerType==='mouse'&&e.button!==0)return;drag.current=e.clientX;}
 function pointerUp(e:PointerEvent<HTMLElement>){if(drag.current===null)return;const diff=e.clientX-drag.current;drag.current=null;if(Math.abs(diff)>12){ignore.current=true;move(diff<0?Math.max(1,Math.round(-diff/100)):-Math.max(1,Math.round(diff/100)));window.setTimeout(()=>{ignore.current=false;},150);}}
 function wheel(e:WheelEvent<HTMLElement>){if(!cards.length)return;const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(dx){e.preventDefault();move(dx>0?1:-1);}}
 return <section className="ranking-wheel" tabIndex={0} aria-label="Top 12 creators">
  <div className="ranking-wheel-heading"><div className="ranking-wheel-kicker">PAKISTAN CREATOR INDEX <span>•</span> PUBLISHED RANKINGS</div><h1>Explore the <span>Creator Index</span></h1><p>Individual creators on YouTube and Instagram, ranked from the numbers the platforms report.</p></div>
  <div className="ranking-wheel-modes" role="group" aria-label="Choose ranking">{sorts.map((s,i)=><button type="button" key={s.scope} className="ranking-wheel-mode" data-active={sort===i} aria-pressed={sort===i} onClick={()=>{setSort(i);setActive(0);}}>{s.label}</button>)}</div>
  <div className="ranking-wheel-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={()=>{drag.current=null;}} onWheel={wheel}>
   <div className="ranking-wheel-light" aria-hidden="true"/>
   {cards.map((c,i)=>({c,offset:i-index})).filter(x=>Math.abs(x.offset)<=2).map(({c,offset})=><Link key={`${current.scope}:${c.person.slug}`} href={`/creators/${encodeURIComponent(c.person.slug)}`} draggable={false} className="ranking-wheel-card" data-offset={offset} data-rank-one={c.rank===1} aria-current={offset===0?'true':undefined} onClick={e=>{if(ignore.current)e.preventDefault();}}>
    {c.rank===1&&<div className="ranking-wheel-crown"><span aria-hidden="true">♛</span><small>{c.tied?'TIED #1':'#1'} {current.label}</small></div>}
    <div className="ranking-wheel-portrait">{safeYoutubeImage(c.person.avatarUrl)?<img src={safeYoutubeImage(c.person.avatarUrl)!} alt="" draggable={false}/>:<span className="ranking-wheel-monogram">{c.person.displayName.slice(0,1)}</span>}</div>
    <div className="ranking-wheel-card-info"><span className="ranking-wheel-place">{c.tied?'=':''}#{c.rank} · {current.unit}</span><strong>{c.person.displayName}</strong><span className="ranking-wheel-figure">{formatCount(c.value,true)}</span><span className="ranking-wheel-profile">Open creator profile ↗</span></div>
   </Link>)}
   {!cards.length&&<div className="ranking-wheel-empty"><h2>Rankings are being prepared</h2><p>This ranking appears as soon as it is published.</p></div>}
   <div className="ranking-wheel-stage-floor" aria-hidden="true"/>
  </div>
  <div className="ranking-wheel-controls"><button type="button" className="ranking-wheel-arrow" disabled={index<=0} aria-label="Previous creator" onClick={()=>move(-1)}>‹</button><span className="ranking-wheel-position">{cards.length?`${index+1} / ${cards.length} CREATORS`:'NO RANKED CREATORS'}</span><button type="button" className="ranking-wheel-arrow" disabled={index>=cards.length-1} aria-label="Next creator" onClick={()=>move(1)}>›</button></div>
  <div className="ranking-wheel-foot"><p>Followers across a person&apos;s accounts are added, not de-duplicated, so they are not unique people. Most Viewed is YouTube lifetime channel views. Most Active is posts in the last 30 days. A number older than 7 days is left out, never shown as zero.</p><a className="ranking-wheel-all" href="#top-100">See the Top 100 →</a></div>
 </section>;
}
