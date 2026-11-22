export declare const SATELLITE_MIN_INTERVAL_MINUTES: Readonly<Record<string,number>>;
export declare function minimumIntervalMinutes(id:string):number;
export declare function effectiveIntervalMinutes(id:string,requested:number):number;
export declare function isDue(lastAttemptAt:string|null|undefined,id:string,requested:number,nowMs?:number):boolean;
