/** Pure, versioned PCI Ingest decision rules. No platform request is issued here. */
export type SourceMethod = 'api' | 'http';
export type Precision = 'exact' | 'rounded' | 'unverified';
/** The web (http) adapters are lower priority than official APIs and admin entries (.api / .manual). */
export const methodOf=(sourceId:string):SourceMethod=>sourceId.endsWith('.http')?'http':'api';
export type Snapshot = { method:SourceMethod; value:number|string; precision:Precision; observedAt:string };
export type Decision = 'accept'|'reject_stale'|'reject_lower_priority'|'reject_unverified'|'reject_invalid';

export function validCount(v:unknown):v is number {
  return typeof v==='number' && Number.isSafeInteger(v) && v>=0;
}
export type DecideOptions={apiHealthy?:boolean;apiMaxAgeMs?:number};
/** Per-field API-first rule. An HTTP value may replace a stored API value only when the API
 * source is unhealthy (or down) OR the stored API value is older than apiMaxAgeMs (default 7 days,
 * i.e. the API is not supplying this field). A healthy, recent API value always wins. */
export function decideValue(current:Snapshot|null, candidate:Snapshot, now=Date.now(), opts:DecideOptions={}):Decision {
  const at=Date.parse(candidate.observedAt);
  if(!Number.isFinite(at) || at>now+5*60_000 || at<0 ||
    (typeof candidate.value==='number' && !validCount(candidate.value)) ||
    (typeof candidate.value==='string' && (candidate.value.length===0 || candidate.value.length>4000)))return 'reject_invalid';
  if(candidate.precision==='unverified')return 'reject_unverified';
  if(!current)return 'accept';
  const old=Date.parse(current.observedAt);
  if(!Number.isFinite(old))return 'accept';
  if(at<old)return 'reject_stale';
  if(candidate.method==='http'&&current.method==='api'){
    const healthy=opts.apiHealthy!==false;
    const maxAge=opts.apiMaxAgeMs??7*86_400_000;
    if(healthy&&now-old<maxAge)return 'reject_lower_priority';
  }
  return 'accept';
}

/** True when two numeric readings of the same field disagree by more than tolerance (default 5%). */
export function isDiscrepancy(a:number,b:number,tolerance=0.05):boolean {
  if(!validCount(a)||!validCount(b))return false;
  if(a===b)return false;
  const base=Math.max(a,b);
  return base>0 && Math.abs(a-b)/base>tolerance;
}
/** A reading is stale when older than twice its refresh window. */
export function isStale(observedAt:string,windowHours:number,now=Date.now()):boolean {
  const t=Date.parse(observedAt);
  return !Number.isFinite(t) || now-t>2*windowHours*3_600_000;
}

export type RefreshPolicy={profileHours:number;recentContentHours:number;olderContentHours:number;minIntervalMinutes:number};
export const POLICY:Record<'youtube'|'instagram'|'tiktok',RefreshPolicy>={
  youtube:{profileHours:24,recentContentHours:8,olderContentHours:72,minIntervalMinutes:10},
  instagram:{profileHours:36,recentContentHours:24,olderContentHours:96,minIntervalMinutes:30},
  tiktok:{profileHours:48,recentContentHours:24,olderContentHours:96,minIntervalMinutes:60}
};
/** Scheduling hints, not promises that the platform permits automated extraction. */
export function due(lastSuccessfulAt:string|null,hours:number,now=Date.now()):boolean {
  if(!lastSuccessfulAt)return true;
  const last=Date.parse(lastSuccessfulAt);
  return Number.isFinite(last)?last+hours*3_600_000<=now:true;
}
