// Same-origin image delivery. No external URL is accepted from the browser.
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{placeId:string}>}){
 const {placeId}=await params;
 if(!/^[A-Za-z0-9_-]{10,200}$/.test(placeId))return new Response(null,{status:404});
 const root=(process.env.ADAPTER_INTERNAL_URL||'http://localhost:8080').replace(/\/$/,'');
 try{
  const r=await fetch(`${root}/api/v1/public/local/images/${encodeURIComponent(placeId)}`,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
  const type=r.headers.get('content-type')?.split(';')[0]??'';
  if(!r.ok||!['image/jpeg','image/png','image/webp'].includes(type)||!r.body||Number(r.headers.get('content-length')??0)>200000)return new Response(null,{status:404});
  const reader=r.body.getReader();let total=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>200000){await reader.cancel();return new Response(null,{status:502});}chunks.push(value);}}finally{reader.releaseLock();}
  if(!total)return new Response(null,{status:404});const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new Response(bytes,{headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300, must-revalidate'}});
 }catch{return new Response(null,{status:502});}
}
