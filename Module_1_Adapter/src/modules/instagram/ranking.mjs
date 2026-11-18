import {compareCounts} from '../ranking/rank.mjs';
export const INSTAGRAM_METRICS=Object.freeze(['followers','posts']);
export function rankInstagram(rows,metric='followers'){
 if(!INSTAGRAM_METRICS.includes(metric))throw new Error('Unsupported Instagram ranking metric');
 const field=metric==='followers'?'followersCount':'mediaCount';
 const sorted=[...rows].sort((a,b)=>{
   const av=a[field],bv=b[field];
   if(av==null)return bv==null?String(a.username).localeCompare(String(b.username)):1;
   if(bv==null)return -1;
   return compareCounts(av,bv)||String(a.username).localeCompare(String(b.username));
 });
 let rank=0,last=null;
 return sorted.map(row=>{
   const value=row[field];
   if(value==null)return {...row,rank:null,rankMetric:metric};
   if(last!==value){rank++;last=value;}
   return {...row,rank,rankMetric:metric};
 });
}
