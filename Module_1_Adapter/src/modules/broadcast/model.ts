export const destinations=['youtube','instagram','tiktok'] as const;
export type Destination=typeof destinations[number];
export type JobState='draft'|'confirmed'|'cancelled';
export type DeliveryState='pending'|'claimed'|'delivered'|'failed'|'uncertain'|'cancelled';
export type VisibleState=JobState|'queued'|'dispatching'|'delivered'|'partial'|'failed'|'attention';
export type Delivery={id:string;destination:Destination;state:DeliveryState;claim_deadline:Date|string|null;external_id:string|null;result_code:string|null};
export type Draft={requestId:string;title:string;body:string;mediaRef:string|null;destinations:Destination[]};
export type Receipt={outcome:'delivered'|'failed'|'uncertain';externalId:string|null;code:string|null};

export function effectiveDeliveryState(d:Pick<Delivery,'state'|'claim_deadline'>, now=Date.now()):DeliveryState{
 return d.state==='claimed'&&d.claim_deadline!==null&&new Date(d.claim_deadline).getTime()<=now?'uncertain':d.state;
}
export function summarize(state:JobState, deliveries:Pick<Delivery,'state'|'claim_deadline'>[], now=Date.now()):VisibleState{
 if(state!=='confirmed')return state;
 const statuses=deliveries.map(d=>effectiveDeliveryState(d,now));
 if(!statuses.length||statuses.includes('uncertain'))return 'attention';
 if(statuses.every(s=>s==='delivered'))return 'delivered';
 if(statuses.includes('claimed'))return 'dispatching';
 if(statuses.includes('pending'))return statuses.every(s=>s==='pending')?'queued':'dispatching';
 if(statuses.includes('delivered'))return 'partial';
 if(statuses.every(s=>s==='cancelled'))return 'cancelled';
 return 'failed';
}
export function sameDraft(a:Omit<Draft,'requestId'>,b:Omit<Draft,'requestId'>):boolean{
 return a.title===b.title&&a.body===b.body&&a.mediaRef===b.mediaRef&&[...a.destinations].sort().join(',')===[...b.destinations].sort().join(',');
}
export function sameReceipt(a:Receipt,b:Receipt):boolean{
 return a.outcome===b.outcome&&a.externalId===b.externalId&&a.code===b.code;
}
export function canCancel(state:JobState, states:DeliveryState[]):boolean{
 return state==='draft'||(state==='confirmed'&&states.length>0&&states.every(s=>s==='pending'));
}
