export type DailyResult={status:'ready'|'insufficient';days:number;summary:string;explanation:string;latest?:number;sampleMean?:number};
export function compareDailySeries(input:unknown[],metric:'rainfall'|'solar',now?:number):DailyResult;
export function summarizeThermalDetections(input:unknown[],now?:number):{count:number;explanation:string};
