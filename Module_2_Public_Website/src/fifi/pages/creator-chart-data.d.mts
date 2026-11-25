export type ChartPoint={time:number;value:number};
export function observedSeries(points:{at:string;value:number}[],days:number):ChartPoint[];
export function intervalRates(points:ChartPoint[]):ChartPoint[];
export function hasChange(points:ChartPoint[]):boolean;
