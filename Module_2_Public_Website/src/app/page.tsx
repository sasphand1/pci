import Link from 'next/link';
import {Card} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {Category,Creator,SortMetric} from '@/lib/types';
import {RankingWheel} from '@/components/RankingWheel';
import {CreatorTable} from '@/components/CreatorParts';
import {UnifiedRankingWheel,UnifiedTop100,UnifiedOverview,type UnifiedPerson,type UnifiedRankingResponse,type UnifiedOverviewResponse} from '@/components/UnifiedCreatorExperience';
import {SnapshotStatus} from '@/components/SnapshotStatus';
import {CreatorDiscoveryRows} from '@/components/CreatorDiscoveryRows';

type Metric='views'|'subscribers'|'videos';
const metrics:Metric[]=['views','subscribers','videos'];

/** Retain the existing Module 1 unified APIs and human-approval ranking rules.
 * This page changes presentation only; no hardcoded creators or fake metrics. */
export default async function Home(){
 const [rankingResponses,overviewResponses,status,categories,siteConfig,platformYoutube,platformInstagram,curatedYoutube,allRounders]=await Promise.all([
  Promise.all(metrics.map(metric=>adapterGet<UnifiedRankingResponse>(`/api/v1/unified/rankings?metric=${metric}&platform=all&limit=100`))),
  Promise.all((['all','youtube','instagram'] as const).map(platform=>adapterGet<UnifiedOverviewResponse>(`/api/v1/unified/overview?platform=${platform}`))),
  adapterGet<{data:{publishedAt:string|null}}>('/api/v1/status'),
  adapterGet<{data:Category[]}>('/api/v1/categories'),
  adapterGet<{data:{homepage_announcement?:string}}>('/api/v1/site-config'),
  adapterGet<UnifiedRankingResponse>('/api/v1/unified/rankings?metric=subscribers&platform=youtube&limit=100'),
  adapterGet<UnifiedRankingResponse>('/api/v1/unified/rankings?metric=subscribers&platform=instagram&limit=100'),
  adapterGet<{data:Creator[]}>('/api/v1/rankings?sort=subscribers&limit=100'),
  adapterGet<UnifiedRankingResponse>('/api/v1/unified/all-rounders?limit=20')
 ]);
 const [rankViews,rankSubscribers,rankVideos]=rankingResponses;
 const [overviewAll,overviewYoutube,overviewInstagram]=overviewResponses;
 const fallback=rankingResponses.every(x=>x===null)||rankingResponses.every(x=>!x?.data?.length);
 const legacyResponses=fallback?await Promise.all((['views','subscribers','videos'] as SortMetric[]).map(metric=>adapterGet<{data:Creator[]}>(`/api/v1/rankings?sort=${metric}&limit=100`))):[];
 const legacy=Object.fromEntries((['views','subscribers','videos'] as SortMetric[]).map((m,i)=>[m,legacyResponses[i]?.data??[]])) as Record<SortMetric,Creator[]>;
 const rankings:Record<Metric,UnifiedPerson[]>={views:rankViews?.data??[],subscribers:rankSubscribers?.data??[],videos:rankVideos?.data??[]};
 const overviews={all:overviewAll,youtube:overviewYoutube,instagram:overviewInstagram};
 return <>
  <div className="pci-cinematic pci-explore-hero">
   {fallback?<RankingWheel rankings={legacy} asOf={status?.data.publishedAt??null}/>:<UnifiedRankingWheel rankings={rankings} allRounders={allRounders?.data??[]}/>}
   {siteConfig?.data.homepage_announcement&&<div className="container"><section className="section"><Card><strong>Announcement</strong><p className="muted">{siteConfig.data.homepage_announcement}</p></Card></section></div>}
   <div id="discover"><CreatorDiscoveryRows categories={categories?.data??[]} youtube={platformYoutube?.data??[]} instagram={platformInstagram?.data??[]} curatedYoutube={curatedYoutube?.data??[]}/></div>
  </div>
  <div className="pci-home-white">
   <div className="container">
    <section id="top-100" className="pci-leaderboard-section" aria-label="Top 100 creators">
     {fallback?<section className="section pci-unified-top"><div className="pci-section-heading"><div><span className="pci-overline">THE LEADERBOARD</span><h2>Top 100 Creators</h2><p>Existing monitored YouTube statistics while human review is pending.</p></div><Link href="/rankings" className="pci-text-link">Full rankings</Link></div><CreatorTable creators={legacy.subscribers.filter(c=>c.rank!==null).slice(0,100)}/></section>:<UnifiedTop100 rankings={rankings}/>}
    </section>
    <SnapshotStatus publishedAt={status?.data.publishedAt}/>
    <div className="pci-home-overview"><span className="pci-overline">AT A GLANCE</span><UnifiedOverview overviews={overviews}/></div>
    <section className="section pci-home-extras"><Card><div className="eyebrow">Discover</div><h2>Creator profiles</h2><p className="muted">Explore verified profiles, their linked social accounts and videos.</p><Link href="/creators" className="btn btn-secondary">Creator directory</Link></Card><Card><div className="eyebrow">Community</div><h2>Pakistan Live Wall</h2><p className="muted">Join the community discussion. Posts are not YouTube comments.</p><Link href="/wall" className="btn btn-primary">Open live wall</Link></Card></section>
   </div>
  </div>
 </>;
}
