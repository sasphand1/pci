export type Obs={metric?:'fire'|'rainfall'|'solar';location:string;observationKey:string;observedAt:string;payload:Record<string,string|number|boolean>};
export declare const PROVIDERS:Record<string,{label:string;kind:string;implemented:boolean;auth:string|null;minMinutes:number}>;
export declare const CITIES:Record<string,readonly [number,number]>;
export declare function validateProvider(id:string):boolean;
export declare function parseFirmsCsv(input:string):Omit<Obs,'metric'>[];
export declare function parsePower(body:unknown,location:string):Array<Obs & {metric:'rainfall'|'solar'}>;
