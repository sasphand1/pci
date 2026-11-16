import type {Metadata} from 'next';
import Link from 'next/link';
import {Card,MetricCard} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {Creator,Overview,Category,SortMetric} from '@/lib/types';
import {formatCount,displayDate} from '@/lib/format.mjs';
import {RankingWheel} from '@/components/RankingWheel';
import {HomeLeaderboard} from '@/components/HomeLeaderboard';
import {SnapshotStatus} from '@/components/SnapshotStatus';

export const metadata:Metadata={title:'Discover Pakistani creators'};
const metrics:SortMetric[]=['views','subscribers','videos'];
function categoryVariant(label:string){
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
const glyph:Record<string,string>={vlog:'◉',news:'◈',faith:'✦',entertainment:'★',tech:'⌘',lifestyle:'✧',gaming:'◖',default:'◈'};

export default async function Home(){
 const [summary,status,categories,siteConfig,...results]=await Promise.all([
  adapterGet<{data:Overview}>('/api/v1/overview'),
  adapterGet<{data:{publishedAt:string|null}}>('/api/v1/status'),
  adapterGet<{data:Category[]}>('/api/v1/categories'),
  adapterGet<{data:{homepage_announcement?:string}}>('/api/v1/site-config'),
  ...metrics.map(metric=>adapterGet<{data:Creator[]}>(`/api/v1/rankings?sort=${metric}&limit=100`))
 ]);
 const rankings=Object.fromEntries(metrics.map((m,i)=>[m,results[i]?.data??[]])) as Record<SortMetric,Creator[]>;
 const stats=summary?.data;
 const updatedAt=status?.data.publishedAt??stats?.publishedAt??null;
 return <>
  <div className="pci-cinematic">
   <RankingWheel rankings={rankings} asOf={updatedAt}/>
   <section className="container pci-categories" aria-labelledby="home-categories-title">
    <div className="pci-categories-head"><div><div className="pci-overline">EXPLORE MORE</div><h2 id="home-categories-title">Explore by category</h2><p>Find creators by the content you enjoy.</p></div><Link href="/categories" className="pci-text-link">All categories <span aria-hidden="true">↗</span></Link></div>
    {(categories?.data?.length??0)>0?<div className="pci-category-grid">{categories!.data.map((c)=>{const kind=categoryVariant(c.label);return <Link key={c.id} href={`/categories/${encodeURIComponent(c.slug)}`} className="pci-category-tile" data-kind={kind} aria-label={`Explore ${c.label}`}><span className="pci-category-symbol" aria-hidden="true">{glyph[kind]}</span><strong>{c.label}</strong><span className="pci-category-next" aria-hidden="true">↗</span></Link>;})}</div>:<div className="pci-category-await"><span>Categories will appear when the directory is available.</span><Link href="/categories">Browse categories ↗</Link></div>}
   </section>
  </div>
  <div className="pci-home-white">
   <div className="container">
    <section className="pci-leaderboard-section" aria-labelledby="home-leaderboard-title">
     <div className="pci-section-heading"><div><span className="pci-overline">THE LEADERBOARD</span><h2 id="home-leaderboard-title">Top 100 Creators</h2><p>Ranked by reported lifetime channel views among monitored channels.</p></div><Link href="/rankings?sort=views" className="pci-text-link">View full rankings <span aria-hidden="true">↗</span></Link></div>
     <HomeLeaderboard creators={rankings.views} asOf={updatedAt}/>
     <div className="pci-data-disclosure"><span>Rankings reflect only the creators tracked by this platform.</span><span>Last updated: {displayDate(updatedAt)}</span></div>
    </section>
    <section className="pci-home-overview" aria-labelledby="home-stats-title">
     <div className="pci-section-heading"><div><span className="pci-overline">THE BIG PICTURE</span><h2 id="home-stats-title">The numbers behind the index</h2><p>Public channel statistics for our curated creator directory.</p></div></div>
     <SnapshotStatus publishedAt={updatedAt}/>
     {siteConfig?.data.homepage_announcement&&<Card><strong>Announcement</strong><p className="muted">{siteConfig.data.homepage_announcement}</p></Card>}
     <div className="metric-grid"><MetricCard label="Tracked creators" value={String(stats?.creators??'—')}/><MetricCard label="With statistics" value={String(stats?.channelsWithStatistics??'—')}/><MetricCard label="Combined channel views" value={formatCount(stats?.sumChannelViews,true)} note="Sum of reported channel totals"/><MetricCard label="Combined subscribers" value={formatCount(stats?.sumChannelSubscribers,true)} note="Rounded figures; audiences overlap"/></div>
    </section>
    <section className="pci-home-extras" aria-label="More ways to explore"><Link href="/creators" className="pci-explore-panel"><span className="pci-overline">DISCOVER</span><h2>Every creator has a story.</h2><p>Browse profiles, video activity, and public channel statistics.</p><strong>Explore creator profiles ↗</strong></Link><Link href="/wall" className="pci-explore-panel pci-explore-panel-alt"><span className="pci-overline">COMMUNITY</span><h2>Join the conversation.</h2><p>One shared Pakistan Creator Index discussion wall.</p><strong>Open live wall ↗</strong></Link></section>
   </div>
  </div>
 </>;
}
