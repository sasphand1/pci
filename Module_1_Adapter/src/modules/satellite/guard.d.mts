export declare const SATELLITE_RATE_WINDOW_SECONDS: number;
export declare const SATELLITE_RATE_MAXIMUM: number;
export declare const SATELLITE_MAX_UPSTREAM_BYTES: number;
export declare function isPublicSatelliteRead(path:string,method:string): boolean;
export declare function readLimitedText(response:Response,maxBytes?:number): Promise<string>;
export declare function satellitePermission(limiter:(key:string,max:number,seconds:number)=>Promise<boolean>,key:string):Promise<'allow'|'rate_limited'|'unavailable'>;
