import type {OpenObs} from './open-data.mjs';
export declare const METNO_URL:string;
export declare function metnoUserAgent(env?:Record<string,string|undefined>):string;
export declare function metnoUrl(city:string):string;
export declare function symbolToCode(symbol:unknown):number|null;
export declare function heatIndexC(tC:number|null,rh:number|null):number|null;
export declare function parseMetno(body:unknown,city:string,now?:number):OpenObs[];
