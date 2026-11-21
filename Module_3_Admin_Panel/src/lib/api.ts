export const ADAPTER_API=(process.env.NEXT_PUBLIC_ADAPTER_API_URL || 'http://localhost:8080').replace(/\/$/,'');
export const SESSION_EXPIRED_EVENT='pci:session-expired';
export class ApiError extends Error {constructor(public status:number, public code:string,message:string){super(message);this.name='ApiError';}}
export type ApiResponse<T>={data:T;meta?:Record<string,unknown>};
type ApiOptions={method?:'GET'|'POST'|'PUT'|'PATCH'|'DELETE';body?:unknown;csrf?:string;timeoutMs?:number;background?:boolean};
async function call<T>(path:string, options:ApiOptions):Promise<T>{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),options.timeoutMs??15000);
 try{
   const headers:Record<string,string>={Accept:'application/json'};
   if(options.body!==undefined)headers['Content-Type']='application/json';
   if(options.background)headers['X-Pci-Background']='1';
   if(options.csrf && options.method && options.method!=='GET') headers['X-CSRF-Token']=options.csrf;
   const response=await fetch(`${ADAPTER_API}/api/v1${path}`,{
     method:options.method??'GET',credentials:'include',cache:'no-store',headers,
     body:options.body===undefined?undefined:JSON.stringify(options.body),signal:controller.signal
   });
   const raw=await response.text();let payload:unknown=null;
   try{payload=raw?JSON.parse(raw):null;}catch{throw new ApiError(response.status,'BAD_RESPONSE','Backend returned an invalid response.');}
   if(!response.ok){
      if(response.status===401&&path!=='/admin/auth/login'&&path!=='/admin/auth/me'&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      const record=payload&&typeof payload==='object'?payload as Record<string,unknown>:{};
      const err=record.error&&typeof record.error==='object'?record.error as Record<string,unknown>:record;
      throw new ApiError(response.status,String(err.code||'HTTP_ERROR'),String(err.message||`Request failed (HTTP ${response.status}).`));
   }
   if(!payload || typeof payload!=='object' || !('data' in payload))throw new ApiError(response.status,'BAD_RESPONSE','Backend response lacks a data object.');
   return (payload as ApiResponse<T>).data;
 }catch(e){if(e instanceof ApiError)throw e;if(e instanceof Error&&e.name==='AbortError')throw new ApiError(408,'TIMEOUT','Request timed out.');throw new ApiError(0,'NETWORK','Cannot reach Module 1. Check port 8080, allowed ADMIN_ORIGIN and backend health.');}
 finally{clearTimeout(timer);}
}
/** During a deploy the panel can be newer than the API. An older API refuses the X-Pci-Background header at the browser's
 * pre-flight check, which looks like a network failure. A quiet request then repeats once without the header: the old API
 * simply treats it as normal activity, so nothing breaks while the two modules finish deploying. */
export async function api<T>(path:string, options:ApiOptions={}):Promise<T>{
 try{return await call<T>(path,options);}
 catch(e){if(options.background&&e instanceof ApiError&&e.code==='NETWORK')return call<T>(path,{...options,background:false});throw e;}
}
export const isApiUpdating=(e:unknown)=>e instanceof ApiError&&e.status===404;
export function errorText(e:unknown){
 if(e instanceof ApiError){
  if(e.code==='RATE_LIMIT'||e.status===429)return 'Too many attempts. Wait a few minutes and try again.';
  if(e.code==='CSRF')return 'Your session changed. Reload the page and try again.';
  if(e.status===403)return 'Your role cannot do this.';
  if(e.status>=500)return 'The server had a problem. Try again in a moment. If it keeps happening, check System health.';
 }
 return e instanceof Error?e.message:'An unexpected error occurred.';
}
export function fmtDate(value:string|null|undefined){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.valueOf())?'—':new Intl.DateTimeFormat('en-PK',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Karachi'}).format(d)+' PKT';}
export function fmtNum(value:number|string|null|undefined){if(value==null)return '—';const valueStr=String(value);if(!/^\d+$/.test(valueStr))return '—';return BigInt(valueStr).toLocaleString('en-US');}
export const roleCan=(role:string|undefined,allowed:string[])=>Boolean(role&&allowed.includes(role));
