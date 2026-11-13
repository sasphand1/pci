import Link from 'next/link';
import {Card,MetricCard,SectionHeading} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {Creator,Overview,Category,SortMetric} from '@/lib/types';
import {formatCount} from '@/lib/format.mjs';
import {RankingWheel} from '@/components/RankingWheel';
import {SnapshotStatus} from '@/components/SnapshotStatus';

const metrics:SortMetric[]=['views','subscribers','videos'];
export default async function Home(){
 const [summary,status,categories,siteConfig,...results]=await Promise.all([
  adapterGet<{data:Overview}>('/api/v1/overview'),
  adapterGet<{data:{publishedAt:string|null}}>('/api/v1/status'),
  adapterGet<{data:Category[]}>('/api/v1/categories'),
  adapterGet<{data:{homepage_announcement?:string}}>('/api/v1/site-config'),
  ...metrics.map(metric=>adapterGet<{data:Creator[]}>(`/api/v1/rankings?sort=${metric}&limit=100`))
 ]);
 const rankings=Object.fromEntries(metrics.map((metric,i)=>[metric,results[i]?.data??[]])) as Record<SortMetric,Creator[]>;
 const stats=summary?.data;
 return <>
  <RankingWheel rankings={rankings} asOf={status?.data.publishedAt??stats?.publishedAt??null}/>
  <div className="container">
   <section className="section"><SnapshotStatus publishedAt={status?.data.publishedAt??stats?.publishedAt}/>
    {siteConfig?.data.homepage_announcement&&<div className="section"><Card><strong>Announcement</strong><p className="muted">{siteConfig.data.homepage_announcement}</p></Card></div>}
    <SectionHeading title="The numbers behind the index" description="Reported public statistics for the currently monitored creators. Figures do not represent unique viewers or a proprietary influence score."/>
    <div className="metric-grid"><MetricCard label="Tracked creators" value={String(stats?.creators??'—')}/><MetricCard label="With statistics" value={String(stats?.channelsWithStatistics??'—')}/><MetricCard label="Sum of channel views" value={formatCount(stats?.sumChannelViews,true)} note="Sum of reported channel totals"/><MetricCard label="Sum of subscriber counts" value={formatCount(stats?.sumChannelSubscribers,true)} note="Rounded counts; audiences may overlap"/></div>
   </section>
   <section className="section"><SectionHeading title="Explore by topic" description="Editorial navigation within the tracked collection."/>
    <div className="grid-4">{(categories?.data||[]).map(c=><Link className="category-link" href={`/categories/${encodeURIComponent(c.slug)}`} key={c.id}>{c.label} →</Link>)}</div>
   </section>
   <section className="section"><div className="split"><Card><div className="eyebrow">Browse</div><h2>All creator profiles</h2><p className="muted">Open creator profiles, compare reported statistics and browse the latest tracked videos.</p><p><Link href="/creators" className="btn btn-secondary">Creator directory</Link></p></Card><Card><div className="eyebrow">Community</div><h2>Pakistan Live Wall</h2><p className="muted">One shared conversation for guests and registered users; these are not YouTube comments.</p><p><Link href="/wall" className="btn btn-primary">Open the wall</Link></p></Card></div></section>
  </div>
 </>;
}
