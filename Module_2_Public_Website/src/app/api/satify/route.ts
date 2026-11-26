import {NextRequest,NextResponse} from 'next/server';
export const dynamic='force-dynamic';
/** Same-origin proxy to the Satify Hub (Module 1). Fixed allowlist: no arbitrary URLs. */
const api=()=>(process.env.ADAPTER_INTERNAL_URL||process.env.NEXT_PUBLIC_ADAPTER_API_URL||'').replace(/\/$/,'');
const PLACE=/^[a-z0-9]{2,20}$/;
async function forward(path:string,init?:RequestInit){
 const base=api();if(!/^https?:\/\//.test(base))return NextResponse.json({error:'SATIFY_API_UNCONFIGURED'},{status:503});
 try{
  const r=await fetch(`${base}/api/v1/satify/${path}`,{...init,cache:'no-store',signal:AbortSignal.timeout(10000),headers:{Accept:'application/json',...(init?.body?{'Content-Type':'application/json'}:{})}});
  const body=await r.json().catch(()=>({}));
  return NextResponse.json(body,{status:r.status,headers:{'Cache-Control':r.ok&&!init?.method?'public, max-age=60':'no-store'}});
 }catch{return NextResponse.json({error:'SATIFY_BACKEND_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function GET(req:NextRequest){
 const what=req.nextUrl.searchParams.get('what'),place=req.nextUrl.searchParams.get('city')??'';
 if(what==='now'&&PLACE.test(place))return forward(`now?city=${encodeURIComponent(place)}`);
 if(what==='packs')return forward('packs');
 return NextResponse.json({error:'INVALID_FILTER'},{status:400});
}
export async function POST(req:NextRequest){
 const what=req.nextUrl.searchParams.get('what');
 if(what!=='interest'&&what!=='schools')return NextResponse.json({error:'INVALID_FILTER'},{status:400});
 const text=await req.text();if(text.length>4000)return NextResponse.json({error:'TOO_LARGE'},{status:413});
 return forward(what,{method:'POST',body:text});
}
