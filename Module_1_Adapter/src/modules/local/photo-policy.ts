import { boundedLimit } from '../../lib/redis.js';
import { HttpError } from '../../lib/errors.js';
import { safeSource } from './image-rules.mjs';

export function photoDailyLimit(raw=process.env.PCI_GOOGLE_PHOTO_DAILY_LIMIT):number {
 const n=Number(raw??20);return Number.isSafeInteger(n)&&n>=0?Math.min(n,25):20;
}
export function photoWidth(){const n=Number(process.env.PCI_GOOGLE_PHOTO_WIDTH_PX??640);return Number.isSafeInteger(n)&&n>=100&&n<=1600?n:640;}
export function publicGooglePhotosEnabled(){return false; // Public delivery is cache-only. Admin preview retains its separate opt-in.}
export async function reserveGooglePhoto(stage:'details'|'media'){
 // Same Redis keys as the existing admin preview, shared across all public/admin requests.
 try{const n=photoDailyLimit();if(!n||!await boundedLimit('local:images:google-preview-'+stage,n,86400))throw new HttpError(429,'GOOGLE_PHOTO_QUOTA','Daily photo allowance exhausted.');}
 catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'GOOGLE_PHOTO_LIMITER','Photo limiter unavailable.');}
}
export async function discoverGoogleWebsite(placeId:string):Promise<string|null>{
 if(process.env.PCI_GOOGLE_WEBSITE_DISCOVERY_ENABLED!=='true')return null;
 const key=process.env.GOOGLE_PLACES_API_KEY;if(!key)return null;
 const raw=Number(process.env.PCI_GOOGLE_WEBSITE_DAILY_LIMIT??5);
 const max=Number.isSafeInteger(raw)&&raw>=0?Math.min(raw,10):5;
 if(!max||!await boundedLimit('local:images:google-website',max,86400))throw new Error('WEBSITE_LOOKUP_LIMIT');
 const r=await fetch('https://places.googleapis.com/v1/places/'+encodeURIComponent(placeId),{headers:{'X-Goog-Api-Key':key,'X-Goog-FieldMask':'websiteUri',Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new Error('WEBSITE_LOOKUP_HTTP_'+r.status);
 const data=await r.json() as {websiteUri?:unknown};
 return typeof data.websiteUri==='string'?safeSource(data.websiteUri)?.href??null:null;
}
