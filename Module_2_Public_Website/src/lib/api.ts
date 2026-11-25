import { unstable_rethrow } from 'next/navigation';
const apiRoot=(process.env.ADAPTER_INTERNAL_URL||'http://localhost:8080').replace(/\/$/,'');
export async function adapterGet<T>(path:string):Promise<T|null>{
  if(!path.startsWith('/api/v1/')||path.includes('://'))throw new Error('Invalid API path');
  try{
    const r=await fetch(`${apiRoot}${path}`,{cache:'no-store',headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
    if(!r.ok)return null;
    const body:unknown=await r.json();
    if(!body||typeof body!=='object')return null;
    return body as T;
  }catch(e){unstable_rethrow(e);console.error('Adapter public API unavailable for:',path,e instanceof Error?e.message:'error');return null;}
}
export function qs(obj:Record<string,string|number|undefined>){const s=new URLSearchParams();for(const [k,v] of Object.entries(obj)){if(v!==undefined&&v!=='')s.set(k,String(v));}return s.toString();}
