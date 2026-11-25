import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
const cities=new Set(['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad']);
/** City-specific metrics → Module 1 path. */
const perCity:Record<string,(c:string)=>string>={
 'rainfall':c=>`rainfall/latest?city=${c}`,'solar':c=>`solar/latest?city=${c}`,
 'rainfall-history':c=>`rainfall/history?city=${c}&days=30`,'solar-history':c=>`solar/history?city=${c}&days=30`,
 'air-quality':c=>`air-quality/latest?city=${c}`,'air-quality-history':c=>`air-quality/history?city=${c}&hours=48`,
 'weather':c=>`weather/latest?city=${c}`,'insights':c=>`insights?city=${c}`
};
/** Region-wide metrics → Module 1 path. */
const regional:Record<string,string>={
 'natural-events':'natural-events/latest','earthquakes':'earthquakes/latest','imagery':'imagery/latest','gpm-imagery':'gpm/imagery/latest',
 'imagery-layers':'imagery/layers','alerts':'alerts/latest','rivers':'rivers/latest','space-weather':'space-weather/latest',
 'air-stations':'air-stations/latest','orbits':'orbits/latest','rankings':'rankings/weekly'
};
/** Read-only same-origin proxy. A fixed allowlist of metrics prevents arbitrary URLs or SSRF. */
export async function GET(req:NextRequest){
 const metric=req.nextUrl.searchParams.get('metric')||'';
 const city=req.nextUrl.searchParams.get('city')||'';
 let path:string;
 if(Object.hasOwn(perCity,metric)&&cities.has(city))path=perCity[metric](encodeURIComponent(city));
 else if(Object.hasOwn(regional,metric)&&!city)path=regional[metric];
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
