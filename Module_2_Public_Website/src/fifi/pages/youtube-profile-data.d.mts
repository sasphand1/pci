export type Band={label:string;value:number};
export type Point={time:number;value:number};
export type AgePoint={videoId:string;title:string;days:number;value:number};
export type Peer={slug:string;name:string;subscribers:number|null;views:number|null;publicVideos:number|null;dailyRates:Point[];bands:Band[]};
export const VIEW_BANDS:string[];
export function alignDaily(peers:Peer[]):{day:string;values:(number|null)[]}[];
export function localBands(rows:Band[]):Band[];
