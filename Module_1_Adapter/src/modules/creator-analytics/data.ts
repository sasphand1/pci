import {query} from '../../lib/db.js';
import {dailyHistory, estimateMonthlyEarnings, gainAtPeriod, subscriberMilestone, type ObservationPoint, type MonthlyEstimate} from './engine.js';
import {creatorVideoSummary,type CreatorVideoSummary} from './videos.js';

type MetricRow = {personId:string;accountId:string;metric:string;value:string|null;observedAt:Date|string|null};
type PersonEstimates = Map<string, MonthlyEstimate>;

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
  for (const [personId,accounts] of people) {
    const estimates=[...accounts.values()].map(points=>estimateMonthlyEarnings(points,now));
    // All of a creator's YouTube accounts must have a valid estimate to avoid understating income.
    if (estimates.every((e):e is NonNullable<MonthlyEstimate>=>e!==null)) {
      const usd=estimates.reduce((sum,e)=>sum+e.usd,0);
      out.set(personId,Number.isSafeInteger(usd) ? {
        usd,measuredDays:Math.min(...estimates.map(e=>e.measuredDays)),
        assumedRpmUsd:estimates[0].assumedRpmUsd,
        equivalent30DayViews:estimates.reduce((s,e)=>s+e.equivalent30DayViews,0)
      }:null);
    } else out.set(personId,null);
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
  const earnings=all.length && all.every(a=>estimateMonthlyEarnings(a.views,now)!==null)
    ? all.map(a=>estimateMonthlyEarnings(a.views,now)!).reduce((s,e)=>s+e.usd,0) : null;
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
    earningsMethod:'Social Blade $0.25–$4 RPM midpoint; observed 2–31-day channel view pace normalized to 30 days',
    growth:{subscribers:growth(primary.followers),views:growth(primary.views)},
    history:{subscribers:dailyHistory(primary.followers),views:dailyHistory(primary.views)},
    historyAccountCount:all.length
  };
}
