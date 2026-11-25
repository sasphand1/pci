"use client";
import { useEffect, useRef, useState } from 'react';
import type { PubPlace } from '@/lib/public';
type LivePhoto={photoUri:string;googleMapsUri:string;authorAttributions:{displayName:string;uri:string|null;photoUri:string|null}[]};
export const restaurantPhotoUrl=(p:PubPlace)=>p.image ? `/api/local-image/${encodeURIComponent(p.placeId)}?v=${encodeURIComponent(p.image.version)}` : null;
export function RestaurantCredit({p}:{p:PubPlace}){
 if(!p.image)return null;
 return <a href={p.image.permissionUrl} target="_blank" rel="noopener noreferrer" className="block break-words text-[10px] leading-tight text-muted-foreground underline" title="Photo source and licence">Photo: {p.image.attribution} - {p.image.licence}</a>;
}
function PhotoView({p,compact=false}:{p:PubPlace;compact?:boolean}){
 const cached=restaurantPhotoUrl(p),[failed,setFailed]=useState(false),[live,setLive]=useState<LivePhoto|null>(null),[loading,setLoading]=useState(false);
 const box=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(cached||!p.livePhoto||!box.current)return;
  const controller=new AbortController();let observer:IntersectionObserver|undefined;let started=false;
  const load=()=>{if(started)return;started=true;observer?.disconnect();setLoading(true);
   void (async()=>{try{
    const r=await fetch(`/api/local-google-photo/${encodeURIComponent(p.placeId)}`,{method:'POST',cache:'no-store',signal:controller.signal});
    if(!r.ok)return;const payload=await r.json() as {data?:LivePhoto};
    if(!controller.signal.aborted&&payload.data?.photoUri&&payload.data.googleMapsUri&&Array.isArray(payload.data.authorAttributions))setLive(payload.data);
   }catch{/* fail closed, no retry */}finally{if(!controller.signal.aborted)setLoading(false);}})();
  };
  if(typeof IntersectionObserver!=='undefined'){observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))load();});observer.observe(box.current);}else load();
  return ()=>{observer?.disconnect();controller.abort();};
 },[cached,p.livePhoto,p.placeId]);
 const url=failed?null:cached??live?.photoUri??null;
 return <div className={compact?'w-20 shrink-0':'mb-2 min-w-0 w-full'}>
  <div ref={box} className={compact?'grid h-16 w-20 place-items-center overflow-hidden rounded-lg bg-muted':'grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-lg bg-muted'}>
   {url?<img src={url} alt={p.name} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-cover" onError={()=>setFailed(true)}/>:<span className="px-1 text-center text-[10px] leading-tight text-muted-foreground" aria-live="polite">{loading?'Loading...':'Not Available'}</span>}
  </div>
  {url&&cached&&<RestaurantCredit p={p}/>}
  {url&&live&&!cached&&<div className="mt-1 break-words text-[10px] leading-tight text-muted-foreground">
   <a href={live.googleMapsUri} target="_blank" rel="noopener noreferrer" className="underline">Google Maps</a>
   {live.authorAttributions.map((a,i)=><div key={i} className="flex flex-wrap items-center gap-1">{a.photoUri&&<img src={a.photoUri} alt="" width={16} height={16} referrerPolicy="no-referrer"/>}{a.uri?<a href={a.uri} target="_blank" rel="noopener noreferrer" className="underline">{a.displayName}</a>:<span>{a.displayName}</span>}</div>)}
  </div>}
 </div>;
}
export function RestaurantPhoto({p,compact=false}:{p:PubPlace;compact?:boolean}){
 return <PhotoView key={`${p.placeId}:${p.image?.version??'live'}:${Boolean(p.livePhoto)}`} p={p} compact={compact}/>;
}
