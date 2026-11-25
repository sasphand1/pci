export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store, max-age=0','X-Content-Type-Options':'nosniff'};
export async function POST(request:Request,{params}:{params:Promise<{placeId:string}>}){
 const {placeId}=await params;
 if(!/^[A-Za-z0-9_-]{10,200}$/.test(placeId)||request.headers.get('sec-fetch-site')==='cross-site')return new Response(null,{status:404,headers});
 const root=(process.env.ADAPTER_INTERNAL_URL||'http://localhost:8080').replace(/\/$/,'');
 try{
  const r=await fetch(`${root}/api/v1/public/local/images/${encodeURIComponent(placeId)}/google`,{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!r.ok)return new Response(null,{status:r.status,headers});
  const data:unknown=await r.json();return Response.json(data,{headers});
 }catch{return new Response(null,{status:502,headers});}
}
