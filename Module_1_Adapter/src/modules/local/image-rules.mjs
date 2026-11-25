import { isIP } from 'node:net';
export const MAX_IMAGE_BYTES=200000;
export const MAX_CACHE_BYTES=40000000;
// Deny special-use, non-global, private, multicast and reserved IPv4 ranges.
// IPv6 is deliberately not supported by this collector; there is no fallback.
export function publicIPv4(ip){
 if(isIP(ip)!==4)return false;
 const [a,b,c]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===88&&c===99)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
const forbidden=['google.com','googleapis.com','googleusercontent.com','gstatic.com','goo.gl','google.co.uk','google.com.pk','facebook.com','fbcdn.net','instagram.com','cdninstagram.com','tiktok.com','youtube.com','ytimg.com'];
export function safeSource(raw){
 try{const u=new URL(raw);const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!h.includes('.')||h.endsWith('.')||isIP(h)||h.includes(':')||h.endsWith('.local')||h.endsWith('.internal')||forbidden.some(d=>h===d||h.endsWith('.'+d))||/(^|\.)google\.[a-z.]+$/.test(h))return null;
 return u;
 }catch{return null;}
}
export function commonsQuery(name,city,area){return [name,area,city,'Pakistan'].filter(Boolean).join(' ').replace(/["\\]/g,' ').slice(0,220);}
export function allowedCommonsLicense(s){return /^(CC BY(?:-SA)? [1-4]\.0|CC0(?: 1\.0)?|Public domain)$/i.test(String(s).trim());}


// Website candidates are not licensed or verified merely because they are publicly visible.
const decodeHtml=s=>String(s).replace(/&(?:amp|quot|apos|#39|lt|gt|#x[0-9a-f]+|#\d+);/gi,m=>{
 const named={'&amp;':'&','&quot;':'"','&apos;':"'",'&#39;':"'",'&lt;':'<','&gt;':'>'};if(named[m.toLowerCase()]!==undefined)return named[m.toLowerCase()];
 const n=m[2].toLowerCase()==='x'?parseInt(m.slice(3,-1),16):parseInt(m.slice(2,-1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):'';
});
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m=>[m[1].toLowerCase(),decodeHtml(m[2]??m[3]??m[4]??'')]));
export const normalizedName=s=>String(s??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const generic=new Set(['restaurant','restaurants','cafe','coffee','shop','the','and','branch','outlet','pakistan','karachi','lahore','islamabad']);
export function identityWords(name){return normalizedName(String(name).split(/\s[-–—|]\s/)[0]).split(' ').filter(x=>x.length>2&&!generic.has(x)).slice(0,3);}
const nonPhoto=/(?:^|[\/_.\s-])(?:logo|logos|icon|icons|favicon|sprite|placeholder|banner|payment|badge|avatar|loading|spinner)(?:[\/_.\s-]|$)|\.(?:svg|gif|pdf|djvu|tiff?|ico|mp4|webm)(?:$|[?#])/i;
export function extractWebsiteImages(html,base,name){
 if(typeof html!=='string'||html.length>500000||!safeSource(base))return [];
 const out=new Map(),words=identityWords(name);
 function add(raw,kind,label='',width=0){
  if(typeof raw!=='string'||!raw||raw.length>2000)return;
  let url;try{url=new URL(decodeHtml(raw),base);url.hash='';}catch{return;}
  if(!safeSource(url.href))return;
  let path=url.pathname;try{path=decodeURIComponent(path);}catch{}
  if(nonPhoto.test(path)||nonPhoto.test(label)||(width>0&&width<180))return;
  const text=normalizedName(path+' '+label),matches=words.filter(w=>text.split(' ').includes(w)).length;
  const score=({jsonld:45,og:35,img:20,srcset:18}[kind]??0)+matches*35;
  const candidate={url:url.href,kind,label:String(label).slice(0,150),score};
  if(!out.has(url.href)||out.get(url.href).score<score)out.set(url.href,candidate);
 }
 for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const a=attrs(m[0]);if(['og:image','og:image:url','og:image:secure_url','twitter:image'].includes((a.property??a.name??'').toLowerCase()))add(a.content,'og');}
 for(const m of html.matchAll(/<img\b[^>]*>/gi)){const a=attrs(m[0]),label=[a.alt,a.title].filter(Boolean).join(' '),w=Number(a.width)||0;
  for(const k of ['src','data-src','data-lazy-src','data-original'])add(a[k],'img',label,w);
  for(const k of ['srcset','data-srcset','data-lazy-srcset'])for(const item of (a[k]??'').split(',').slice(0,12)){const [url,descriptor]=item.trim().split(/\s+/);add(url,'srcset',label,descriptor?.endsWith('w')?Number(descriptor.slice(0,-1)):w);}
 }
 function imageValue(v,label){if(typeof v==='string')add(v,'jsonld',label);else if(Array.isArray(v))v.slice(0,20).forEach(x=>imageValue(x,label));else if(v&&typeof v==='object')add(v.contentUrl??v.url,'jsonld',label,Number(v.width)||0);}
 function walk(v,depth=0){if(depth>12||!v||typeof v!=='object')return;if(Array.isArray(v)){v.slice(0,60).forEach(x=>walk(x,depth+1));return;}
  const types=[v['@type']].flat();if(types.some(x=>['Restaurant','FoodEstablishment','CafeOrCoffeeShop','LocalBusiness','FastFoodRestaurant'].includes(x)))imageValue(v.image,String(v.name??''));
  for(const [k,x] of Object.entries(v))if(k!=='image'&&k!=='logo')walk(x,depth+1);
 }
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){if((attrs(m[1]).type??'').toLowerCase()==='application/ld+json')try{walk(JSON.parse(m[2]));}catch{}}
 return [...out.values()].sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url)).slice(0,12);
}
// A small independently identified starting directory, not a fabricated global domain search.
export function knownWebsite(name,city){const n=normalizedName(name),c=normalizedName(city);
 if(c==='islamabad'&&n==='howdy centaurus')return 'https://thecentaurusmall.com/team/howdy/';
 if(c==='lahore'&&n.startsWith('devour johar town'))return 'https://www.devour.com.pk/';
 if(c==='karachi'&&n.startsWith('real spice')&&n.includes('tariq road'))return 'https://realspice.com.pk/';
 return null;
}
const boxes={karachi:'24.70,66.80,25.16,67.45',lahore:'31.25,74.05,31.75,74.65',islamabad:'33.45,72.75,33.85,73.40'};
export function osmWebsiteQuery(name,city){const box=boxes[city],words=identityWords(name);if(!box||!words.length)return null;
 // Use only normalized Unicode letters/digits, not arbitrary Overpass QL input.
 const term=words[0];return `[out:json][timeout:6];(nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"~"${term}",i]["website"](${box});nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"~"${term}",i]["contact:website"](${box}););out tags 20;`;
}
export function osmWebsiteCandidates(data,name,area){const words=identityWords(name),areaWords=normalizedName(area).split(' ').filter(x=>x.length>2);if(!words.length)return [];
 const out=new Map();for(const el of (Array.isArray(data?.elements)?data.elements:[]).slice(0,30)){const t=el.tags??{},n=normalizedName(t.name),tokens=n.split(' ');if(!words.every(w=>tokens.includes(w)))continue;
  const u=safeSource(t.website??t['contact:website']??'');if(!u)continue;
  const location=normalizedName([t.name,t['addr:street'],t['addr:suburb'],t['addr:place'],t['addr:district']].filter(Boolean).join(' '));
  const score=areaWords.filter(w=>location.split(' ').includes(w)).length;
  const old=out.get(u.href);if(!old||old.score<score)out.set(u.href,{url:u.href,score});
 }
 return [...out.values()].sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url)).slice(0,2).map(x=>x.url);
}
export function commonsPhotoTitle(title,name){const words=identityWords(name),t=normalizedName(title).split(' ');return /\.(?:jpe?g|png|webp)$/i.test(String(title))&&words.length>0&&words.every(w=>t.includes(w));}
