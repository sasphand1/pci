// Network calls to the official TikTok endpoints only. Fixed hosts; user input never becomes a URL.
// Never logs request or response bodies: they contain tokens.
import {REVOKE_URL,TOKEN_URL,USER_FIELDS,USER_INFO_URL,VIDEO_FIELDS,VIDEO_LIST_URL,VIDEO_PAGE_MAX} from './core.mjs';
import type {TiktokSettings} from './settings.js';

const TIMEOUT_MS=15_000,MAX_BODY=2_000_000;
export type Raw={status:number;body:unknown};
async function call(url:string,init:RequestInit):Promise<Raw>{
 const res=await fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(TIMEOUT_MS)});
 const reader=res.body?.getReader();
 const decoder=new TextDecoder();let text='',bytes=0;
 if(reader){try{while(true){const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;if(bytes>MAX_BODY){await reader.cancel();return {status:502,body:{error:{code:'response_too_large'}}};}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}
 let body:unknown=null;try{body=text?JSON.parse(text):null;}catch{body={error:{code:'invalid_json'}};}
 return {status:res.status,body};
}
const form=(o:Record<string,string>)=>new URLSearchParams(o).toString();
const formHeaders={'Content-Type':'application/x-www-form-urlencoded','Cache-Control':'no-cache'};

export const exchangeCode=(s:TiktokSettings,code:string)=>call(TOKEN_URL,{method:'POST',headers:formHeaders,
 body:form({client_key:s.clientKey,client_secret:s.clientSecret,code,grant_type:'authorization_code',redirect_uri:s.redirectUri})});
export const refreshToken=(s:TiktokSettings,refresh:string)=>call(TOKEN_URL,{method:'POST',headers:formHeaders,
 body:form({client_key:s.clientKey,client_secret:s.clientSecret,grant_type:'refresh_token',refresh_token:refresh})});
export const revokeToken=(s:TiktokSettings,token:string)=>call(REVOKE_URL,{method:'POST',headers:formHeaders,
 body:form({client_key:s.clientKey,client_secret:s.clientSecret,token})});

/** Only request fields whose scope was granted. */
export function userFieldsFor(scopes:string[]):string[]{
 return Object.entries(USER_FIELDS).filter(([scope])=>scopes.includes(scope)).flatMap(([,f])=>f);
}
export function userInfo(token:string,scopes:string[]):Promise<Raw>{
 const u=new URL(USER_INFO_URL);u.searchParams.set('fields',userFieldsFor(scopes).join(','));
 return call(u.toString(),{method:'GET',headers:{Authorization:`Bearer ${token}`}});
}
export function listVideos(token:string,cursor:number|null):Promise<Raw>{
 const u=new URL(VIDEO_LIST_URL);u.searchParams.set('fields',VIDEO_FIELDS.join(','));
 return call(u.toString(),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
  body:JSON.stringify(cursor===null?{max_count:VIDEO_PAGE_MAX}:{max_count:VIDEO_PAGE_MAX,cursor})});
}
