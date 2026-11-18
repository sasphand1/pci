 'use client';
import Link from 'next/link';
import {useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {Category} from '@/lib/types';
import type {UnifiedPerson} from '@/components/UnifiedCreatorExperience';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';

const decorations=['◎','◉','◇','✦','★','⌘','✧','◕'];
const palette=['sea','teal','violet','olive','rose','blue','amber','purple'];

function PanelRail({title,summary,children,empty}:{title:string;summary:string;children:ReactNode;empty:boolean}){
 const scroller=useRef<HTMLDivElement>(null);
 const scroll=(dir:-1|1)=>scroller.current?.scrollBy({left:dir*370,behavior:'smooth'});
 return <section className="pci-discovery-rail" aria-label={title}>
  <div className="pci-discovery-rail-head"><div><h3>{title}</h3><p>{summary}</p></div><div className="pci-discovery-controls"><button type="button" aria-label={`Scroll ${title} left`} onClick={()=>scroll(-1)}>‹</button><button type="button" aria-label={`Scroll ${title} right`} onClick={()=>scroll(1)}>›</button></div></div>
  <div className="pci-discovery-scroller" ref={scroller}>{empty?<div className="pci-discovery-empty">No eligible, verified creators in this selection yet. Add or approve individuals in the management panel.</div>:children}</div>
 </section>;
}
/** Platform rails are sourced from the server-side, admin-approved unified registry.
 * Each source ranking is calculated independently from its platform's reported
 * subscriber/follower metric. Client-side category filtering preserves rank order.
 * Up to 20 verified people per row, never 20 fabricated profiles.
 */
export function CreatorDiscoveryRows({categories,youtube,instagram}:{categories:Category[];youtube:UnifiedPerson[];instagram:UnifiedPerson[]}){
 const [selected,setSelected]=useState<string|null>(null);
 const included=(xs:{slug:string}[]|undefined)=>!selected||Boolean(xs?.some(c=>c.slug===selected));
 const yt=youtube.filter(p=>Boolean(p.platforms?.youtube)&&p.subscriberCount!==null&&included(p.categories)).slice(0,20);
 const ig=instagram.filter(p=>Boolean(p.platforms?.instagram)&&p.subscriberCount!==null&&included(p.categories)).slice(0,20);
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
   <div className="pci-discovery-heading pci-discovery-subheading"><div><div className="pci-discovery-overline">CREATOR COLLECTIONS</div><h2>{choice?choice.label:'Discover platform creators'}</h2><p>Top 20 on each platform, ranked by verified subscribers or followers. Swipe horizontally to browse.</p></div>{selected&&<button type="button" className="pci-discovery-clear" onClick={()=>setSelected(null)}>Clear filter ×</button>}</div>
   <PanelRail title="YouTube" summary="Top 20 verified YouTubers · subscribers" empty={!yt.length}>
    {yt.map(p=><Link key={p.id} className="pci-discovery-person" href={`/creators/${encodeURIComponent(p.slug)}`}>
     <div className="pci-discovery-avatar">{safeYoutubeImage(p.thumbnailUrl)?<img loading="lazy" alt="" src={safeYoutubeImage(p.thumbnailUrl)!}/>:<span>{p.displayName.slice(0,1)}</span>}<span className="pci-discovery-chip">YouTube</span></div>
     <div className="pci-discovery-caption"><strong>{p.displayName}</strong><span>{formatCount(p.subscriberCount,true)} YouTube subscribers</span></div>
    </Link>)}
   </PanelRail>
   <PanelRail title="Instagram" summary="Top 20 verified Instagram profiles · followers" empty={!ig.length}>
    {ig.map(p=><Link key={p.id} className="pci-discovery-person" href={`/creators/${encodeURIComponent(p.slug)}`}>
     <div className="pci-discovery-avatar pci-discovery-instagram-avatar">{safeYoutubeImage(p.thumbnailUrl)?<img loading="lazy" alt="" src={safeYoutubeImage(p.thumbnailUrl)!}/>:<span aria-hidden="true">{p.displayName.slice(0,1)}</span>}<span className="pci-discovery-chip">Instagram</span></div>
     <div className="pci-discovery-caption"><strong>{p.displayName}</strong><span>{formatCount(p.subscriberCount,true)} Instagram followers</span></div>
    </Link>)}
   </PanelRail>
   <PanelRail title="TikTok" summary="Reserved for an official future integration" empty={false}><div className="pci-discovery-placeholder"><span aria-hidden="true">♪</span><strong>TikTok creators</strong><p>Coming soon · no invented rankings or statistics</p></div></PanelRail>
   <div className="pci-discovery-future"><div><span className="pci-discovery-future-symbol" aria-hidden="true">◈</span><strong>Restaurants</strong><span>Coming soon</span></div><div><span className="pci-discovery-future-symbol" aria-hidden="true">✧</span><strong>Events</strong><span>Coming soon</span></div></div>
   <p className="pci-discovery-disclaimer">*YouTube and Instagram rows use separate platform-reported follower/subscriber counts. Cross-platform audiences may overlap. Only admin-approved individual human creators with linked YouTube accounts appear. The rows each show a maximum of 20 verified profiles.</p>
  </div>
 </section>;
}
