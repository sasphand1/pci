/** A read-only, time-bounded discovery channel. Google News articles are never events. */
import {fetchFeed} from './fetch.js';
import {parseRssFeed} from './parse.js';
import {logger} from '../../lib/errors.js';

const QUERIES:Record<string,string>={
 sports:'Pakistan (sports tournament OR cricket match)',
 education:'Pakistan (book fair OR university event OR career expo)',
 gaming:'Pakistan (esports tournament OR gaming festival)',
 technology:'Pakistan (tech conference OR hackathon OR AI expo)',
 business:'Pakistan (trade exhibition OR business expo)',
 arts:'Pakistan (art festival OR music concert)',
 community:'Pakistan (community festival OR cultural event)',
 fashion:'Pakistan (fashion week OR fashion show)',
 health:'Pakistan (medical conference OR healthcare exhibition)',
 food:'Pakistan (food festival OR culinary competition)'
};
export const DISCOVERY_CATEGORIES=Object.freeze(Object.keys(QUERIES));
export type DiscoveryItem={title:string;url:string;category:string;provider:string;is_event:false};
export type DiscoveryResult={category:string;items:DiscoveryItem[];status:'ready'|'unavailable';checked_at:string;warning:string};
const TTL_MS=10*60_000;
const cache=new Map<string,{expires:number;result:DiscoveryResult}>();
const inflight=new Map<string,Promise<DiscoveryResult>>();
export function discoveryFeedUrl(category:string){
 if(!Object.hasOwn(QUERIES,category))throw new Error('Unknown discovery category');
 const q=encodeURIComponent(QUERIES[category]);
 return `https://news.google.com/rss/search?q=${q}&hl=en-PK&gl=PK&ceid=PK:en`;
}
export async function discoverCategory(category:string):Promise<DiscoveryResult>{
 const cached=cache.get(category);if(cached&&cached.expires>Date.now())return cached.result;
 const existing=inflight.get(category);if(existing)return existing;
 const work=(async()=>{
  let status:'ready'|'unavailable'='ready';let items:DiscoveryItem[]=[];
  try{
   const xml=await fetchFeed(discoveryFeedUrl(category));
   const seen=new Set<string>();
   for(const row of parseRssFeed(xml).slice(0,35)){
    if(!row.name||!row.link||!row.link.startsWith('https://')||seen.has(row.link))continue;
    seen.add(row.link);
    items.push({title:String(row.name).slice(0,200),url:row.link,category,provider:'Google News RSS',is_event:false});
   }
   items=items.slice(0,25);
  }catch(e){status='unavailable';logger.warn({err:e,category},'Google News discovery unavailable');}
  const result:DiscoveryResult={category,items,status,checked_at:new Date().toISOString(),
    warning:'Discovery headlines are unverified leads, NOT upcoming event dates. Verify actual event details on an organizer site before manual publication.'};
  cache.set(category,{expires:Date.now()+(status==='ready'?TTL_MS:60_000),result});return result;
 })();
 inflight.set(category,work);
 try{return await work;}finally{inflight.delete(category);}
}
