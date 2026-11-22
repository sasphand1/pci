import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(){
 const endpoint=(process.env.ADAPTER_INTERNAL_URL||process.env.NEXT_PUBLIC_ADAPTER_API_URL||'http://localhost:8080').replace(/\/$/,'')+'/api/v1/public/events';
 try{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),6500);
  let response:Response;
  try{response=await fetch(endpoint,{headers:{Accept:'application/json'},cache:'no-store',signal:controller.signal});}finally{clearTimeout(timer);}
  if(!response.ok)return NextResponse.json({data:[],error:'EVENTS_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});
  const value=await response.json();if(!Array.isArray(value?.data))throw new Error('Malformed events response');
  return NextResponse.json({data:value.data},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({data:[],error:'EVENTS_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
