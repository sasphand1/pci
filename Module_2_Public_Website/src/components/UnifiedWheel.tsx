 'use client';
import Link from 'next/link';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {PointerEvent,WheelEvent} from 'react';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';
export type UnifiedPerson={instagramCreatorId:string;youtubeCreatorId:string;username:string;youtubeSlug:string;displayName:string;thumbnailUrl?:string|null;score:number;rank:number;tiedWith:number;subscriberCount:string|null;viewCount:string|null;followersCount:string|null;breakdown:{youtubeSubscribers:number;youtubeViews:number;instagramFollowers:number;youtubePlatform:number}};
export type UnifiedResponse={data:UnifiedPerson[];meta:{cohortSize:number;method:string;disclosure:string}};
function groups(items:UnifiedPerson[]){const result:{rank:number;members:UnifiedPerson[]}[]=[];for(const p of items){let g=result.find(x=>x.rank===p.rank);if(!g){g={rank:p.rank,members:[]};result.push(g);}g.members.push(p);}return result;}
export function UnifiedWheel({items}:{items:UnifiedPerson[]}){
 const cards=groups(items);const [active,setActive]=useState(0);const origin=useRef<number|null>(null);const ignore=useRef(false);
 const idx=Math.min(active,Math.max(0,cards.length-1));
 const move=useCallback((n:number)=>setActive(old=>Math.max(0,Math.min(cards.length-1,old+n))),[cards.length]);
 useEffect(()=>{function key(e:KeyboardEvent){if(!document.activeElement?.closest('.ranking-wheel'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}}window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[move]);
 function start(e:PointerEvent<HTMLElement>){if(e.pointerType==='mouse'&&e.button!==0)return;origin.current=e.clientX;}
 function finish(e:PointerEvent<HTMLElement>){if(origin.current===null)return;const delta=e.clientX-origin.current;origin.current=null;if(Math.abs(delta)>12){ignore.current=true;move(delta<0?Math.max(1,Math.min(5,Math.round(-delta/95))):-Math.max(1,Math.min(5,Math.round(delta/95))));setTimeout(()=>{ignore.current=false},150);}}
 function scroll(e:WheelEvent<HTMLElement>){const n=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!n)return;e.preventDefault();move(n>0?1:-1);}
 return <section className="ranking-wheel unified-wheel" tabIndex={0} aria-label="Cross-platform research leaderboard">
  <div className="ranking-wheel-heading"><div className="ranking-wheel-kicker">PAKISTAN CREATOR INDEX · RESEARCH PREVIEW</div><h1>Combined <span>Top 10</span></h1><p>Curated, matched YouTube and Instagram people. Scores are relative to this eligible group, not a measure of influence.</p></div>
  <div className="ranking-wheel-stage" onPointerDown={start} onPointerUp={finish} onPointerCancel={()=>{origin.current=null}} onWheel={scroll}>
   {cards.map((g,i)=>({g,offset:i-idx})).filter(x=>Math.abs(x.offset)<=2).map(({g,offset})=><div key={g.rank} className="ranking-wheel-card unified-wheel-card" data-offset={offset} data-rank-one={g.rank===1}>
    {g.rank===1&&<div className="ranking-wheel-crown" aria-label={g.members.length>1?'Shared rank one, split crown':'Rank one'}><span aria-hidden="true">{g.members.length>1?'♛ | ♛':'♛'}</span><small>{g.members.length>1?'SPLIT CROWN · TIED #1':'#1 COMBINED'}</small></div>}
    <div className="unified-wheel-rank">#{g.rank}{g.members.length>1?` · ${g.members.length}-WAY TIE`:''}</div>
    <div className="unified-wheel-members">{g.members.map(person=><Link key={person.instagramCreatorId} draggable={false} href={`/creators/${encodeURIComponent(person.youtubeSlug)}`} className="unified-wheel-person" onClick={e=>{if(ignore.current)e.preventDefault()}} aria-label={`Open ${person.displayName} profile`}>
      <div className="ranking-wheel-portrait">{safeYoutubeImage(person.thumbnailUrl)?<img src={safeYoutubeImage(person.thumbnailUrl)!} alt="" draggable={false}/>:<span className="ranking-wheel-monogram">{person.displayName.slice(0,1)}</span>}</div>
      <strong>{person.displayName}</strong><span>@{person.username}</span><span className="unified-wheel-visit">Open profile ↗</span>
     </Link>)}</div>
    <div className="unified-wheel-metrics"><strong>{g.members[0].score.toFixed(2)}</strong><small>relative index score / 100</small><span>YouTube subs + views · Instagram followers</span></div>
   </div>)}
   {!cards.length&&<div className="ranking-wheel-empty">No eligible matched creators with complete statistics yet.</div>}
  </div>
  <div className="ranking-wheel-controls"><button type="button" className="ranking-wheel-arrow" aria-label="Previous rank" disabled={idx===0} onClick={()=>move(-1)}>‹</button><div className="ranking-wheel-position">{cards.length?`POSITION ${idx+1} OF ${cards.length}`:'NO RANKS'}</div><button type="button" className="ranking-wheel-arrow" aria-label="Next rank" disabled={idx>=cards.length-1} onClick={()=>move(1)}>›</button></div>
  <p className="unified-wheel-disclosure">Experimental rank fusion. Equal platform weighting; identical scores share one card. No creator is ranked without verified matching and complete statistics.</p>
 </section>;
}
