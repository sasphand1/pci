import Link from 'next/link';
import {Card} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import {pubGet,WHEEL_SCOPES,type PubCategory,type PubRanking,type PubRows,type PubStatus} from '@/lib/public';
import {PublishedWheel} from '@/components/PublishedWheel';
import {PublishedRows} from '@/components/PublishedRows';
import {PublishedTop100} from '@/components/PublishedTop100';
import {SnapshotStatus} from '@/components/SnapshotStatus';

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
 return <>
  <div className="pci-cinematic pci-explore-hero">
   <PublishedWheel sorts={wheel?.sorts??[]}/>
   {siteConfig?.data.homepage_announcement&&<div className="container"><section className="section"><Card><strong>Announcement</strong><p className="muted">{siteConfig.data.homepage_announcement}</p></Card></section></div>}
   <div id="discover"><PublishedRows platforms={rows?.platforms??[]} categories={rows?.categories??[]}/></div>
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
