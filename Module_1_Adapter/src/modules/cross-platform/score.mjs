/** Research-only, rank fusion. This function never claims to measure influence or unique reach.
 * Equal platform weights: YT 50% (views + subscribers), IG 50% (followers).
 * Each dimension uses competition ranks in the SAME eligible matched cohort.
 * No imputation. A missing count disqualifies a record from the experimental wheel.
 * Scores are compared by exact integer rational arithmetic, avoiding float tie errors.
 */
const asCount=(v)=>v==null?null:/^(0|[1-9][0-9]*)$/.test(String(v))?BigInt(v):null;
const gcd=(a,b)=>b?gcd(b,a%b):a;
const fraction=(num,den)=>{const g=gcd(num,den);return {num:num/g,den:den/g}};
const plus=(a,b)=>fraction(a.num*b.den+b.num*a.den,a.den*b.den);
const div=(a,n)=>fraction(a.num,a.den*n);
const compare=(a,b)=>a.num*b.den===b.num*a.den?0:a.num*b.den>b.num*a.den?-1:1;
function percentile(counts,index){
 if(counts.length<=1)return fraction(1n,1n);
 const value=counts[index];const rank=1+counts.filter(c=>c>value).length;
 return fraction(BigInt(counts.length-rank),BigInt(counts.length-1));
}
export function rankCrossPlatform(rows,{limit=10}={}){
 if(!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid limit');
 // IMPORTANT: input is explicitly curated, admin-approved linked-human rows, not arbitrary accounts.
 const valid=rows.filter(r=>r.curated===true&&r.eligibility==='approved'&&r.enabled===true&&
  ['subscriberCount','viewCount','followersCount'].every(k=>asCount(r[k])!==null));
 const seen=new Set();const cohort=valid.filter(r=>{if(!r.youtubeCreatorId||seen.has(r.youtubeCreatorId))return false;seen.add(r.youtubeCreatorId);return true;});
 const subs=cohort.map(r=>asCount(r.subscriberCount));const views=cohort.map(r=>asCount(r.viewCount));const follows=cohort.map(r=>asCount(r.followersCount));
 const scored=cohort.map((r,i)=>{
   const s=percentile(subs,i),v=percentile(views,i),f=percentile(follows,i);
   const yt=div(plus(s,v),2n),score=div(plus(yt,f),2n);
   return {...r,scoreFraction:score,score:Number(score.num)*100/Number(score.den),breakdown:{youtubeSubscribers:Number(s.num)/Number(s.den)*100,youtubeViews:Number(v.num)/Number(v.den)*100,instagramFollowers:Number(f.num)/Number(f.den)*100,youtubePlatform:Number(yt.num)/Number(yt.den)*100}};
 });
 scored.sort((a,b)=>compare(a.scoreFraction,b.scoreFraction)||String(a.youtubeCreatorId).localeCompare(String(b.youtubeCreatorId)));
 let distinctRank=0;let last=null;
 const assigned=scored.map(r=>{if(!last||compare(r.scoreFraction,last)!==0){distinctRank++;last=r.scoreFraction;}return {...r,rank:distinctRank,tiedWith:0};});
 const counts=new Map();for(const r of assigned)counts.set(r.rank,(counts.get(r.rank)||0)+1);
 return assigned.filter(r=>r.rank<=limit).map(({scoreFraction,...r})=>({...r,tiedWith:counts.get(r.rank)}));
}
