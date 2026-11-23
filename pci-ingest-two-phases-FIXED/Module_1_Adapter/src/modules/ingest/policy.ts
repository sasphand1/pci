/** Pure, versioned PCI Ingest decision rules. No platform request is issued here. */
export type SourceMethod = 'api' | 'http';
export type Precision = 'exact' | 'rounded' | 'unverified';
export type Snapshot = { method:SourceMethod; value:number|string; precision:Precision; observedAt:string };
export type Decision = 'accept'|'reject_stale'|'reject_lower_priority'|'reject_unverified'|'reject_invalid';

export function validCount(v:unknown):v is number {
  return typeof v==='number' && Number.isSafeInteger(v) && v>=0;
}
export function decideValue(current:Snapshot|null, candidate:Snapshot, now=Date.now()):Decision {
  const at=Date.parse(candidate.observedAt);
  if(!Number.isFinite(at) || at>now+5*60_000 || at<0 ||
    (typeof candidate.value==='number' && !validCount(candidate.value)) ||
    (typeof candidate.value==='string' && (candidate.value.length===0 || candidate.value.length>4000)))return 'reject_invalid';
  if(candidate.precision==='unverified')return 'reject_unverified';
  if(!current)return 'accept';
  const old=Date.parse(current.observedAt);
  if(!Number.isFinite(old))return 'accept';
  if(at<old)return 'reject_stale';
  // A successful official API reading dominates a same-age HTTP reading.
  if(candidate.method==='http'&&current.method==='api' && at-old<7*86_400_000)return 'reject_lower_priority';
  if(at===old && candidate.method==='http'&&current.method==='api')return 'reject_lower_priority';
  return 'accept';
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
