'use client';
import Link from 'next/link';
import {useRef} from 'react';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';
import type {PubRanking} from '@/lib/public';

function Rail({ranking,href}:{ranking:PubRanking;href?:string}){
 const scroller=useRef<HTMLDivElement>(null);
 const scroll=(dir:-1|1)=>scroller.current?.scrollBy({left:dir*370,behavior:'smooth'});
 return <section className="pci-discovery-rail" aria-label={ranking.label}>
  <div className="pci-discovery-rail-head"><div><h3>{ranking.label}</h3><p>Top {ranking.entries.length} by {ranking.unit}</p></div><div className="pci-discovery-controls"><button type="button" aria-label={`Scroll ${ranking.label} left`} onClick={()=>scroll(-1)}>‹</button><button type="button" aria-label={`Scroll ${ranking.label} right`} onClick={()=>scroll(1)}>›</button></div></div>
  <div className="pci-discovery-scroller" ref={scroller}>{ranking.entries.length?ranking.entries.map(e=><Link key={e.person.slug} className="pci-platform-tile" href={`/creators/${encodeURIComponent(e.person.slug)}`}>
   <span className="pci-platform-number">{e.tied?'=':''}#{e.rank}</span>
   {safeYoutubeImage(e.person.avatarUrl)?<img src={safeYoutubeImage(e.person.avatarUrl)!} alt="" loading="lazy"/>:<span className="pci-platform-placeholder">{e.person.displayName.slice(0,1)}</span>}
   <strong>{e.person.displayName}</strong><small>{formatCount(e.value,true)} {ranking.unit}</small></Link>):<div className="pci-discovery-empty">Nobody is ranked here yet.</div>}
  </div>
  {href&&<p className="fineprint"><Link href={href}>View all →</Link></p>}
 </section>;
}

/** One row per platform and per category with a published ranking. */
export function PublishedRows({platforms,categories}:{platforms:PubRanking[];categories:PubRanking[]}){
 return <section className="section pci-platform-rows" aria-label="Platform and category rankings">
  <div className="pci-platform-heading"><h2>Discover creators</h2><p>Platform leaders and every category, each ranked separately from officially reported counts.</p></div>
  {platforms.map(r=><Rail key={r.scope} ranking={r}/>)}
  {categories.map(r=><Rail key={r.scope} ranking={r} href={`/categories/${encodeURIComponent(r.scope.slice(9))}`}/>)}
 </section>;
}
