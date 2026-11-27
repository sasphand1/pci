import {rankCrossPlatform} from '../cross-platform/score.mjs';
/** Pure metric logic. No database, network or UI dependencies.
 * The All-platform subscriber/follower figure is a sum of reported account
 * counts, NOT unique people. Views are YouTube-only until a compatible
 * Instagram lifetime account-view metric is officially available.
 */
export const PLATFORMS = Object.freeze(['all','youtube','instagram']);
export const METRICS = Object.freeze(['views','subscribers','videos']);
export const METRIC_LABELS = Object.freeze({views:'Most Viewed',subscribers:'Most Subscribed',videos:'Most Active'});
const asCount=(v)=>v===null||v===undefined?null:/^(0|[1-9]\d*)$/.test(String(v))?BigInt(v):null;
const addAvailable=(values)=>{const present=values.map(asCount).filter(v=>v!==null);return present.length?present.reduce((a,b)=>a+b,0n).toString():null;};
/** Safe for counts above Number.MAX_SAFE_INTEGER; missing data is never zeroed. */
export function projectCreator(person,platform='all'){
 if(!PLATFORMS.includes(platform))throw new Error('Unknown platform');
 const youtube=person.youtube??null,instagram=person.instagram??null;
 const visibleYt=platform==='all'||platform==='youtube';
 const visibleIg=platform==='all'||platform==='instagram';
 const y=visibleYt?youtube:null,i=visibleIg?instagram:null;
 const subscriberCount=addAvailable([y?.subscribers,i?.followers]);
 const videoCount=addAvailable([y?.videos,i?.posts]);
 // Not possible to safely add Instagram aggregate views from this API.
 const viewCount=asCount(y?.views)?.toString()??null;
 return {...person,platform,subscriberCount,videoCount,viewCount,
   metricSources:{views:viewCount!==null?['youtube']:[],subscribers:[...(asCount(y?.subscribers)!==null?['youtube']:[]),...(asCount(i?.followers)!==null?['instagram']:[])],videos:[...(asCount(y?.videos)!==null?['youtube']:[]),...(asCount(i?.posts)!==null?['instagram']:[])]},
   platforms:{youtube:youtube?.url??null,instagram:instagram?.url??null},
   disclaimer:'Account-level reported audience counts are summed for comparison, not deduplicated unique people; one person may follow on multiple platforms.'};
}
export function rankPeople(people,{metric='subscribers',platform='all',limit=100,category}={}){
 if(!METRICS.includes(metric)||!PLATFORMS.includes(platform)||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Invalid ranking options');
 const field=metric==='views'?'viewCount':metric==='videos'?'videoCount':'subscriberCount';
 const projected=people.filter(p=>p.humanReviewStatus==='approved'&&p.enabled===true)
   .filter(p=>!category||p.categories?.some(c=>c.slug===category))
   .filter(p=>(platform!=='youtube'||Boolean(p.youtube))&&(platform!=='instagram'||Boolean(p.instagram)))
   .map(p=>projectCreator(p,platform));
 projected.sort((a,b)=>{const x=asCount(a[field]),y=asCount(b[field]);
   if(x===null)return y===null?String(a.id).localeCompare(String(b.id)):1;
   if(y===null)return -1;
   return x>y?-1:x<y?1:String(a.id).localeCompare(String(b.id));
 });
 let count=0,previous=null;
 const ranked=projected.map(p=>{const value=p[field];
   if(value===null)return {...p,rank:null,rankMetric:metric};
   if(previous!==value){count++;previous=value;}
   return {...p,rank:count,rankMetric:metric};
 });
 const known=ranked.filter(x=>x.rank!==null);
 return {data:known.slice(0,limit),total:ranked.length,known:known.length};
}
export function aggregate(people,platform='all'){
 if(!PLATFORMS.includes(platform))throw new Error('Invalid platform');
 const eligible=people.filter(p=>p.humanReviewStatus==='approved'&&p.enabled===true)
 .filter(p=>platform==='all'||(platform==='youtube'&&p.youtube)||(platform==='instagram'&&p.instagram));
 const projected=eligible.map(p=>projectCreator(p,platform));
 const sumField=f=>addAvailable(projected.map(p=>p[f]));
 return {creators:projected.length,subscribers:sumField('subscriberCount'),views:sumField('viewCount'),posts:sumField('videoCount')};
}

/** PCI_ALL_ROUNDERS_V1: Explicit cross-platform policy, NOT IMDb/Wilson or unique reach.
 * Requires an approved PERSON with BOTH linked approved YT + IG accounts and
 * three source metrics. Existing research algorithm weights 25% YT subscribers,
 * 25% YT lifetime views, 50% IG followers, normalized within the eligible cohort.
 * No TikTok values exist yet. Score is a relative percentile, not a truth claim.
 */
export function rankAllRounders(people,{limit=20,category}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid limit');
 const possible=people.filter(p=>p.enabled===true&&p.humanReviewStatus==='approved')
  .filter(p=>!category||p.categories?.some(c=>c.slug===category))
  .filter(p=>p.youtube&&p.instagram)
  .filter(p=>[p.youtube?.subscribers,p.youtube?.views,p.instagram?.followers].every(x=>asCount(x)!==null));
 const data=rankCrossPlatform(possible.map(p=>({...projectCreator(p,'all'),
  youtubeCreatorId:p.id,curated:true,eligibility:'approved',enabled:true,
  subscriberCount:p.youtube.subscribers,viewCount:p.youtube.views,
  followersCount:p.instagram.followers})),{limit})
  .map(p=>({...p,rankMetric:'allrounders',allRounderScore:p.score}));
 return {data,known:possible.length,total:possible.length,
  method:'PCI all-rounder policy v1: cohort percentiles, 25% YouTube subscribers + 25% YouTube lifetime views + 50% Instagram followers, linked and approved accounts only; no missing-data imputation; TikTok not yet available'};
}
