import type { WallSession } from './types';
export const adapterPublicUrl=(process.env.NEXT_PUBLIC_ADAPTER_API_URL||'http://localhost:8080').replace(/\/$/,'');
const storageKey='pci-wall-session-v1';
export function loadWallSession():WallSession|null{if(typeof window==='undefined')return null;try{const s=sessionStorage.getItem(storageKey);return s?JSON.parse(s) as WallSession:null;}catch{return null;}}
export function saveWallSession(session:WallSession|null){if(typeof window==='undefined')return;if(session)sessionStorage.setItem(storageKey,JSON.stringify(session));else sessionStorage.removeItem(storageKey);}
export class ClientApiError extends Error {constructor(public code:string,message:string,public status:number){super(message);}}
export async function wallRequest<T>(path:string,options:{method?:string;body?:unknown;token?:string}={}):Promise<T>{
 if(!path.startsWith('/wall/'))throw new ClientApiError('BAD_PATH','Invalid API path',400);
 const r=await fetch(`${adapterPublicUrl}/api/v1${path}`,{method:options.method||'GET',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{}),...(options.token?{'Authorization':`Bearer ${options.token}`}:{})},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});
 let parsed:unknown=null;try{parsed=await r.json();}catch{ /* server error without JSON */ }
 const response=parsed as {data?:T;error?:{code:string;message:string}}|null;
 if(!r.ok)throw new ClientApiError(response?.error?.code||'HTTP_ERROR',response?.error?.message||`Request failed (${r.status})`,r.status);
 if(!response||!('data'in response))throw new ClientApiError('BAD_RESPONSE','Unexpected server response',502);
 return response.data as T;
}
