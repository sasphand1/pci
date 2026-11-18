import type {Metadata} from 'next';
import Link from 'next/link';
import {MetricCard} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {Creator,Overview,Category,SortMetric} from '@/lib/types';
import {formatCount,displayDate} from '@/lib/format.mjs';
import {RankingWheel} from '@/components/RankingWheel';
import {CategoryRails} from '@/components/CategoryRails';
import {HomeLeaderboard} from '@/components/HomeLeaderboard';

export const metadata:Metadata={title:'Discover Pakistani creators'};
const metrics:SortMetric[]=['views','subscribers','videos'];

export default async function Home(){
 const [summary,status,categories,...results]=await Promise.all([
  adapterGet<{data:Overview}>('/api/v1/overview'),
  adapterGet<{data:{publishedAt:string|null}}>('/api/v1/status'),
  adapterGet<{data:Category[]}>('/api/v1/categories'),
  ...metrics.map(metric=>adapterGet<{data:Creator[]}>(`/api/v1/rankings?sort=${metric}&limit=100`))
 ]);
 const rankings=Object.fromEntries(metrics.map((metric,i)=>[metric,results[i]?.data??[]])) as Record<SortMetric,Creator[]>;
 const overview=summary?.data;
 const updatedAt=status?.data.publishedAt??overview?.publishedAt??null;
 const uniqueCreators=[...new Map(metrics.flatMap(metric=>rankings[metric]).map(creator=>[creator.id,creator])).values()];
 return <>
  <div className="pci-cinematic pci-explore-hero">
   <RankingWheel rankings={rankings} asOf={updatedAt}/>
   <CategoryRails categories={categories?.data??[]} creators={uniqueCreators}/>
  </div>
  <div className="pci-home-white">
   <div className="container">
    <section id="top-100" className="pci-leaderboard-section" aria-labelledby="home-leaderboard-title">
     <div className="pci-section-heading"><div><span className="pci-overline">THE LEADERBOARD</span><h2 id="home-leaderboard-title">Top 100 Creators</h2><p>Reported lifetime channel views · ranked among creators monitored by PCI.</p></div><Link href="/rankings?sort=views" className="pci-text-link">Full rankings <span aria-hidden="true">↗</span></Link></div>
     <HomeLeaderboard creators={rankings.views} asOf={updatedAt}/>
     <div className="pci-data-disclosure"><span>Ranking applies only to channels in this directory.</span><span>Last updated: {displayDate(updatedAt)}</span></div>
    </section>
    <section className="pci-home-overview" aria-label="Platform statistics">
     <div className="pci-overline">AT A GLANCE</div>
     <div className="metric-grid"><MetricCard label="Tracked creators" value={String(overview?.creators??'—')}/><MetricCard label="With statistics" value={String(overview?.channelsWithStatistics??'—')}/><MetricCard label="Combined channel views" value={formatCount(overview?.sumChannelViews,true)} note="Sum of reported channel totals"/><MetricCard label="Combined subscribers" value={formatCount(overview?.sumChannelSubscribers,true)} note="Audiences can overlap"/></div>
    </section>
   </div>
  </div>
 </>;
}
