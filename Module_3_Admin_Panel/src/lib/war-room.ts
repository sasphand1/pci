// The engine exposes job and destination state, not provider audience telemetry.
export type FeedbackJob={id:string;state:string;deliveries:ReadonlyArray<{status:string}>};
export const unavailableMetrics=['Messages sent','Audience reached','Post views','Impressions','Engagements','Website visits','Campaign clicks','Active subscribers','Remaining quotas'] as const;
export function scopeCampaigns<T extends FeedbackJob>(jobs:readonly T[],id:string):T[]{return id==='all'?[...jobs]:jobs.filter(j=>j.id===id);}
export function campaignFeedback(jobs:readonly FeedbackJob[]|null){
 const byStatus={delivered:0,failed:0,uncertain:0,pending:0,claimed:0,cancelled:0};
 for(const job of jobs??[]){if(job.state!=='confirmed')continue;for(const d of job.deliveries){if(Object.hasOwn(byStatus,d.status))byStatus[d.status as keyof typeof byStatus]++;}}
 return {campaigns:jobs?.length??null,delivered:jobs?byStatus.delivered:null,attention:jobs?byStatus.failed+byStatus.uncertain:null,pending:jobs?byStatus.pending+byStatus.claimed:null,byStatus,unavailable:unavailableMetrics};
}
