export const RANK_METRICS: ReadonlyArray<'subscribers'|'views'|'videos'>;
export type RawCountRow={channelId:string;subscriberCount?:string|null;viewCount?:string|null;videoCount?:string|null;[key:string]:unknown};
export function compareCounts(a:string,b:string):number;
export function rankedRows<T extends RawCountRow>(rows:T[],metric?:'subscribers'|'views'|'videos'):Array<T & {rank:number|null;rankMetric:string}>;
export function sumCounts<T extends object>(rows:T[],field:keyof T):string;
