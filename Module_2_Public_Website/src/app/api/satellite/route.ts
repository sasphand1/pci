import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const cities=new Set(['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad']);
const missions=new Set(['sentinel1','sentinel2','sentinel5p']);
/** Read-only same-origin proxy. An explicit allowlist prevents arbitrary URLs or SSRF. */
export async function GET(req:NextRequest){
 const metric=req.nextUrl.searchParams.get('metric')||'';
 const city=req.nextUrl.searchParams.get('city')||'';
 const mission=req.nextUrl.searchParams.get('mission')||'';
 let path:string;
 if((metric==='rainfall'||metric==='solar')&&cities.has(city))path=`${metric}/latest?city=${encodeURIComponent(city)}`;
 else if(metric==='natural-events'&&!city&&!mission)path='natural-events/latest';
 else if(metric==='imagery'&&!city&&!mission)path='imagery/latest';
 else if(metric==='gpm-imagery'&&!city&&!mission)path='gpm/imagery/latest';
 else if(metric==='scenes'&&missions.has(mission)&&!city)path=`scenes/latest?mission=${encodeURIComponent(mission)}`;
 else return NextResponse.json({data:[],error:'INVALID_FILTER'},{status:400});
 const api=(process.env.ADAPTER_INTERNAL_URL||process.env.NEXT_PUBLIC_ADAPTER_API_URL||'').replace(/\/$/,'');
 if(!/^https?:\/\//.test(api))return NextResponse.json({data:[],error:'SATELLITE_API_UNCONFIGURED'},{status:503});
 try{
  const response=await fetch(`${api}/api/v1/satellite/${path}`,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)return NextResponse.json({data:[],error:'SATELLITE_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=='object'||!('data' in payload)||!Array.isArray(payload.data))throw Error('Invalid backend response');
  return NextResponse.json({data:payload.data},{headers:{'Cache-Control':'private, max-age=0'}});
 }catch{return NextResponse.json({data:[],error:'SATELLITE_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
