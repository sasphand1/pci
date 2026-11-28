import {safeAvatarUrl} from '../../providers/avatar.js';
export const TIKTOK_METRICS=['followers','averageViews','averageLikes','averageComments','averageShares'] as const;
export type TikTokMetric=typeof TIKTOK_METRICS[number];
export function metricOf(v:unknown):TikTokMetric{return TIKTOK_METRICS.find(x=>x===v)??'followers';}
const count=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER?v:null;
export type TikTokRow={avatarUrl:string|null;following:number|null;handle:string;displayName:string;personSlug:string|null;category:string|null;observedAt:string;stale:boolean;followers:number|null;likes:number|null;posts:number|null;sampleSize:number|null;averageViews:number|null;averageLikes:number|null;averageComments:number|null;averageShares:number|null;rank:number|null};
export function projectTikTok(x:Record<string,any>,now=Date.now()):TikTokRow|null{
 const p=x.profile,a=x.analytics??{},at=new Date(x.observed_at).getTime();
 if(!p||!x.published_at||!/^\d{1,30}$/.test(x.external_id)||! /^[a-z0-9._]{2,24}$/.test(x.handle)||p.handle!==x.handle||p.accountId!==x.external_id||!Number.isFinite(at)||at>now||now-at>90*86400000)return null;
 const n=count(p.followers);if(n===null||!Number.isSafeInteger(n))return null;
 const sample=count(a.sampleSize);const avg=(v:unknown)=>sample===10?count(v):null;
 return {avatarUrl:safeAvatarUrl(p.avatar),following:count(p.following),handle:x.handle,displayName:x.linked_name||x.person_name||p.name||x.handle,personSlug:x.person_slug??null,category:x.niche??null,observedAt:new Date(at).toISOString(),stale:now-at>15*86400000,followers:n,likes:count(p.likes),posts:count(p.posts),sampleSize:sample,averageViews:avg(a.averageViews),averageLikes:avg(a.averageLikes),averageComments:avg(a.averageComments),averageShares:avg(a.averageShares),rank:null};
}
export function rankTikTok(rows:TikTokRow[],metric:TikTokMetric):TikTokRow[]{
 const sorted=[...rows].sort((a,b)=>((b.stale?null:b[metric])??-1)-((a.stale?null:a[metric])??-1)||a.handle.localeCompare(b.handle));
 let rank=0,last:number|null=null;
 return sorted.map((r,i)=>{const value=r.stale?null:r[metric];if(value===null)return {...r,rank:null};if(value!==last)rank=i+1;last=value;return {...r,rank};});
}

/** Filter and sort the published cohort before pagination; preserve global competition ranks. */
export function selectTikTokRows(rows:TikTokRow[],options:{category?:string;categoryLabel?:string;sort?:string;search?:string;handle?:string;person?:string}):TikTokRow[]{
 const norm=(v:string|null|undefined)=>(v??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 const search=options.search?.toLowerCase();
 const filtered=rows.filter(x=>(!options.person||x.personSlug===options.person)&&(!options.handle||x.handle===options.handle)&&(!search||`${x.displayName} ${x.handle}`.toLowerCase().includes(search))&&(!options.category||[norm(options.category),norm(options.categoryLabel)].filter(Boolean).includes(norm(x.category))));
 if(options.sort==='name')filtered.sort((a,b)=>a.displayName.localeCompare(b.displayName)||a.handle.localeCompare(b.handle));
 else if(options.sort==='followers')filtered.sort((a,b)=>(b.followers??-1)-(a.followers??-1)||a.handle.localeCompare(b.handle));
 return filtered;
}
