export type FixedCohort={videoCount:number;observationCount:number;points:{at:string;total:number;median:number}[]};
export function fixedVideoCohort(rows:{videoId:string;metric:string;value:string|number;at:string|Date}[],catalogue:{videoId:string;publishedAt:string|Date|null}[],now?:number):FixedCohort|null;
