import {adapterGet} from '@/lib/api';
import {pubGet,pubLocal,WHEEL_SCOPES,type PubCategory,type PubRanking,type PubRows,type PubStatus} from '@/lib/public';
import {publishedRankedTotal} from '@/lib/creator-totals';
import {normalizePublicEvents} from '@/lib/event-table.mjs';
import {PublishedTop100} from '@/components/PublishedTop100';
import {SnapshotStatus} from '@/components/SnapshotStatus';
import {FifiPage} from '@/fifi/FifiPage';
import {HomePage} from '@/fifi/pages/home';
import {eventRowToItem,rankingToCreators} from '@/fifi/lib/real';

/** Everything real on this page comes from rankings that were published. Nothing is calculated here. */
export default async function Home(){
 const [rows,status,categories,events,localRes,...topFull]=await Promise.all([
  pubGet<PubRows>('/rows'),
  pubGet<PubStatus>('/status'),
  pubGet<PubCategory[]>('/categories'),
  adapterGet<{data:unknown}>('/api/v1/public/events'),
  pubLocal(),
  ...WHEEL_SCOPES.map(scope=>pubGet<PubRanking>(`/rankings/${scope}?limit=100`)),
 ]);
 const initial=Object.fromEntries(WHEEL_SCOPES.map((scope,i)=>[scope,topFull[i]??null]));
 const fullRankings=topFull.filter((r):r is PubRanking=>r!==null);
 const eventRows=events&&Array.isArray(events.data)?normalizePublicEvents(events.data):null;
 const reach=publishedRankedTotal(fullRankings,'wheel.subscribed');
 const categoryRows=(rows?.categories??[]).filter(r=>r.entries.length>0).slice(0,6).map(r=>({slug:r.scope.replace('category.',''),label:r.label,creators:rankingToCreators(r,4)}));
 return <>
  <FifiPage><HomePage
   creators={rankingToCreators(fullRankings.find(r=>r.scope==='wheel.subscribed'),8)}
   events={(eventRows??[]).slice(0,4).map((e,i)=>eventRowToItem(e,i))}
   categoryRows={categoryRows}
   reach={reach==='N/A'?null:reach}
   eventsCount={eventRows?eventRows.length:null}
   local={localRes?.data??[]}/></FifiPage>
  <FifiPage><div className="site-container space-y-3 pb-10 pt-4">
   <section id="top-100" aria-label="Top 100 creators"><PublishedTop100 initial={initial} categories={(categories??[]).filter(c=>c.hasRanking).map(c=>({slug:c.slug,label:c.label}))}/></section>
   <SnapshotStatus publishedAt={status?.publishedAt}/>
  </div></FifiPage>
 </>;
}
