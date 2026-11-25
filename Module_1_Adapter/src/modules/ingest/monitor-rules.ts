/** Pure Hub Monitor rules: no database, network or clock access. */
export type Severity='info'|'warning'|'critical';
export type HubAlert={kind:string;severity:Severity;message:string};
export type SourceStatus='ok'|'degraded'|'down'|'disabled';
export type SourceInput={
  id:string;method:'api'|'http';enabled:boolean;lastSuccessAt:string|null;
  consecutiveFailures:number;lastErrorCode:string|null;now:number;checkFreshness:boolean;
  /** How often the source should deliver. Stale after 1.5x, no data after 3x (24h source: 36h / 72h). */
  expectedHours?:number;
};
const H=3_600_000;
/** Map an HTTP failure to a stable code. 403/429/captcha = blocked; missing expected markup = shape changed. */
export function classifyHttpFailure(status:number|null,body?:string|null):'BLOCKED'|'SHAPE_CHANGED'|'UNAVAILABLE'|'TIMEOUT' {
  if(status===null)return 'TIMEOUT';
  if(status===401||status===403||status===429)return 'BLOCKED';
  if(body&&/captcha|unusual traffic|are you a robot/i.test(body))return 'BLOCKED';
  if(status===404||status===410||(status>=200&&status<300))return 'SHAPE_CHANGED';
  return 'UNAVAILABLE';
}
const KIND:Record<string,{kind:string;text:string}>={
  SHAPE_CHANGED:{kind:'endpoint_changed',text:'the page or endpoint format changed'},
  BLOCKED:{kind:'blocked',text:'the platform is blocking requests'},
  QUOTA:{kind:'quota',text:'the API quota is exhausted'},
  TIMEOUT:{kind:'source_failing',text:'requests are timing out'},
  UNAVAILABLE:{kind:'source_failing',text:'the source is unavailable'}
};
export function evaluateSource(s:SourceInput):{status:SourceStatus;alerts:HubAlert[]} {
  if(!s.enabled)return {status:'disabled',alerts:[]};
  const alerts:HubAlert[]=[];let status:SourceStatus='ok';
  if(s.consecutiveFailures>=3){
    const k=KIND[s.lastErrorCode??'']??{kind:'source_failing',text:'repeated failures'};
    alerts.push({kind:k.kind,severity:'critical',message:`${s.id}: ${k.text} (${s.consecutiveFailures} consecutive failures).`});
    status='down';
  }
  if(s.checkFreshness){
    const t=s.lastSuccessAt?Date.parse(s.lastSuccessAt):NaN;
    if(!Number.isFinite(t)){
      alerts.push({kind:'no_data',severity:'warning',message:`${s.id}: no successful collection recorded yet.`});
      if(status==='ok')status='degraded';
    }else{
      const age=(s.now-t)/H;
      const every=s.expectedHours&&s.expectedHours>0?s.expectedHours:24;
      if(age>every*3){alerts.push({kind:'no_data',severity:'critical',message:`${s.id}: no new data for ${Math.floor(age)} hours.`});status='down';}
      else if(age>every*1.5){alerts.push({kind:'stale',severity:'warning',message:`${s.id}: last data is ${Math.floor(age)} hours old.`});if(status==='ok')status='degraded';}
    }
  }
  if(status==='ok'&&s.consecutiveFailures>0)status='degraded';
  return {status,alerts};
}
export function evaluateQuota(used:number,limit:number):HubAlert|null {
  if(!(limit>0)||!(used>=0))return null;
  const pct=used/limit;
  if(pct>=0.9)return {kind:'quota',severity:'critical',message:`YouTube daily request budget at ${Math.round(pct*100)}% (${used}/${limit}).`};
  if(pct>=0.75)return {kind:'quota',severity:'warning',message:`YouTube daily request budget at ${Math.round(pct*100)}% (${used}/${limit}).`};
  return null;
}
export function evaluateCoverage(platform:string,registered:number,fresh:number):HubAlert|null {
  if(registered<=0)return null;
  const pct=fresh/registered;
  if(pct<0.5)return {kind:'coverage_low',severity:'critical',message:`${platform}: only ${fresh} of ${registered} accounts have fresh data (${Math.round(pct*100)}%).`};
  if(pct<0.8)return {kind:'coverage_low',severity:'warning',message:`${platform}: only ${fresh} of ${registered} accounts have fresh data (${Math.round(pct*100)}%).`};
  return null;
}
export const hubKey=(scope:string,kind:string)=>`hub:${scope}:${kind}`;

/** Meta Graph error 190 = access token invalid or expired. Judged over the last 24h of real attempts. */
export function evaluateInstagramAuth(attempted:number,invalid:number):HubAlert|null {
  if(attempted<3||invalid<=0)return null;
  if(invalid/attempted<0.5)return null;
  return {kind:'token_invalid',severity:'critical',
    message:`Instagram rejected the access token (Graph code 190) for ${invalid} of ${attempted} accounts in 24h. Replace INSTAGRAM_GRAPH_ACCESS_TOKEN in Module 1 and redeploy.`};
}
/** Meta rate limiting seen in the last 24h. The refresh pauses by itself; this only tells you it happened. */
export function evaluateInstagramLimit(limited:number):HubAlert|null {
  if(!(limited>0))return null;
  return {kind:'rate_limited',severity:'warning',
    message:`Instagram rate limit hit ${limited} time(s) in 24h. Refresh pauses automatically (6 hour cooldown); lower PCI_INSTAGRAM_PER_RUN if it keeps happening.`};
}

/** Circuit breaker: after 3 consecutive failures a web source rests for pauseHours before any new batch. */
export function shouldPauseSource(consecutiveFailures:number,checkedAt:string|Date|null,now:number,pauseHours=6):boolean {
  if(consecutiveFailures<3||!checkedAt)return false;
  const t=new Date(checkedAt).getTime();
  return Number.isFinite(t)&&t<=now&&now-t<pauseHours*3_600_000;
}
/** Hours before the same account may be tried again: a day normally, a week after 3 failed tries. */
export const avatarRetryHours=(attempts:number)=>attempts>=3?168:24;
