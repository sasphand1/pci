'use client';

import {useMemo,useRef,useState} from 'react';
import type {PointerEvent as ReactPointerEvent,MouseEvent as ReactMouseEvent} from 'react';
import Link from 'next/link';
import type {Category,Creator} from '@/lib/types';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';

const INITIAL_RAILS=3;
function categoryKind(label:string){
 const s=label.toLowerCase();
 if(/vlog|influenc|creator/.test(s))return 'vlog';
 if(/news|journal|comment|politic/.test(s))return 'news';
 if(/islam|faith|relig/.test(s))return 'faith';
 if(/entertain|comed/.test(s))return 'entertainment';
 if(/tech|educat|learn/.test(s))return 'tech';
 if(/food|travel|lifestyle/.test(s))return 'lifestyle';
 if(/gam|sport/.test(s))return 'gaming';
 return 'default';
}
function CreatorRail({category,creators}:{category:Category;creators:Creator[]}){
 const strip=useRef<HTMLDivElement>(null);
 const [all,setAll]=useState(false);
 const drag=useRef<{startX:number;scrollLeft:number;moved:boolean}|null>(null);
 const skipClick=useRef(false);
 function dragStart(e:ReactPointerEvent<HTMLDivElement>){if(e.pointerType!=='mouse'||e.button!==0||!strip.current)return;drag.current={startX:e.clientX,scrollLeft:strip.current.scrollLeft,moved:false};}
 function dragMove(e:ReactPointerEvent<HTMLDivElement>){const d=drag.current;if(!d||!strip.current)return;const distance=e.clientX-d.startX;if(Math.abs(distance)>7){d.moved=true;strip.current.scrollLeft=d.scrollLeft-distance;}}
 function dragEnd(){if(drag.current?.moved){skipClick.current=true;window.setTimeout(()=>{skipClick.current=false;},130);}drag.current=null;}
 function guardClick(e:ReactMouseEvent<HTMLDivElement>){if(skipClick.current){e.preventDefault();e.stopPropagation();}}
 function scroll(direction:number){const el=strip.current;if(el)el.scrollBy({left:direction*Math.max(320,el.clientWidth*.78),behavior:'smooth'});}
 return <section className="pci-rail" aria-labelledby={`pci-rail-${category.id}`}>
  <div className="pci-rail-heading"><div><h3 id={`pci-rail-${category.id}`}>{category.label}</h3><span>{creators.length} tracked {creators.length===1?'creator':'creators'} in this view</span></div>
   <div className="pci-rail-actions"><button type="button" className="pci-rail-all" onClick={()=>setAll(v=>!v)} aria-expanded={all}>{all?'Collapse':'See all'}</button><button type="button" className="pci-rail-arrow" onClick={()=>scroll(-1)} aria-label={`Scroll ${category.label} left`}>‹</button><button type="button" className="pci-rail-arrow" onClick={()=>scroll(1)} aria-label={`Scroll ${category.label} right`}>›</button></div>
  </div>
  <div className="pci-rail-track" data-expanded={all} ref={strip} role="region" tabIndex={0} onPointerDown={dragStart} onPointerMove={dragMove} onPointerUp={dragEnd} onPointerCancel={dragEnd} onPointerLeave={dragEnd} onClickCapture={guardClick} aria-label={`${category.label} creators; scroll horizontally`}>
   {creators.map(creator=>{const image=safeYoutubeImage(creator.thumbnailUrl);return <Link className="pci-rail-card" data-kind={categoryKind(category.label)} href={`/creators/${encodeURIComponent(creator.slug)}`} key={creator.id} aria-label={`Open ${creator.displayName}'s profile`}>
    <span className="pci-rail-art" aria-hidden="true">{image?<img src={image} alt="" loading="lazy" draggable={false}/>:<span className="pci-rail-monogram">{creator.displayName.slice(0,1).toUpperCase()}</span>}</span>
    <span className="pci-rail-info"><strong>{creator.displayName}</strong><span>{creator.viewCount!==null?`${formatCount(creator.viewCount,true)} channel views`:'View profile'}</span></span>
    <span className="pci-rail-open" aria-hidden="true">↗</span>
   </Link>;})}
  </div>
 </section>;
}

export function CategoryRails({categories,creators}:{categories:Category[];creators:Creator[]}){
 const [showAll,setShowAll]=useState(false);
 const [query,setQuery]=useState('');
 const [selected,setSelected]=useState<string>('all');
 const visibleCategories=useMemo(()=>{
  const q=query.trim().toLocaleLowerCase();
  return categories.map(category=>({category,matched:creators.filter(c=>c.categories?.some(tag=>tag.slug===category.slug||tag.label===category.label)&&(!q||c.displayName.toLocaleLowerCase().includes(q)))}))
   .filter(entry=>entry.matched.length>0)
   .filter(entry=>selected==='all'||entry.category.slug===selected);
 },[categories,creators,query,selected]);
 const displayed=showAll||selected!=='all'||query.trim()?visibleCategories:visibleCategories.slice(0,INITIAL_RAILS);
 const hasAnyData=categories.length>0;
 return <section className="pci-category-rails container" id="discover" aria-labelledby="pci-category-rails-title">
  <div className="pci-rails-intro">
   <div><span className="pci-overline">DISCOVER</span><h2 id="pci-category-rails-title">Explore by category</h2><p>Find people worth watching. Swipe through each row or search by name.</p></div>
   <label className="pci-rail-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.4"/><path d="m15.5 15.5 5 5"/></svg><span className="sr-only">Search creators</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search creators" autoComplete="off"/></label>
  </div>
  {hasAnyData&&<div className="pci-rail-categories" role="group" aria-label="Browse creator categories"><button type="button" data-active={selected==='all'} aria-pressed={selected==='all'} onClick={()=>{setSelected('all');setShowAll(false);}}>All categories</button>{categories.map(category=><button type="button" key={category.id} data-active={selected===category.slug} aria-pressed={selected===category.slug} onClick={()=>{setSelected(category.slug);setShowAll(true);}}>{category.label}</button>)}</div>}
  {displayed.length>0?<div className="pci-rails-list">{displayed.map(({category,matched})=><CreatorRail key={category.id} category={category} creators={matched}/>)}</div>:<div className="pci-rails-empty">{!hasAnyData?'Categories will appear when creator data is published.':query.trim()?'No creators match that search in the tracked rankings.':'No tracked creators have been assigned to this category yet.'}</div>}
  {selected==='all'&&!query.trim()&&visibleCategories.length>INITIAL_RAILS&&<button className="pci-more-rails" type="button" onClick={()=>setShowAll(v=>!v)} aria-expanded={showAll}>{showAll?'Show fewer categories':`Show all ${visibleCategories.length} categories`} <span aria-hidden="true">{showAll?'↑':'↓'}</span></button>}
 </section>;
}
