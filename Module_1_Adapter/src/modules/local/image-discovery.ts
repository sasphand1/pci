import { normalizedName, identityWords, safeSource } from './image-rules.mjs';

export type HttpReader=(url:string,max:number,accept:string,timeoutMs?:number)=>Promise<{body:Buffer;type:string;url?:string}>;
export type WebsiteHint={url:string;origin:'OpenStreetMap'|'Wikidata'|'Supplied website'};
const record=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const str=(v:unknown)=>typeof v==='string'?v:'';
const arr=(v:unknown):unknown[]=>Array.isArray(v)?v:[];
const error=(e:unknown)=>e instanceof Error&&/^[A-Z_0-9]{1,100}$/.test(e.message)?e.message:'HTTP_OR_DNS_ERROR';
const tokens=(v:unknown)=>new Set(normalizedName(v).split(' ').filter(Boolean));
const matches=(name:string,other:unknown)=>{const words=identityWords(name),actual=tokens(other);return words.length>0&&words.every(w=>actual.has(w));};
// No restaurant or city lookup table. Restrict area search to Pakistan and exact city name.
export function osmQuery(name:string,city:string):string|null{
 const words=identityWords(name),c=normalizedName(city);
 if(!words.length||!c||c.length>80||words[0].length>80)return null;
 // normalizedName emits letters, digits and spaces only; no Overpass syntax injection.
 return `[out:json][timeout:15];area["ISO3166-1"="PK"]["admin_level"="2"]->.country;area["name"~"^${c}$",i](area.country)->.city;(nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"~"${words[0]}",i]["website"](area.city);nwr["amenity"~"^(restaurant|cafe|fast_food)$"]["name"~"${words[0]}",i]["contact:website"](area.city););out tags 30;`;
}
export function osmHints(data:unknown,name:string,area:string|null):WebsiteHint[]{
 const root=record(data);if(root.remark||!Array.isArray(root.elements))throw Error('OSM_INCOMPLETE');
 const areaWords=[...tokens(area)].filter(w=>w.length>1);
 const sites=new Map<string,number>();
 for(const e of arr(root.elements).slice(0,30)){
  const t=record(record(e).tags);if(!matches(name,t.name))continue;
  const u=safeSource(str(t.website)||str(t['contact:website']));if(!u)continue;
  const location=tokens([t.name,t['addr:street'],t['addr:suburb'],t['addr:place'],t['addr:district']].map(str).join(' '));
  const score=areaWords.filter(w=>location.has(w)).length;
  sites.set(u.href,Math.max(score,sites.get(u.href)??0));
 }
 return [...sites].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,2).map(([url])=>({url,origin:'OpenStreetMap'}));
}
async function json(read:HttpReader,url:URL,timeout=10000){
 const r=await read(url.href,300000,'application/json',timeout);if(r.type!=='application/json')throw Error('INVALID_JSON_TYPE');
 try{return record(JSON.parse(r.body.toString('utf8')));}catch{throw Error('INVALID_JSON');}
}
function wikiUrl(params:Record<string,string>){const u=new URL('https://www.wikidata.org/w/api.php');u.search=new URLSearchParams({format:'json',maxlag:'5',...params}).toString();return u;}
export async function discoverWebsiteHints(read:HttpReader,name:string,city:string,area:string|null,supplied?:string):Promise<{hints:WebsiteHint[];diagnostics:string[];successful:number;failed:boolean}>{
 const diagnostics:string[]=[];let successful=0;let failed=false;
 const direct=supplied?safeSource(supplied):null;
 if(direct)return {hints:[{url:direct.href,origin:'Supplied website'}],diagnostics:['Website: supplied URL; identity and rights require verification'],successful:0,failed:false};
 const hints:WebsiteHint[]=[];const q=osmQuery(name,city);
 if(q){try{
  const u=new URL('https://overpass-api.de/api/interpreter');u.searchParams.set('data',q);
  const result=osmHints(await json(read,u,20000),name,area);successful++;hints.push(...result);
  diagnostics.push(`OpenStreetMap: ${result.length} website hints (© OpenStreetMap contributors)`);
 }catch(e){failed=true;diagnostics.push(`OpenStreetMap: ${error(e)}`);}}
 // A second independent source, not a guessed domain or a search-engine scrape.
 // Website hints never authorize publication; exact branch + image licence checked separately.
 if(hints.length<2){try{
  const search=await json(read,wikiUrl({action:'wbsearchentities',search:name.slice(0,150),language:'en',type:'item',limit:'5'}));
  if(search.error||!Array.isArray(search.search))throw Error('WIKIDATA_SEARCH_ERROR');
  const ids=arr(search.search).map(record).filter(x=>matches(name,x.label)&&/^Q[1-9]\d*$/.test(str(x.id))).map(x=>str(x.id));
  let count=0;
  if(ids.length){const data=await json(read,wikiUrl({action:'wbgetentities',ids:ids.join('|'),props:'claims|descriptions',languages:'en'}));
   if(data.error||!data.entities)throw Error('WIKIDATA_ENTITY_ERROR');
   for(const raw of Object.values(record(data.entities))){const entity=record(raw),desc=str(record(record(entity.descriptions).en).value),location=tokens(desc);
    if(!location.has('pakistan')&&!([...tokens(city)].every(w=>location.has(w))))continue;
    if(!/restaurant|cafe|coffee|food|dining/i.test(desc))continue;
    for(const claim of arr(record(entity.claims).P856)){
     const c=record(claim);if(c.rank==='deprecated')continue;
     const u=safeSource(str(record(record(c.mainsnak).datavalue).value));if(!u||hints.some(h=>h.url===u.href))continue;
     hints.push({url:u.href,origin:'Wikidata'});count++;
    }
   }
  }
  successful++;diagnostics.push(`Wikidata: ${count} website hints`);
 }catch(e){failed=true;diagnostics.push(`Wikidata: ${error(e)}`);}}
 return {hints:hints.slice(0,2),diagnostics,successful,failed};
}
