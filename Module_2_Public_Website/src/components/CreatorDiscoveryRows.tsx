 'use client';
import Link from 'next/link';
import {useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {Category,Creator} from '@/lib/types';
import type {UnifiedPerson} from '@/components/UnifiedCreatorExperience';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';

const decorations=['◎','◉','◇','✦','★','⌘','✧','◕'];
const palette=['sea','teal','violet','olive','rose','blue','amber','purple'];

function PanelRail({title,summary,children,empty,startAtEnd=false}:{title:string;summary:string;children:ReactNode;empty:boolean;startAtEnd?:boolean}){
 const scroller=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(startAtEnd&&scroller.current)scroller.current.scrollLeft=scroller.current.scrollWidth;},[startAtEnd,children]);
 const scroll=(dir:-1|1)=>scroller.current?.scrollBy({left:dir*370,behavior:'smooth'});
 return <section className="pci-discovery-rail" aria-label={title}>
  <div className="pci-discovery-rail-head"><div><h3>{title}</h3><p>{summary}</p></div><div className="pci-discovery-controls"><button type="button" aria-label={`Scroll ${title} left`} onClick={()=>scroll(-1)}>‹</button><button type="button" aria-label={`Scroll ${title} right`} onClick={()=>scroll(1)}>›</button></div></div>
  <div className="pci-discovery-scroller" ref={scroller}>{empty?<div className="pci-discovery-empty">No eligible, verified creators in this selection yet. Add or approve individuals in the management panel.</div>:children}</div>
 </section>;
}
/** Platform rails are sourced from the server-side, admin-approved unified registry.
 * The YouTube row uses raw subscriber rankings from the curated YouTube API.
 * Instagram remains sourced from the human-approved unified API.
 * No fabricated channel statistics are introduced.
 */
export function CreatorDiscoveryRows({categories,youtube,instagram,curatedYoutube}:{categories:Category[];youtube:UnifiedPerson[];instagram:UnifiedPerson[];curatedYoutube:Creator[]}){
 const [selected,setSelected]=useState<string|null>(null);
 const included=(xs:{slug:string}[]|undefined)=>!selected||Boolean(xs?.some(c=>c.slug===selected));
 // Use real, enabled YouTube channel snapshots for the editorial YouTube row.
 // Unified approval continues to govern the cross-platform ranking wheel and Top 100.
 const ytSorted=curatedYoutube.filter(p=>p.subscriberCount!==null&&!p.subscriberHidden&&included(p.categories));
 let ytRank=0,ytLast:string|null=null;
 const yt=ytSorted.map(p=>{if(ytLast!==p.subscriberCount){ytRank++;ytLast=p.subscriberCount;}return {...p,rank:ytRank};}).slice(0,15).reverse();
 const igSorted=instagram.filter(p=>Boolean(p.platforms?.instagram)&&p.subscriberCount!==null&&included(p.categories));
 let igRank=0,igLast:string|null=null;
 const ig=igSorted.map(p=>{if(igLast!==p.subscriberCount){igRank++;igLast=p.subscriberCount;}return {...p,rank:igRank};}).slice(0,15).reverse();
 const choice=categories.find(c=>c.slug===selected);
 return <section className="pci-discovery" aria-label="Explore creators and topics">
  <div className="pci-discovery-inner">
   <div className="pci-discovery-overline">EXPLORE MORE</div>
   <div className="pci-discovery-heading"><div><h2>Explore by category</h2><p>Find individual creators by the content you enjoy, across supported social platforms.</p></div><Link href="/categories">All categories →</Link></div>
   <div className="pci-discovery-categories" aria-label="Filter creator rows by category">
    {categories.map((c,i)=><button type="button" key={c.slug} className={`pci-category-tile pci-category-${palette[i%palette.length]}`} data-selected={selected===c.slug} aria-pressed={selected===c.slug} onClick={()=>setSelected(v=>v===c.slug?null:c.slug)}>
     <span className="pci-category-symbol" aria-hidden="true">{decorations[i%decorations.length]}</span><span className="pci-category-name">{c.label}</span><span className="pci-category-arrow" aria-hidden="true">↗</span>
    </button>)}
   </div>
   <div className="pci-discovery-heading pci-discovery-subheading"><div><div className="pci-discovery-overline">CREATOR COLLECTIONS</div><h2>{choice?choice.label:'Discover platform creators'}</h2><p>YouTube: top tracked channels by subscriber count, from #20 to #1. Instagram: approved individuals. Swipe horizontally to browse.</p></div>{selected&&<button type="button" className="pci-discovery-clear" onClick={()=>setSelected(null)}>Clear filter ×</button>}</div>
   <PanelRail title="YouTube" summary="Top 15 tracked YouTube channels · subscribers · #15 to #1" empty={!yt.length} startAtEnd>
    {yt.map(p=><Link key={p.id} className="pci-discovery-person" href={`/creators/${encodeURIComponent(p.slug)}`}>
     <div className="pci-discovery-avatar">{safeYoutubeImage(p.thumbnailUrl)?<img loading="lazy" alt="" src={safeYoutubeImage(p.thumbnailUrl)!}/>:<span>{p.displayName.slice(0,1)}</span>}<span className="pci-discovery-chip">YouTube</span><span className="pci-discovery-rank" aria-label={`Rank ${p.rank??"unranked"}`}>#{p.rank??"—"}</span></div>
     <div className="pci-discovery-caption"><strong>{p.displayName}</strong><span>{formatCount(p.subscriberCount,true)} subscribers</span></div>
    </Link>)}
   </PanelRail>
   <PanelRail title="Instagram" summary="Top 15 verified Instagram profiles · followers" empty={!ig.length}>
    {ig.map(p=><Link key={p.id} className="pci-discovery-person" href={`/creators/${encodeURIComponent(p.slug)}`}>
     <div className="pci-discovery-avatar pci-discovery-instagram-avatar">{safeYoutubeImage(p.thumbnailUrl)?<img loading="lazy" alt="" src={safeYoutubeImage(p.thumbnailUrl)!}/>:<span aria-hidden="true">{p.displayName.slice(0,1)}</span>}<span className="pci-discovery-chip">Instagram</span><span className="pci-discovery-rank" aria-label={`Rank ${p.rank??'unranked'}`}>#{p.rank??'—'}</span></div>
     <div className="pci-discovery-caption"><strong>{p.displayName}</strong><span>{formatCount(p.subscriberCount,true)} Instagram followers</span></div>
    </Link>)}
   </PanelRail>
   <PanelRail title="TikTok" summary="Reserved for an official future integration" empty={false}><div className="pci-discovery-placeholder"><span aria-hidden="true">♪</span><strong>TikTok creators</strong><p>Coming soon · no invented rankings or statistics</p></div></PanelRail>
   <div className="pci-discovery-future"><div><span className="pci-discovery-future-symbol" aria-hidden="true">◈</span><strong>Restaurants</strong><span>Coming soon</span></div><div><span className="pci-discovery-future-symbol" aria-hidden="true">✧</span><strong>Events</strong><span>Coming soon</span></div></div>
   <p className="pci-discovery-disclaimer">*YouTube and Instagram rows use separate platform-reported follower/subscriber counts. Cross-platform audiences may overlap. The YouTube row lists enabled, curated channels with reported subscriber counts; unified rankings and Instagram continue to require human approval. Each row displays up to 15 ranked profiles with available source statistics.</p>
  </div>
 </section>;
}
