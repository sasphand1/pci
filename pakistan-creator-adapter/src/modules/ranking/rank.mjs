/** Deterministic raw YouTube metric sorting. No custom score and no imputed metrics.
 * Counts must be nonnegative base-10 strings from the official YouTube API.
 * Equal source counts share a dense rank; inaccessible counts get rank=null.
 */
export const RANK_METRICS=Object.freeze(['subscribers','views','videos']);
export function compareCounts(a,b){
  const aa=BigInt(a),bb=BigInt(b);return aa>bb?-1:aa<bb?1:0;
}
export function rankedRows(rows,metric='subscribers'){
  if(!RANK_METRICS.includes(metric))throw new Error('Unknown sort metric');
  const field={subscribers:'subscriberCount',views:'viewCount',videos:'videoCount'}[metric];
  const sorted=[...rows].sort((a,b)=>{
    const x=a[field],y=b[field];
    if(x===null||x===undefined)return y===null||y===undefined?String(a.channelId).localeCompare(String(b.channelId)):1;
    if(y===null||y===undefined)return -1;
    return compareCounts(x,y)||String(a.channelId).localeCompare(String(b.channelId));
  });
  let denseRank=0,previous=null;
  return sorted.map(item=>{
    const value=item[field];
    if(value===null||value===undefined)return {...item,rank:null,rankMetric:metric};
    if(previous!==value){denseRank++;previous=value;}
    return {...item,rank:denseRank,rankMetric:metric};
  });
}
/** bigint-safe sum; must be labeled as a sum of channel counts (not unique viewers/subscribers). */
export function sumCounts(rows,field){return rows.reduce((total,r)=>r[field]==null?total:total+BigInt(r[field]),0n).toString();}
