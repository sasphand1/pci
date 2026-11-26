export type GribField={edition:1|2;param:string;levelType:number;refTime:string;validTime:string;ni:number;nj:number;lat1:number;lon1:number;lat2:number;lon2:number;di:number;dj:number;scan:number;values:Float64Array};
export declare function decodeGrib(buf:Uint8Array|ArrayBuffer):GribField[];
export declare function valueAt(f:GribField,lat:number,lon:number):number;
