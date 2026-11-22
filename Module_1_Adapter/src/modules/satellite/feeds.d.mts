export declare const PAKISTAN_BBOX:readonly number[];
export declare const COPERNICUS_IDS:Readonly<Record<'sentinel1'|'sentinel2'|'sentinel5p',string>>;
export declare const GIBS_LAYER:string;
export interface FeedRecord {metric:'natural_event'|'scene';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown>}
export declare function inRegion(lon:number,lat:number):boolean;
export declare function eonetUrl():string;
export declare function copernicusUrl(id:'sentinel1'|'sentinel2'|'sentinel5p',now?:Date):string;
export declare function parseEonet(body:unknown):FeedRecord[];
export declare function parseCopernicus(body:unknown,id:'sentinel1'|'sentinel2'|'sentinel5p'):FeedRecord[];
export declare function gibsTileURL(day:string):string;
export declare function gibsDisplayTemplate(day:string):string;
export declare function gpmWmsURL(day:string,templated?:boolean):string;

export declare function usgsUrl(now?:Date):string;
export declare function parseUsgs(body:unknown):Array<{metric:'earthquake';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown>}>;
