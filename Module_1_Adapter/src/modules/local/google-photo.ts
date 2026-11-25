export type PhotoCredit={displayName:string;uri:string|null;photoUri:string|null};
export type GooglePhotoPreview={photoUri:string;googleMapsUri:string|null;authorAttributions:PhotoCredit[]};
export class GooglePhotoError extends Error {
 readonly status:number;readonly code:string;
 constructor(status:number,code:string,message:string){super(message);this.status=status;this.code=code;}
}
const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
function trustedUrl(v:unknown,kind:'photo'|'maps'):string|null {
 if(typeof v!=='string'||v.length>4096)return null;
 try{const u=new URL(v);const h=u.hostname.toLowerCase();if(u.protocol!=='https:'||u.username||u.password||u.port)return null;
 const ok=kind==='photo'?['googleusercontent.com','ggpht.com'].some(d=>h===d||h.endsWith('.'+d)):['google.com','maps.google.com','www.google.com','maps.app.goo.gl'].includes(h);
 return ok?u.href:null;}catch{return null;}
}
function upstreamError(status:number,stage:string):GooglePhotoError {
 if(status===429)return new GooglePhotoError(429,'GOOGLE_PHOTO_QUOTA',`Google ${stage} quota reached. No automatic retry.`);
 if(status===404)return new GooglePhotoError(404,'GOOGLE_PHOTO_UNAVAILABLE',`Google ${stage} returned no available photo.`);
 return new GooglePhotoError(502,'GOOGLE_PHOTO_UPSTREAM',`Google ${stage} returned HTTP ${status}.`);
}
// No content persistence. Fetch photo metadata immediately before one media request.
export async function fetchGooglePhoto(placeId:string,key:string,reserve:(stage:'details'|'media')=>Promise<void>,fetcher:typeof fetch=fetch,width=640):Promise<GooglePhotoPreview>{
 if(!/^[A-Za-z0-9_-]{10,200}$/.test(placeId))throw new GooglePhotoError(400,'INVALID_PLACE_ID','Invalid place ID.');
 const root='https://places.googleapis.com/v1/places/';
 const request=async(url:string,headers:Record<string,string>,stage:string)=>{
  let r:Response;try{r=await fetcher(url,{headers:{'X-Goog-Api-Key':key,Accept:'application/json',...headers},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});}catch{throw new GooglePhotoError(502,'GOOGLE_PHOTO_NETWORK',`Google ${stage} connection failed or timed out.`);}
  if(!r.ok)throw upstreamError(r.status,stage);
  try{return record(await r.json());}catch{throw new GooglePhotoError(502,'GOOGLE_PHOTO_RESPONSE',`Google ${stage} returned invalid JSON.`);}
 };
 await reserve('details');
 const details=await request(root+encodeURIComponent(placeId),{'X-Goog-FieldMask':'photos'},'photo metadata');
 const photos=Array.isArray(details.photos)?details.photos:[];
 const prefix=`places/${placeId}/photos/`;
 const photo=photos.map(record).find(p=>typeof p.name==='string'&&p.name.startsWith(prefix)&&/^[A-Za-z0-9_-]{1,2048}$/.test(p.name.slice(prefix.length)));
 if(!photo||typeof photo.name!=='string')throw new GooglePhotoError(404,'GOOGLE_PHOTO_UNAVAILABLE','No photo metadata available for this restaurant.');
 const authorAttributions=(Array.isArray(photo.authorAttributions)?photo.authorAttributions:[]).map(record).map(a=>({displayName:typeof a.displayName==='string'?a.displayName:'',uri:trustedUrl(a.uri,'maps'),photoUri:trustedUrl(a.photoUri,'photo')}));
 if(authorAttributions.some(a=>!a.displayName))throw new GooglePhotoError(502,'GOOGLE_PHOTO_ATTRIBUTION','Photo attribution is incomplete.');
 await reserve('media');
 const media=await request(`https://places.googleapis.com/v1/${photo.name}/media?maxWidthPx=${Number.isSafeInteger(width)&&width>=100&&width<=1600?width:640}&skipHttpRedirect=true`,{},'photo media');
 const photoUri=trustedUrl(media.photoUri,'photo');
 if(!photoUri)throw new GooglePhotoError(502,'GOOGLE_PHOTO_RESPONSE','Google returned an unrecognized photo URL.');
 return {photoUri,googleMapsUri:trustedUrl(photo.googleMapsUri,'maps'),authorAttributions};
}
