import type {BucketVideo,BucketObservation} from '../../lib/creators-bucket';
export const PLATFORMS:string[];
export type AudienceRow={platform:string;linked:boolean;count:number|null};
export function platformAudience(accounts:{platform:string;followersCount?:number|null}[]):AudienceRow[];
export function recordedTotal(rows:AudienceRow[]):number|null;
export function historyWindow(points:BucketObservation[],days:number):BucketObservation[];
export function rankContent(videos:BucketVideo[]):BucketVideo[];
