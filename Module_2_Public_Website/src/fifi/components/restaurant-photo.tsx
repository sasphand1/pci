"use client";
import { useState } from 'react';
import { Utensils } from 'lucide-react';
import type { PubPlace } from '@/lib/public';
export const restaurantPhotoUrl=(p:PubPlace)=>p.image ? `/api/local-image/${encodeURIComponent(p.placeId)}?v=${encodeURIComponent(p.image.version)}` : null;
export function RestaurantCredit({p}:{p:PubPlace}){
 if(!p.image)return null;
 return <a href={p.image.permissionUrl} target="_blank" rel="noopener noreferrer" className="block break-words text-[10px] leading-tight text-muted-foreground underline" title="Photo source and licence">Photo: {p.image.attribution} · {p.image.licence}</a>;
}
export function RestaurantPhoto({p,compact=false}:{p:PubPlace;compact?:boolean}){
 const url=restaurantPhotoUrl(p),[failed,setFailed]=useState<string|null>(null);
 return <div className={compact?'w-16 shrink-0':'mb-2'}>
  <div className={compact?'grid h-14 w-16 place-items-center overflow-hidden rounded-lg bg-muted':'grid aspect-[16/9] w-full place-items-center overflow-hidden rounded-lg bg-muted'}>
   {url&&failed!==url ? <img src={url} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-contain" onError={()=>setFailed(url)}/> : <span className="flex flex-col items-center gap-1 text-muted-foreground"><Utensils className="h-4 w-4"/>{!compact&&<span className="text-[10px]">Photo unavailable</span>}</span>}
  </div>
  {url&&failed!==url&&!compact&&<RestaurantCredit p={p}/>}
 </div>;
}
