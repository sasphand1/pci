/** Deterministic, public-data-only estimates. Not actual creator revenue. */
export const SOCIAL_BLADE_MIN_RPM_USD = 0.25;
export const SOCIAL_BLADE_MAX_RPM_USD = 4;
// PCI displays one figure: the arithmetic midpoint of Social Blade's assumptions.
export const ASSUMED_RPM_USD = (SOCIAL_BLADE_MIN_RPM_USD + SOCIAL_BLADE_MAX_RPM_USD) / 2;

// Instagram does not expose creator income. This is ONLY a hypothetical
// sponsorship-price scenario, not RPM, monetization eligibility or earnings.
// One assumed paid collaboration each month at $1 per 1,000 followers.
export const INSTAGRAM_SPONSOR_USD_PER_1000_FOLLOWERS = 1;
export const INSTAGRAM_ASSUMED_SPONSORED_POSTS_PER_MONTH = 1;
export function estimateInstagramSponsorScenario(followers:number):number|null {
  if(!Number.isSafeInteger(followers)||followers<0)return null;
  const usd=Math.round((followers/1000)*INSTAGRAM_SPONSOR_USD_PER_1000_FOLLOWERS*INSTAGRAM_ASSUMED_SPONSORED_POSTS_PER_MONTH);
  return Number.isSafeInteger(usd)?usd:null;
}
const DAY_MS = 86_400_000;
// A measured daily interval is sufficient for a clearly labeled monthly pace projection.
// Intervals shorter than 20 hours are too noisy and are not treated as monthly earnings.
const MIN_EARNINGS_INTERVAL_MS = 20 * 3_600_000;

export type EarningsStatus = 'ready' | 'needs_history' | 'no_view_data' | 'stale' | 'invalid' | 'no_youtube';

/** A reason for the empty value, rather than an indefinite "Collecting" indicator. */
export function earningsSampleStatus(samples: ObservationPoint[], now = new Date()): EarningsStatus {
  const all = validPoints(samples);
  if (!all.length) return 'no_view_data';
  const latest = all.at(-1)!;
  const age = now.getTime() - Date.parse(latest.at);
  if (age < -60_000) return 'invalid';
  if (age > 2 * DAY_MS) return 'stale';
  const candidates = all.filter(p => {
    const interval = Date.parse(latest.at) - Date.parse(p.at);
    return interval >= MIN_EARNINGS_INTERVAL_MS && interval <= 31 * DAY_MS;
  });
  if (!candidates.length) return 'needs_history';
  return latest.value < candidates[0].value ? 'invalid' : 'ready';
}

export function aggregateEarningsStatus(states: EarningsStatus[]): EarningsStatus {
  if (!states.length) return 'no_youtube';
  if (states.every(s => s === 'ready')) return 'ready';
  for (const state of ['stale', 'invalid', 'no_view_data', 'needs_history'] as const) {
    if (states.includes(state)) return state;
  }
  return 'invalid';
}

export type ObservationPoint = { at: string; value: number };
export type MonthlyEstimate = {
  usd: number;
  measuredDays: number;
  assumedRpmUsd: number;
  equivalent30DayViews: number;
} | null;

function validPoints(samples: ObservationPoint[]): ObservationPoint[] {
  return samples.filter(s => Number.isSafeInteger(s.value) && s.value >= 0 &&
    Number.isFinite(Date.parse(s.at))).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/**
 * Requires two fresh, real observations at least 20 hours apart. Projects the
 * observed channel-view delta to a 30-day pace; never uses lifetime views as monthly views.
 * Return null on stale, missing, counter-reset or unsafe data.
 */
export function estimateMonthlyEarnings(samples: ObservationPoint[], now = new Date()): MonthlyEstimate {
  const all = validPoints(samples);
  const latest = all.at(-1);
  if (!latest || now.getTime() - Date.parse(latest.at) > 2 * DAY_MS || Date.parse(latest.at) > now.getTime() + 60_000) return null;
  const earlier = all.filter(s => {
    const elapsedMs = Date.parse(latest.at) - Date.parse(s.at);
    return elapsedMs >= MIN_EARNINGS_INTERVAL_MS && elapsedMs <= 31 * DAY_MS;
  });
  const first = earlier[0];
  if (!first || latest.value < first.value) return null;
  const elapsedDays = (Date.parse(latest.at) - Date.parse(first.at)) / DAY_MS;
  const equivalent30DayViews = Math.round((latest.value - first.value) / elapsedDays * 30);
  const usd = Math.round(equivalent30DayViews / 1000 * ASSUMED_RPM_USD);
  if (!Number.isSafeInteger(equivalent30DayViews) || !Number.isSafeInteger(usd)) return null;
  return {usd, measuredDays: Math.round(elapsedDays * 10) / 10, assumedRpmUsd: ASSUMED_RPM_USD, equivalent30DayViews};
}

/** A provisional, lower-bound model using views on new uploads ONLY.
 * Because the uploads were published in the past 30 days, all their current
 * cumulative views happened in that window. Older video views are excluded.
 */
export function estimateRecentUploadsFloor(views:number):MonthlyEstimate {
  if(!Number.isSafeInteger(views)||views<0)return null;
  const usd=Math.round(views/1000*ASSUMED_RPM_USD);
  return Number.isSafeInteger(usd)?{
    usd,measuredDays:30,assumedRpmUsd:ASSUMED_RPM_USD,equivalent30DayViews:views
  }:null;
}

/** Requires a sample close to the requested lookback, not a fabricated data point. */
export function gainAtPeriod(samples: ObservationPoint[], days: 1 | 7 | 30, now = new Date()): number | null {
  const all = validPoints(samples);
  const latest = all.at(-1);
  if (!latest || now.getTime() - Date.parse(latest.at) > 2 * DAY_MS) return null;
  const target = Date.parse(latest.at) - days * DAY_MS;
  const tolerance = days === 1 ? 12 * 3_600_000 : days === 7 ? DAY_MS : 2 * DAY_MS;
  const baseline = all.filter(p => Math.abs(Date.parse(p.at) - target) <= tolerance)
    .sort((a, b) => Math.abs(Date.parse(a.at) - target) - Math.abs(Date.parse(b.at) - target))[0];
  if (!baseline || latest.value < baseline.value) return null;
  return latest.value - baseline.value;
}

/** Keep the most recent measurement in each UTC day, without pretending missing days exist. */
export function dailyHistory(samples: ObservationPoint[]): ObservationPoint[] {
  const dates = new Map<string, ObservationPoint>();
  for (const p of validPoints(samples)) dates.set(p.at.slice(0, 10), p);
  return [...dates.values()];
}

/** Cumulative views observed near video-age milestones. No interpolation/backfill. */
export function videoMilestones(samples:ObservationPoint[],publishedAt:string):Record<'24h'|'7d'|'30d',number|null>{
  const published=Date.parse(publishedAt);
  const result:{'24h':number|null;'7d':number|null;'30d':number|null}={'24h':null,'7d':null,'30d':null};
  if(!Number.isFinite(published))return result;
  const points=validPoints(samples).filter(p=>Date.parse(p.at)>=published);
  for(const [name,age,tolerance] of [['24h',1,.5],['7d',7,1],['30d',30,1.5]] as const){
    const target=published+age*DAY_MS;
    const match=points.filter(p=>Math.abs(Date.parse(p.at)-target)<=tolerance*DAY_MS)
      .sort((a,b)=>Math.abs(Date.parse(a.at)-target)-Math.abs(Date.parse(b.at)-target))[0];
    result[name]=match?.value??null;
  }
  return result;
}

/** Last two fresh observed samples; measures actual gain/hour, never a lifetime average. */
export function velocityPerHour(samples:ObservationPoint[]):number|null{
  const points=validPoints(samples);
  if(points.length<2)return null;
  const a=points.at(-2)!,b=points.at(-1)!;
  const hours=(Date.parse(b.at)-Date.parse(a.at))/3_600_000;
  if(hours<1||hours>72||b.value<a.value)return null;
  return Math.round((b.value-a.value)/hours*10)/10;
}

/** Breakout requires >=3 videos with comparable, observed 24h views. */
export function breakoutFactor(views24h:number|null,previousComparable:number[]):number|null{
  if(views24h===null||previousComparable.length<3||previousComparable.some(n=>!Number.isSafeInteger(n)||n<0))return null;
  const baseline=previousComparable.reduce((a,b)=>a+b,0)/previousComparable.length;
  return baseline>0?Math.round(views24h/baseline*100)/100:null;
}

/** Milestones based on recent observed growth, not predictive AI. */
export function subscriberMilestone(current:number|null,gained30d:number|null):{target:number;estimatedDays:number|null}|null{
  if(current===null||!Number.isSafeInteger(current)||current<0)return null;
  const bases=[1000,10000,100000,1000000,10000000,100000000];
  const target=bases.find(t=>t>current)??Math.ceil((current+1)/100000000)*100000000;
  const estimatedDays=gained30d!==null&&gained30d>0
    ?Math.ceil((target-current)/(gained30d/30)):null;
  return {target,estimatedDays:estimatedDays!==null&&estimatedDays<=365?estimatedDays:null};
}
