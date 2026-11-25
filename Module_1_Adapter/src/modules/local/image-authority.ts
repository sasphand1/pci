import { extractWebsiteImages, normalizedName, safeSource } from './image-rules.mjs';

export type AuthorizedWebsitePhoto={title:string;sourceUrl:string;permissionUrl:string;attribution:string;licence:string;licenceUrl:string;origin:string;sourcePage:string;autoAuthorized:true};
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const list=(v:unknown):unknown[]=>Array.isArray(v)?v:[v];
function license(v:unknown){
 try{const u=new URL(str(v));if(u.protocol!=='https:'||u.hostname!=='creativecommons.org'||u.username||u.password||u.port||u.search||u.hash)return null;
  const path=u.pathname.replace(/\/$/,'');const m=path.match(/^\/licenses\/(by|by-sa)\/(4\.0|3\.0|2\.0|1\.0)$/);
  if(m)return {name:`CC ${m[1].toUpperCase()} ${m[2]}`,url:u.href};
  if(path==='/publicdomain/zero/1.0')return {name:'CC0 1.0',url:u.href};
 }catch{}return null;
}
// Conservative automatic permission gate. Generic site copyright, logos, and OG images
// without image-specific licence and named creator never qualify. A full address match
// against the actual database branch is required; a brand or city alone is insufficient.
export function authorizedWebsitePhotos(html:string,base:string,name:string,address:string|null):AuthorizedWebsitePhoto[]{
 if(!safeSource(base)||!address||html.length>500000)return [];
 const expected=normalizedName(address),expectedName=normalizedName(name);
 if(expected.length<20||!expectedName)return [];
 const photoUrls=new Set(extractWebsiteImages(html,base,name).map(p=>p.url));
 const out=new Map<string,AuthorizedWebsitePhoto>();
 function walk(v:unknown,depth=0){
  if(depth>12||!v||typeof v!=='object')return;
  if(Array.isArray(v)){for(const item of v.slice(0,60))walk(item,depth+1);return;}
  const r=obj(v),a=obj(r.address);
  const actual=normalizedName([a.streetAddress,a.addressLocality,a.addressRegion,a.postalCode,a.addressCountry].map(str).filter(Boolean).join(' '));
  const street=normalizedName(str(a.streetAddress)),city=normalizedName(str(a.addressLocality));
  const types=list(r['@type']);
  // Address components may be ordered differently in formatted Google addresses.
  const tokens=new Set(expected.split(' '));
  const matches=street.length>=12&&city.length>=3&&actual.length>=20&&expected.includes(street)&&actual.split(' ').every(t=>tokens.has(t));
  if(types.some(t=>['Restaurant','FoodEstablishment','CafeOrCoffeeShop','FastFoodRestaurant'].includes(String(t)))&&normalizedName(r.name)===expectedName&&matches){
   for(const raw of list(r.image).slice(0,20)){
    const im=obj(raw);if(!list(im['@type']).includes('ImageObject'))continue;
    const l=license(im.license);const creator=str(obj(im.creator).name)||str(im.creditText);
    if(!l||creator.length<2||creator.length>500)continue;
    let url:string;try{url=new URL(str(im.contentUrl)||str(im.url),base).href;}catch{continue;}
    if(!photoUrls.has(url)||!safeSource(url)||new URL(url).origin!==new URL(base).origin)continue;
    out.set(url,{title:name,sourceUrl:url,permissionUrl:base,attribution:creator,licence:l.name+' ('+l.url+')',licenceUrl:l.url,origin:'Website: image-specific open licence and branch address matched',sourcePage:base,autoAuthorized:true});
   }
  }
  for(const [k,x] of Object.entries(r))if(k!=='image'&&k!=='logo')walk(x,depth+1);
 }
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  if(!/\btype\s*=\s*["']application\/ld\+json["']/i.test(m[1]))continue;
  try{walk(JSON.parse(m[2]));}catch{}
 }
 return [...out.values()].slice(0,3);
}
