export const MAX_IMAGE_BYTES:number;
export const MAX_CACHE_BYTES:number;
export function publicIPv4(ip:string):boolean;
export function safeSource(raw:string):URL|null;
export function commonsQuery(name:string,city:string,area?:string|null):string;
export function allowedCommonsLicense(s:unknown):boolean;

export function normalizedName(s:unknown):string;
export function identityWords(name:string):string[];
export function extractWebsiteImages(html:string,base:string,name:string):{url:string;kind:string;label:string;score:number}[];
export function knownWebsite(name:string,city:string):string|null;
export function osmWebsiteQuery(name:string,city:string):string|null;
export function osmWebsiteCandidates(data:unknown,name:string,area?:string|null):string[];
export function commonsPhotoTitle(title:unknown,name:string):boolean;
