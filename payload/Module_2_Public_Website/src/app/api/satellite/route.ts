import {NextRequest,NextResponse} from 'next/server';

export const dynamic='force-dynamic';
const cities=new Set(['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad']);
const metrics=new Set(['rainfall','solar']);

/** Same-origin read-only proxy: browser never receives the backend's internal URL. */
export async function GET(req:NextRequest){
  const metric=req.nextUrl.searchParams.get('metric')||'';
  const city=req.nextUrl.searchParams.get('city')||'';
  if(!metrics.has(metric)||!cities.has(city))return NextResponse.json({data:[],error:'INVALID_FILTER'},{status:400});
  const api=(process.env.ADAPTER_INTERNAL_URL||process.env.NEXT_PUBLIC_ADAPTER_API_URL||'').replace(/\/$/,'');
  if(!/^https?:\/\//.test(api))return NextResponse.json({data:[],error:'SATELLITE_API_UNCONFIGURED'},{status:503});
  try{
    const response=await fetch(`${api}/api/v1/satellite/${metric}/latest?city=${encodeURIComponent(city)}`,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok)return NextResponse.json({data:[],error:'SATELLITE_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
    const payload:unknown=await response.json();
    if(!payload||typeof payload!=='object'||!('data' in payload)||!Array.isArray(payload.data))throw Error('Malformed backend response');
    return NextResponse.json({data:payload.data},{headers:{'Cache-Control':'no-store'}});
  }catch{
    return NextResponse.json({data:[],error:'SATELLITE_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
