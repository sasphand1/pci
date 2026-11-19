/** Pure creator-eligibility diagnostics. No database, network or UI dependencies.
 * Explains WHY a creator is not (yet) in the subscriber-based rankings; it never ranks anyone.
 * Reason codes are stable API values shown in the admin panel.
 */
export const EXCLUSION_REASONS=Object.freeze(['disabled','rejected','not_approved','no_snapshot','not_returned_by_youtube','sync_failed','metric_hidden','stale']);
const COUNT=/^(0|[1-9]\d*)$/;
/** @param c {enabled,humanReviewStatus,fetchedAt,subscriberCount,subscriberHidden,lastOutcome} */
export function classifyCreator(c,{now=new Date(),maxAgeHours=36}={}){
 const reasons=[];
 if(c.enabled!==true)reasons.push('disabled');
 if(c.humanReviewStatus==='rejected')reasons.push('rejected');
 else if(c.humanReviewStatus!=='approved')reasons.push('not_approved');
 if(!c.fetchedAt){
   reasons.push(c.lastOutcome==='not_returned'?'not_returned_by_youtube':c.lastOutcome==='failed'?'sync_failed':'no_snapshot');
 }else{
   if(c.lastOutcome==='not_returned')reasons.push('not_returned_by_youtube');
   if(c.subscriberHidden===true||!COUNT.test(String(c.subscriberCount??'')))reasons.push('metric_hidden');
   const ageHours=(new Date(now).getTime()-new Date(c.fetchedAt).getTime())/36e5;
   if(!Number.isFinite(ageHours)||ageHours>maxAgeHours)reasons.push('stale');
 }
 return {eligible:reasons.length===0,reasons,primary:reasons[0]??null};
}
export function summarize(rows,options){
 const byReason={},byPrimaryReason={};let eligible=0;
 const classified=rows.map(r=>{
   const result=classifyCreator(r,options);
   if(result.eligible)eligible++;
   for(const reason of result.reasons)byReason[reason]=(byReason[reason]??0)+1;
   if(result.primary)byPrimaryReason[result.primary]=(byPrimaryReason[result.primary]??0)+1;
   return {...r,...result};
 });
 return {total:rows.length,eligible,ineligible:rows.length-eligible,byReason,byPrimaryReason,creators:classified};
}
