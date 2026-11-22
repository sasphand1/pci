import Link from 'next/link';
import {Card} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import {pubGet,WHEEL_SCOPES,type PubCategory,type PubRanking,type PubRows,type PubStatus} from '@/lib/public';
import {PublishedWheel} from '@/components/PublishedWheel';
import {PublishedRows} from '@/components/PublishedRows';
import {PublishedTop100} from '@/components/PublishedTop100';
import {displayDate} from '@/lib/format.mjs';
import {SnapshotStatus} from '@/components/SnapshotStatus';
import {publishedTotal} from '@/lib/creator-totals';

/** Everything on this page comes from rankings that were published. Nothing is calculated here. */
export default async function Home(){
 const [wheel,rows,status,categories,siteConfig,...top]=await Promise.all([
  pubGet<{sorts:PubRanking[]}>('/wheel'),
  pubGet<PubRows>('/rows'),
  pubGet<PubStatus>('/status'),
  pubGet<PubCategory[]>('/categories'),
  adapterGet<{data:{homepage_announcement?:string}}>('/api/v1/site-config'),
  ...WHEEL_SCOPES.map(scope=>pubGet<PubRanking>(`/rankings/${scope}?limit=100`))
 ]);
 const initial=Object.fromEntries(WHEEL_SCOPES.map((scope,i)=>[scope,top[i]??null]));
 // /wheel is capped at 12 display cards. Use the already-fetched full rankings
 // for aggregates so the completeness check covers all published creators.
 const fullRankings=top.filter((r):r is PubRanking=>r!==null);
 const rank=(scope:string)=>rows?.platforms.find(r=>r.scope===scope)?.population;
 const stats=[
  {label:'Tracked creators',value:status?.people == null ? 'N/A' : String(status.people)},
  {label:'YouTube creators',value:rank('youtube.subscribed') == null ? 'N/A' : String(rank('youtube.subscribed'))},
  {label:'Instagram creators',value:rank('instagram.followers') == null ? 'N/A' : String(rank('instagram.followers'))},
  {label:'Total subscribers',value:publishedTotal(fullRankings,'wheel.subscribed')},
  {label:'Total views',value:publishedTotal(fullRankings,'wheel.viewed')}
 ];
 return <>
  <div className="pci-cinematic pci-explore-hero">
   <PublishedWheel sorts={wheel?.sorts??[]} stats={stats}/>
   {siteConfig?.data.homepage_announcement&&<div className="container"><section className="section"><Card><strong>Announcement</strong><p className="muted">{siteConfig.data.homepage_announcement}</p></Card></section></div>}
   <div id="discover" className="container"><PublishedRows platforms={rows?.platforms??[]} categories={rows?.categories??[]}/></div>
  </div>
  <div className="pci-home-white">
   <div className="container">
    <section id="top-100" className="pci-leaderboard-section" aria-label="Top 100 creators">
     <PublishedTop100 initial={initial} categories={(categories??[]).filter(c=>c.hasRanking).map(c=>({slug:c.slug,label:c.label}))}/>
    </section>
    <SnapshotStatus publishedAt={status?.publishedAt}/>
    <section className="section pci-home-extras"><Card><div className="eyebrow">Discover</div><h2>Creator profiles</h2><p className="muted">Explore profiles, linked accounts and where each person ranks.</p><Link href="/creators" className="btn btn-secondary">Creator directory</Link></Card><Card><div className="eyebrow">Community</div><h2>Pakistan Live Wall</h2><p className="muted">Join the community discussion. Posts are not YouTube comments.</p><Link href="/wall" className="btn btn-primary">Open live wall</Link></Card></section>
   </div>
  </div>
 </>;
}
