/** Pure limits and breaker rules. No secrets or provider calls. */
export const DEFAULT_MONTHLY_CAP=499;
export function monthlyCap(raw:string|number|undefined=undefined):number {
 const v=raw===undefined?DEFAULT_MONTHLY_CAP:typeof raw==='number'?raw:/^\d+$/.test(raw)?Number(raw):NaN;
 if(!Number.isInteger(v)||v<1||v>100000)throw Error('invalid_scrappa_monthly_cap');
 return v;
}
/** Keep 20% for manual work, rounded down. A key with a tiny cap remains manual-only. */
export const scheduledCeiling=(cap:number)=>Math.floor(monthlyCap(cap)*0.8);
export type CreditEvent={outcome:'reserved'|'response'|'ambiguous';http_status:number|null;transport_failure?:boolean;reserved_at:string|Date};
const age=(e:CreditEvent,now:number)=>now-new Date(e.reserved_at).getTime();
const stopStatus=(s:number|null)=>s!==null&&[401,402,403,429].includes(s);
export function breakerReason(events:CreditEvent[],now=Date.now()):'provider_stop'|'consecutive_failures'|'request_in_flight'|null{
 const recent=[...events].sort((a,b)=>new Date(b.reserved_at).getTime()-new Date(a.reserved_at).getTime());
 if(recent.some(e=>e.outcome==='reserved'&&age(e,now)<120000))return 'request_in_flight';
 if(recent.some(e=>stopStatus(e.http_status)&&age(e,now)<86400000))return 'provider_stop';
 const last=recent.slice(0,3);
 if(last.length===3&&last.every(e=>age(e,now)<21600000&&(e.outcome==='ambiguous'||e.outcome==='reserved'||e.transport_failure===true||(e.http_status??0)>=500)))return 'consecutive_failures';
 return null;
}
