/** Public-HTTPS adapter helpers. No cookies, login or anti-bot workarounds. */
import {safeAvatarUrl} from '../../providers/avatar.js';
import {classifyHttpFailure} from './monitor-rules.js';

const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
export function metaProperty(html:string,property:string):string|null {
  if(html.length>300_000 || !/^[a-z]+:[a-z_]+$/.test(property))return null;
  for(const m of html.matchAll(/<meta\s+[^>]*>/gi)){
    const attrs=new Map<string,string>();
    for(const a of m[0].matchAll(/([a-zA-Z:-]+)\s*=\s*(["'])(.*?)\2/gs))attrs.set(a[1].toLowerCase(),decode(a[3]));
    if((attrs.get('property')??attrs.get('name'))===property)return attrs.get('content')??null;
  }
  return null;
}
export function parseInstagramPublicAvatar(html:string,handle:string):string|null {
  if(!/^[a-zA-Z0-9._]{1,30}$/.test(handle))return null;
  const canonical=metaProperty(html,'og:url');
  if(!canonical)return null;
  try {
    const u=new URL(canonical);
    if(u.protocol!=='https:' || !['www.instagram.com','instagram.com'].includes(u.hostname) ||
      u.pathname.replace(/\/$/,'').toLowerCase()!==`/${handle.toLowerCase()}`)return null;
  }catch{return null;}
  const image=metaProperty(html,'og:image');
  return image?safeAvatarUrl(image):null;
}
/** Bound upstream response bodies even when Content-Length is absent. */
export async function boundedResponseText(response:Response,maxBytes:number):Promise<string|null> {
  if(!response.body)return null;
  const reader=response.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {
    while(true){
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;
      if(size>maxBytes){await reader.cancel();return null;}
      chunks.push(value);
    }
    const buffer=new Uint8Array(size);let offset=0;
    for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
    return new TextDecoder().decode(buffer);
  }finally{reader.releaseLock();}
}

export type AvatarProbe={url:string|null;status:number|null;error?:'BLOCKED'|'SHAPE_CHANGED'|'UNAVAILABLE'|'TIMEOUT'|'DISABLED'|'INVALID'};
/** Explicitly opt-in and subject to service access terms. Does not follow redirects.
 * Never throws: the result says why no picture was found so the monitor can tell
 * "blocked" from "page changed" from "no network". */
export async function probeInstagramAvatar(handle:string,fetchImpl:typeof fetch=fetch):Promise<AvatarProbe> {
  if(process.env.PCI_INSTAGRAM_HTTP_AVATARS!=='true')return {url:null,status:null,error:'DISABLED'};
  if(!/^[a-zA-Z0-9._]{1,30}$/.test(handle))return {url:null,status:null,error:'INVALID'};
  let response:Response;
  try {
    response=await fetchImpl(`https://www.instagram.com/${encodeURIComponent(handle)}/`,{
      headers:{accept:'text/html'},redirect:'manual',signal:AbortSignal.timeout(8500)});
  }catch{return {url:null,status:null,error:'TIMEOUT'};}
  const status=response.status;
  if(status>=300&&status<400)return {url:null,status,error:'BLOCKED'};
  if(!response.ok)return {url:null,status,error:classifyHttpFailure(status)};
  if(!response.headers.get('content-type')?.includes('text/html')||Number(response.headers.get('content-length')??0)>300_000)
    return {url:null,status,error:'SHAPE_CHANGED'};
  let html:string|null=null;
  try{html=await boundedResponseText(response,300_000);}catch{return {url:null,status,error:'TIMEOUT'};}
  if(!html)return {url:null,status,error:'SHAPE_CHANGED'};
  const url=parseInstagramPublicAvatar(html,handle);
  return url?{url,status}:{url:null,status,error:classifyHttpFailure(status,html)};
}
export async function requestPublicInstagramAvatar(handle:string):Promise<string|null> {
  return (await probeInstagramAvatar(handle)).url;
}
