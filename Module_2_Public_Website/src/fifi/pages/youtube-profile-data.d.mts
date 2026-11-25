import type {BucketVideo} from '../../lib/creators-bucket';
export type Band={label:string;value:number};
export const AGE_BANDS:string[];
export const VIEW_BANDS:string[];
export function observedPortfolio(videos:BucketVideo[]):{known:BucketVideo[];total:number|null;median:number|null;topShare:number|null;topFiveShare:number|null;age:Band[];bands:Band[];dated:number};
