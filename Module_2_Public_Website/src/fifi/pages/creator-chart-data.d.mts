export type ChartPoint={time:number;value:number};
export function observedSeries(points:{at:string;value:number}[]|undefined,days:number):ChartPoint[];
export function intervalRates(points:ChartPoint[]):ChartPoint[];
export function hasChange(points:ChartPoint[]):boolean;
export function windowChange(points:ChartPoint[]):number|null;
export function sparkPoints(points:ChartPoint[],w?:number,h?:number,pad?:number):string;
export type ProfileView='all'|'youtube'|'instagram'|'tiktok';
export function profileViews(platforms:string[],requested:string|null|undefined):{views:ProfileView[];initial:ProfileView};
