import {query} from '../../lib/db.js';
import {dailyHistory, estimateRecentUploadsFloor, estimateMonthlyEarnings, gainAtPeriod, subscriberMilestone, earningsSampleStatus, aggregateEarningsStatus, type EarningsStatus, type ObservationPoint, type MonthlyEstimate} from './engine.js';
import {creatorVideoSummary,type CreatorVideoSummary} from './videos.js';

type MetricRow = {personId:string;accountId:string;metric:string;value:string|null;observedAt:Date|string|null};
export type EarningsResult = {estimate:MonthlyEstimate;status:EarningsStatus;basis:EarningsBasis};
export type EarningsBasis = 'observed_view_gain' | 'recent_uploads_floor' | null;
type PersonEstimates = Map<string,EarningsResult>;

/** This is a lower bound, NOT total 30-day channel views: every view on a video
 * published within the previous 30 days necessarily happened within that window.
 * It excludes all views on older uploads and makes no claim about monetization.
 * Only use recent, actually sampled YouTube video records.
 */
async function recentUploadFloors(accountIds:string[], now:Date):Promise<Map<string,{views:number;usd:number}>> {
  const out=new Map<string,{views:number;usd:number}>();
  if(!accountIds.length)return out;
  try {
    const rows=await query<{accountId:string;views:string}>(`SELECT account_id AS "accountId",sum(view_count)::text AS views
      FROM creator_video_catalogue
      WHERE account_id=ANY($1::uuid[])
        AND published_at >= $2::timestamptz - interval '30 days'
        AND published_at <= $2::timestamptz
        AND last_observed_at >= $2::timestamptz - interval '48 hours'
        AND view_count IS NOT NULL
      GROUP BY account_id`,[accountIds,now.toISOString()]);
    for(const row of rows.rows) {
      const views=Number(row.views);
      if(!Number.isSafeInteger(views)||views<0)continue;
      const estimate=estimateRecentUploadsFloor(views);
      if(estimate)out.set(row.accountId,{views,usd:estimate.usd});
    }
  }catch{/* The optional video catalogue may not have been initialized yet. */}
  return out;
}


function asPoint(row:MetricRow):ObservationPoint|null {
  if (row.value === null || row.observedAt === null) return null;
  const value = Number(row.value);
  const at = new Date(row.observedAt).toISOString();
  return Number.isSafeInteger(value) && value >= 0 ? {at,value} : null;
}

/** Batch all visible wheel creators in one query; missing channels do not become $0. */
export async function monthlyEstimates(personIds:string[], now = new Date()):Promise<PersonEstimates> {
  const out:PersonEstimates = new Map();
  if (!personIds.length) return out;
  const result = await query<MetricRow>(`SELECT a.person_id AS "personId", a.id AS "accountId", 'views' AS metric,
    o.value::text AS value, o.observed_at AS "observedAt"
    FROM accounts a LEFT JOIN metric_observations o ON o.account_id=a.id AND o.metric='views'
      AND o.observed_at >= $2::timestamptz - interval '32 days' AND o.observed_at <= $2::timestamptz
    WHERE a.person_id = ANY($1::uuid[]) AND a.platform='youtube'
    ORDER BY a.person_id,a.id,o.observed_at`, [personIds,now.toISOString()]);
  const people=new Map<string,Map<string,ObservationPoint[]>>();
  for (const row of result.rows) {
    const accounts=people.get(row.personId) ?? new Map<string,ObservationPoint[]>();
    const points=accounts.get(row.accountId) ?? [];
    const point=asPoint(row);
    if(point) points.push(point);
    accounts.set(row.accountId,points);people.set(row.personId,accounts);
  }
  const recentFloors=await recentUploadFloors([...new Set([...people.values()].flatMap(a=>[...a.keys()]))],now);
  for (const [personId,accounts] of people) {
    const histories=[...accounts.values()];
    const status=aggregateEarningsStatus(histories.map(points=>earningsSampleStatus(points,now)));
    const estimates=histories.map(points=>estimateMonthlyEarnings(points,now));
    // Every linked YouTube channel must have a valid estimate to avoid understating the figure.
    if (status==='ready' && estimates.every((e):e is NonNullable<MonthlyEstimate>=>e!==null)) {
      const usd=estimates.reduce((sum,e)=>sum+e.usd,0);
      out.set(personId,{estimate:Number.isSafeInteger(usd) ? {
        usd,measuredDays:Math.min(...estimates.map(e=>e.measuredDays)),
        assumedRpmUsd:estimates[0].assumedRpmUsd,
        equivalent30DayViews:estimates.reduce((s,e)=>s+e.equivalent30DayViews,0)
      }:null,status:Number.isSafeInteger(usd)?'ready':'invalid',basis:Number.isSafeInteger(usd)?'observed_view_gain':null});
    } else {
      // Provisional model uses only current views of uploads published in the past 30 days.
      // It cannot overstate that period's channel view count, but may undercount older uploads.
      // A partial sampled set still gives a truthful lower bound; other linked channels
      // can only add to this figure, not subtract from it.
      const floors=[...accounts.keys()].map(id=>recentFloors.get(id)).filter((x):x is {views:number;usd:number}=>x!==undefined);
      if(floors.length) {
        const usd=floors.reduce((s,e)=>s+e.usd,0);
        const views=floors.reduce((s,e)=>s+e.views,0);
        const floor=estimateRecentUploadsFloor(views);
        out.set(personId,{estimate:floor,status:floor?'ready':'invalid',basis:floor?'recent_uploads_floor':null});
      } else out.set(personId,{estimate:null,status:status==='ready'?'invalid':status,basis:null});
    }
  }
  return out;
}

export async function personAnalytics(personId:string, now=new Date()) {
  const result=await query<MetricRow>(`SELECT a.person_id AS "personId", a.id AS "accountId", o.metric,
    o.value::text AS value, o.observed_at AS "observedAt"
    FROM accounts a LEFT JOIN metric_observations o ON o.account_id=a.id
      AND o.metric IN ('followers','views')
      AND o.observed_at >= $2::timestamptz - interval '93 days'
      AND o.observed_at <= $2::timestamptz
    WHERE a.person_id=$1 AND a.platform='youtube'
    ORDER BY a.id,o.metric,o.observed_at`, [personId,now.toISOString()]);
  const accounts=new Map<string,{followers:ObservationPoint[];views:ObservationPoint[]}>();
  for(const row of result.rows){
    const a=accounts.get(row.accountId)??{followers:[],views:[]};
    const p=asPoint(row);
    if(p && (row.metric==='followers'||row.metric==='views')) a[row.metric].push(p);
    accounts.set(row.accountId,a);
  }
  const all=[...accounts.values()];
  const earningsStatus=aggregateEarningsStatus(all.map(a=>earningsSampleStatus(a.views,now)));
  let earnings=earningsStatus==='ready'
    ? all.map(a=>estimateMonthlyEarnings(a.views,now)!).reduce((s,e)=>s+e.usd,0) : null;
  let earningsBasis:EarningsBasis=earnings!==null?'observed_view_gain':null;
  if(earnings===null && accounts.size){
    const floors=await recentUploadFloors([...accounts.keys()],now);
    if(floors.size>0){
      const provisional=[...floors.values()].reduce((s,e)=>s+e.usd,0);
      if(Number.isSafeInteger(provisional)){
        earnings=provisional; earningsBasis='recent_uploads_floor';
      }
    }
  }
  // Graph one linked YouTube account; do not sum asynchronous channel snapshots into a false series.
  const primary=all[0]??{followers:[],views:[]};
  const growth=(points:ObservationPoint[])=>({
    '24h':gainAtPeriod(points,1,now), '7d':gainAtPeriod(points,7,now), '30d':gainAtPeriod(points,30,now)
  });
  let video:CreatorVideoSummary={sampledVideos:0,averageViews:null,topVideos:[],videos:[]};
  try{video=await creatorVideoSummary([...accounts.keys()]);}catch{/* analytics table may not exist during initial startup */}
  const currentSubscribers=primary.followers.at(-1)?.value??null;
  const milestone=subscriberMilestone(currentSubscribers,gainAtPeriod(primary.followers,30,now));
  return {
    video,milestone,
    estimatedMonthlyEarningsUsd:earnings,
    earningsStatus:earnings!==null?'ready':earningsStatus,
    earningsBasis,
    earningsMethod:earningsBasis==='recent_uploads_floor'
      ? 'Provisional lower-bound: current views on YouTube videos published in the last 30 days, excluding older videos, multiplied by the Social Blade $0.25–$4 RPM midpoint.'
      : 'Social Blade $0.25–$4 RPM midpoint; observed 20-hour–31-day channel view pace normalized to 30 days',
    growth:{subscribers:growth(primary.followers),views:growth(primary.views)},
    history:{subscribers:dailyHistory(primary.followers),views:dailyHistory(primary.views)},
    historyAccountCount:all.length
  };
}
