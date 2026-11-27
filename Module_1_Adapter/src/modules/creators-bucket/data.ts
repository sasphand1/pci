import {query} from '../../lib/db.js';
import {missingPublicCounts} from './public-count.js';
import {fixedVideoCohort} from './cohort.mjs';
import {profileAnalytics,safeChannelBanner,channelGrowth,observedPortfolio,pktPublishedCount} from './profile-analytics.mjs';
import {videoMilestones,velocityPerHour,breakoutFactor} from '../creator-analytics/engine.js';
import {series,daily,gain,average,engagement,likeRate,periodRates,DAY,type Point} from './logic.mjs';

type Account={id:string;handle:string;external_id:string};
type Observation={accountId:string;metric:string;value:string;at:string|Date};
type Content={videoId:string;title:string|null;publishedAt:Date|string|null;thumbnailUrl:string|null;observedAt:Date|string};
type CatalogueRow={accountId:string;videoId:string;title:string;publishedAt:Date|string|null;observedAt:Date|string;views:string|null;likes:string|null;comments:string|null};
type ScanRow={accountId:string;completedAt:Date|string|null;scanStartedAt:Date|string|null;lastError:string|null};
type VideoObservation={videoId:string;metric:string;value:string;at:string|Date};
const iso=(v:Date|string)=>new Date(v).toISOString();
const fresh=(p:Point|undefined,now:number,days=7)=>p&&now-Date.parse(p.at)<=days*DAY?p:null;
/** Creators Bucket: a read-only, YouTube-only analytical projection of PCI Hub data.
 * Does not change rankings, extend retention, or invent observations. Missing official video counts may use the quota-limited provider fallback. */
export async function creatorsBucket(personId:string,now=new Date()){
 const n=now.getTime(),stamp=now.toISOString();
 const accounts=(await query<Account>(`SELECT id,handle,external_id FROM accounts WHERE person_id=$1 AND platform='youtube' ORDER BY id`,[personId])).rows;
 if(!accounts.length)return null;
 const ids=accounts.map(a=>a.id);
 // Up to two 90-day periods, only if retained by the Hub's existing policy.
 const channel=(await query<Observation>(`SELECT account_id AS "accountId",metric,value::text AS value,observed_at AS at FROM hub_account_metrics
 WHERE account_id=ANY($1::uuid[]) AND metric IN ('followers','views','posts_30d') AND observed_at BETWEEN $2::timestamptz-interval '183 days' AND $2::timestamptz
 UNION ALL SELECT account_id,metric,value_numeric::text,observed_at FROM ingest_observations WHERE account_id=ANY($1::uuid[]) AND entity_kind='account' AND metric='video_count' AND source_id='youtube.api' AND accuracy='exact' AND value_scale=0 AND value_numeric IS NOT NULL AND observed_at BETWEEN $2::timestamptz-interval '183 days' AND $2::timestamptz
 UNION ALL SELECT a.id,'video_count',s.video_count::text,s.fetched_at FROM channel_stats_latest s JOIN creators c ON c.id=s.creator_id JOIN accounts a ON a.platform='youtube' AND a.external_id=c.channel_id
 WHERE a.id=ANY($1::uuid[]) AND s.video_count IS NOT NULL AND s.fetched_at BETWEEN $2::timestamptz-interval '7 days' AND $2::timestamptz ORDER BY at`,[ids,stamp])).rows;
 const points=(id:string,metric:string)=>series(channel.filter(r=>r.accountId===id&&r.metric===metric).map(r=>({at:iso(r.at),value:r.value})),n);
 const snapshots=accounts.map(a=>({...a,subscribers:points(a.id,'followers'),views:points(a.id,'views'),posts:points(a.id,'posts_30d'),totalVideos:points(a.id,'video_count')}));
 // Only genuinely missing or stale official counts qualify for the bounded fallback.
 const missing=accounts.filter((a,i)=>!fresh(snapshots[i].totalVideos.at(-1),n));
 const official=await missingPublicCounts(missing);
 for(const a of snapshots){const reading=official.get(a.id);if(reading)a.totalVideos.push(reading);}
 const primary=snapshots[0];
 // Official cover belongs to the primary YouTube account; no live request on a profile read.
 const banner=(await query<{value_text:string|null}>(`SELECT value_text FROM ingest_latest WHERE entity_kind='account' AND entity_id=$1 AND metric='channel_banner_url' AND source_id='youtube.api' AND accuracy='exact' AND observed_at BETWEEN $2::timestamptz-interval '7 days' AND $2::timestamptz`,['youtube:'+primary.external_id,stamp])).rows[0];
 const bannerUrl=safeChannelBanner(banner?.value_text);
 const views=daily(primary.views,n),subscribers=daily(primary.subscribers,n);
 const accountStats=snapshots.map(a=>({handle:a.handle,subscribers:fresh(a.subscribers.at(-1),n),views:fresh(a.views.at(-1),n),posts30d:fresh(a.posts.at(-1),n),totalVideos:fresh(a.totalVideos.at(-1),n)}));
 const growth=(p:Point[],decrease=false)=>({'24h':gain(p,1,n,decrease),'7d':gain(p,7,n,decrease),'30d':gain(p,30,n,decrease)});
 const sumMetric=(m:'subscribers'|'views'|'posts'|'totalVideos')=>{const readings=snapshots.map(a=>fresh(a[m].at(-1),n));if(readings.some(x=>x===null))return null;const total=readings.reduce((s,x)=>s+x!.value,0);return Number.isSafeInteger(total)?total:null;};
 const [contentResult,rankResult]=await Promise.all([
  query<Content>(`SELECT content_id AS "videoId",title,published_at AS "publishedAt",thumbnail_url AS "thumbnailUrl",last_observed_at AS "observedAt" FROM ingest_content WHERE platform='youtube' AND account_id=ANY($1::uuid[]) AND last_observed_at BETWEEN $2::timestamptz-interval '7 days' AND $2::timestamptz AND (published_at IS NULL OR published_at<=$2::timestamptz) ORDER BY published_at DESC NULLS LAST,content_id LIMIT 50`,[ids,stamp]),
  query<{at:Date|string;value:number}>(`SELECT published_at AS at,rank AS value FROM rank_history WHERE person_id=$1 AND scope='youtube.subscribed' AND published_at BETWEEN $2::timestamptz-interval '93 days' AND $2::timestamptz ORDER BY published_at`,[personId,stamp])
 ]);
 const content=contentResult.rows;
 const ranks=series(rankResult.rows.map(r=>({at:iso(r.at),value:r.value})),n);
 const readings=content.length?(await query<VideoObservation>(`SELECT substring(entity_id from 9) AS "videoId",metric,value_numeric::text AS value,observed_at AS at FROM ingest_observations WHERE entity_kind='content' AND source_id='youtube.api' AND account_id=ANY($1::uuid[]) AND entity_id=ANY($2::text[]) AND metric IN ('views','likes','comments') AND accuracy='exact' AND value_scale=0 AND value_numeric IS NOT NULL AND observed_at BETWEEN $3::timestamptz-interval '93 days' AND $3::timestamptz ORDER BY observed_at,id`,[ids,content.map(v=>'youtube:'+v.videoId),stamp])).rows:[];
 const grouped=new Map<string,VideoObservation[]>();for(const r of readings){const a=grouped.get(r.videoId)??[];a.push(r);grouped.set(r.videoId,a);}
 const videos=content.map(v=>{
  const p=(metric:string)=>series((grouped.get(v.videoId)??[]).filter(r=>r.metric===metric).map(r=>({at:iso(r.at),value:r.value})),n);
  const publishedAt=v.publishedAt?iso(v.publishedAt):null;
  const viewHistory=p('views').filter(x=>!publishedAt||Date.parse(x.at)>=Date.parse(publishedAt));
  const cv=fresh(viewHistory.at(-1),n),likes=fresh(p('likes').at(-1),n),comments=fresh(p('comments').at(-1),n);
  const milestones=publishedAt?videoMilestones(viewHistory,publishedAt):{'24h':null,'7d':null,'30d':null};
  const milestoneAt=(days:number,value:number|null,tolerance:number)=>{if(!publishedAt||value===null)return null;const target=Date.parse(publishedAt)+days*DAY;return viewHistory.filter(p=>p.value===value&&Math.abs(Date.parse(p.at)-target)<=tolerance*DAY).sort((a,b)=>Math.abs(Date.parse(a.at)-target)-Math.abs(Date.parse(b.at)-target))[0]?.at??null;};
  const velocity=cv&&n-Date.parse(cv.at)<=2*DAY?velocityPerHour(viewHistory):null;
  return {videoId:v.videoId,title:v.title??'Untitled video',thumbnailUrl:v.thumbnailUrl,publishedAt,currentViews:cv?.value??null,likes:likes?.value??null,comments:comments?.value??null,observedAt:cv?.at??null,likesAt:likes?.at??null,commentsAt:comments?.at??null,
   engagementRate:cv&&likes&&comments&&cv.at===likes.at&&cv.at===comments.at?engagement(cv.value,likes.value,comments.value):null,
   likeRate:cv&&likes&&cv.at===likes.at?likeRate(cv.value,likes.value):null,
   views24h:milestones['24h'],views7d:milestones['7d'],views30d:milestones['30d'],views24hAt:milestoneAt(1,milestones['24h'],.5),views7dAt:milestoneAt(7,milestones['7d'],1),views30dAt:milestoneAt(30,milestones['30d'],1.5),velocityPerHour:velocity,velocityFrom:velocity!==null?viewHistory.at(-2)?.at??null:null,velocityAt:velocity!==null?cv?.at??null:null,breakoutFactor:null as number|null};
 });
 for(const v of videos){if(v.publishedAt&&v.views24h!==null)v.breakoutFactor=breakoutFactor(v.views24h,videos.filter(p=>p.publishedAt&&p.publishedAt<v.publishedAt!&&p.views24h!==null).map(p=>p.views24h!));}
 const known=videos.filter(v=>v.currentViews!==null),topVideos=[...known].sort((a,b)=>b.currentViews!-a.currentViews!).slice(0,10).map(v=>({videoId:v.videoId,title:v.title,views:v.currentViews!,publishedAt:v.publishedAt}));
 const posts30d=sumMetric('posts');
 const cohort=fixedVideoCohort(readings,content,n);
 const [catalogueResult,scanResult]=await Promise.all([
  query<CatalogueRow>(`SELECT account_id AS "accountId",video_id AS "videoId",title,published_at AS "publishedAt",last_observed_at AS "observedAt",view_count::text AS views,like_count::text AS likes,comment_count::text AS comments
   FROM creator_video_catalogue WHERE account_id=ANY($1::uuid[]) AND catalogue_public=true AND last_observed_at BETWEEN $2::timestamptz-interval '7 days' AND $2::timestamptz AND (published_at IS NULL OR published_at<=$2::timestamptz)`,[ids,stamp]),
  query<ScanRow>(`SELECT account_id AS "accountId",completed_at AS "completedAt",scan_started_at AS "scanStartedAt",last_error AS "lastError" FROM creator_catalogue_scan WHERE account_id=ANY($1::uuid[])`,[ids])
 ]);
 const validCount=(x:string|null)=>x!==null&&Number.isSafeInteger(Number(x))&&Number(x)>=0?Number(x):null;
 const catalogue=catalogueResult.rows.map(v=>({...v,publishedAt:v.publishedAt?iso(v.publishedAt):null,observedAt:iso(v.observedAt),currentViews:validCount(v.views),likes:validCount(v.likes),comments:validCount(v.comments),likesAt:iso(v.observedAt),commentsAt:iso(v.observedAt)}));
 const full=observedPortfolio(catalogue);
 const officialCount=sumMetric('totalVideos');
 const scanComplete=scanResult.rows.length===ids.length&&scanResult.rows.every(s=>s.completedAt!==null&&s.scanStartedAt===null&&s.lastError===null&&n-Date.parse(iso(s.completedAt))<=7*DAY);
 const catalogueComplete=scanComplete&&officialCount!==null&&catalogue.length===officialCount&&snapshots.every(a=>{const official=fresh(a.totalVideos.at(-1),n);return official!==null&&catalogue.filter(v=>v.accountId===a.id).length===official.value;});
 const cataloguePublished30d=catalogueComplete?pktPublishedCount(catalogue,n):null;
 const profile={...profileAnalytics(videos,cohort,subscribers),portfolio:{...full,known:full.known.slice(0,10),observedCount:full.known.length,catalogueCount:catalogue.length,catalogueComplete,cataloguePublished30d,topFiveViews:full.known.length?full.known.slice(0,5).reduce((s,v)=>s+v.currentViews!,0):null},channelGrowth:channelGrowth(primary.views)};
 return {source:'PCI Hub / Creators Bucket',asOf:stamp,primaryHandle:primary.handle,bannerUrl,accountStats,historyAccountCount:accounts.length,history:{views,subscribers,ranks},growth:{views:growth(primary.views),subscribers:growth(primary.subscribers,true)},weeklyViews:periodRates(views,7,n),monthlyViews:periodRates(views,30,n),totals:{subscribers:sumMetric('subscribers'),views:sumMetric('views'),totalVideos:sumMetric('totalVideos'),posts30d,publishingFrequency:posts30d===null?null:posts30d/30},profile,video:{cohort,sampledVideos:known.length,averageViews:average(videos.map(v=>v.currentViews)),averageLikes:average(videos.map(v=>v.likes)),averageComments:average(videos.map(v=>v.comments)),averageEngagement:average(videos.map(v=>v.engagementRate)),averageLikeRate:average(videos.map(v=>v.likeRate)),likesCoverage:videos.filter(v=>v.likes!==null).length,commentsCoverage:videos.filter(v=>v.comments!==null).length,engagementCoverage:videos.filter(v=>v.engagementRate!==null).length,topVideos,videos}};
}

/** Admin-only inventory of this sub-bucket. Counts are coverage, not creator metrics. */
export async function creatorsBucketStatus(){
 const r=await query<{registered:number;withFollowers:number;withViews:number;withVideoCount:number;withUploads:number;withContent:number;trackedVideos:number;latestAt:Date|string|null}>(`WITH yt AS (SELECT id FROM accounts WHERE platform='youtube'),
 latest AS (SELECT account_id,metric FROM hub_account_metrics WHERE account_id IN (SELECT id FROM yt) AND observed_at BETWEEN now()-interval '7 days' AND now()
 UNION SELECT account_id,metric FROM ingest_observations WHERE account_id IN (SELECT id FROM yt) AND entity_kind='account' AND metric='video_count' AND source_id='youtube.api' AND accuracy='exact' AND value_scale=0 AND value_numeric IS NOT NULL AND observed_at BETWEEN now()-interval '7 days' AND now()),
 content AS (SELECT account_id,content_id,last_observed_at FROM ingest_content WHERE platform='youtube' AND account_id IN (SELECT id FROM yt) AND last_observed_at BETWEEN now()-interval '7 days' AND now())
 SELECT (SELECT count(*)::int FROM yt) AS registered,
 (SELECT count(DISTINCT account_id)::int FROM latest WHERE metric='followers') AS "withFollowers",
 (SELECT count(DISTINCT account_id)::int FROM latest WHERE metric='views') AS "withViews",
 (SELECT count(DISTINCT account_id)::int FROM latest WHERE metric='video_count') AS "withVideoCount",
 (SELECT count(DISTINCT account_id)::int FROM latest WHERE metric='posts_30d') AS "withUploads",
 (SELECT count(DISTINCT account_id)::int FROM content) AS "withContent",(SELECT count(*)::int FROM content) AS "trackedVideos",
 (SELECT max(last_observed_at) FROM content) AS "latestAt"`);
 return {name:'Creators Bucket',platform:'youtube',source:'PCI Hub',...r.rows[0]};
}
