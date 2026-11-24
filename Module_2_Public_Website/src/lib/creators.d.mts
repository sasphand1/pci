export const MAX_COMPARE:number;
export function parseCompare(value:string|undefined|null):string[];
export function toggleSlug(list:string[],slug:string):string[];
export function creatorsHref(o?:{search?:string;category?:string;platform?:string;sort?:string;view?:string;page?:number;compare?:string[];open?:boolean}):string;
export function asOfLabel(iso:string|null|undefined):string;
export function leaderIndex(values:(number|null|undefined)[]):number;
export function barPercent(value:number|null|undefined,values:(number|null|undefined)[]):number|null;
export function accountFollowers(row:{accounts?:{platform:string;followers:number|null}[]},platform:string):number|null;
