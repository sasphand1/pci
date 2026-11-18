import Link from 'next/link';
import {Card} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {Category,Creator,SortMetric} from '@/lib/types';
import {RankingWheel} from '@/components/RankingWheel';
import {CreatorTable} from '@/components/CreatorParts';
import {UnifiedRankingWheel,UnifiedTop100,UnifiedOverview,type UnifiedPerson,type UnifiedRankingResponse,type UnifiedOverviewResponse} from '@/components/UnifiedCreatorExperience';
import {SnapshotStatus} from '@/components/SnapshotStatus';

type Metric='views'|'subscribers'|'videos';
const metrics:Metric[]=['views','subscribers','videos'];
export default async function Home(){
 const [rankingResponses,overviewResponses,status,categories,siteConfig]=await Promise.all([
  Promise.all(metrics.map(metric=>adapterGet<UnifiedRankingResponse>(`/api/v1/unified/rankings?metric=${metric}&platform=all&limit=100`))),
  Promise.all((['all','youtube','instagram'] as const).map(platform=>adapterGet<UnifiedOverviewResponse>(`/api/v1/unified/overview?platform=${platform}`))),
  adapterGet<{data:{publishedAt:string|null}}>('/api/v1/status'),
  adapterGet<{data:Category[]}>('/api/v1/categories'),
  adapterGet<{data:{homepage_announcement?:string}}>('/api/v1/site-config')]);
 const [rankViews,rankSubscribers,rankVideos]=rankingResponses;
 const [overviewAll,overviewYoutube,overviewInstagram]=overviewResponses;
 const fallback=rankingResponses.every(x=>x===null)||rankingResponses.every(x=>!x?.data?.length);
 const legacyResponses=fallback?await Promise.all((['views','subscribers','videos'] as SortMetric[]).map(metric=>adapterGet<{data:Creator[]}>(`/api/v1/rankings?sort=${metric}&limit=100`))):[];
 const legacy=Object.fromEntries((['views','subscribers','videos'] as SortMetric[]).map((m,i)=>[m,legacyResponses[i]?.data??[]])) as Record<SortMetric,Creator[]>;
 const rankings:Record<Metric,UnifiedPerson[]>={views:rankViews?.data??[],subscribers:rankSubscribers?.data??[],videos:rankVideos?.data??[]};
 const overviews={all:overviewAll,youtube:overviewYoutube,instagram:overviewInstagram};
 return <>
  {fallback?<RankingWheel rankings={legacy} asOf={status?.data.publishedAt??null}/>:<UnifiedRankingWheel rankings={rankings}/>}
  <div className="container">
   {siteConfig?.data.homepage_announcement&&<section className="section"><Card><strong>Announcement</strong><p className="muted">{siteConfig.data.homepage_announcement}</p></Card></section>}
   <section className="section"><h2>Explore by Category</h2><p className="muted">People, not company channels. One editorial category follows each creator across YouTube and Instagram.</p>
    <div className="grid-4">{(categories?.data??[]).map(c=><Link className="category-link" href={`/categories/${encodeURIComponent(c.slug)}`} key={c.id}>{c.label} →</Link>)}</div>
   </section>
   {fallback?<section className="section"><h2>Top 100 Creators</h2><p className="muted">Showing existing YouTube statistics while the unified human-creator registry awaits verification and its first published metrics.</p><CreatorTable creators={legacy.subscribers.slice(0,100)}/></section>:<UnifiedTop100 rankings={rankings}/>}
   <SnapshotStatus publishedAt={status?.data.publishedAt}/>
   <UnifiedOverview overviews={overviews}/>
   <section className="section"><div className="split"><Card><div className="eyebrow">Browse</div><h2>All creator profiles</h2><p className="muted">Browse verified individuals, their linked social accounts and latest videos.</p><p><Link href="/creators" className="btn btn-secondary">Creator directory</Link></p></Card><Card><div className="eyebrow">Community</div><h2>Pakistan Live Wall</h2><p className="muted">Join the nationwide discussion. Wall posts are not YouTube comments.</p><p><Link href="/wall" className="btn btn-primary">Open the wall</Link></p></Card></div></section>
  </div>
 </>;
}
