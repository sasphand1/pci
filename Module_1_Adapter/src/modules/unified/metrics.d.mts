export type Platform='all'|'youtube'|'instagram'|'tiktok';
export type Metric='views'|'subscribers'|'videos';
export type MetricAccount={url:string;subscribers?:string|null;followers?:string|null;views?:string|null;videos?:string|null;posts?:string|null;fetchedAt?:string|null};
export type Person={id:string;slug:string;displayName:string;humanReviewStatus:'approved'|'pending'|'rejected';enabled:boolean;thumbnailUrl?:string|null;categories:{slug:string;label:string}[];youtube:MetricAccount|null;instagram:MetricAccount|null};
export type Ranked=Person & {platform:Platform;subscriberCount:string|null;viewCount:string|null;videoCount:string|null;rank:number|null;rankMetric:Metric;metricSources:Record<Metric,string[]>;platforms:{youtube:string|null;instagram:string|null;tiktok:null};disclaimer:string};
export declare const PLATFORMS:readonly Platform[];
export declare const METRICS:readonly Metric[];
export declare const METRIC_LABELS:Readonly<Record<Metric,string>>;
export declare function projectCreator(person:Person,platform?:Platform):Omit<Ranked,'rank'|'rankMetric'>;
export declare function rankPeople(people:Person[],options?:{metric?:Metric;platform?:Platform;limit?:number;category?:string}):{data:Ranked[];total:number;known:number};
export declare function aggregate(people:Person[],platform?:Platform):{creators:number;subscribers:string|null;views:string|null;posts:string|null};

export declare function rankAllRounders(people:Person[],options?:{limit?:number;category?:string}):{
 data:(Omit<Ranked,'rankMetric'> & {rankMetric:'allrounders';rank:number;allRounderScore:number;score:number})[];
 known:number;total:number;method:string};
