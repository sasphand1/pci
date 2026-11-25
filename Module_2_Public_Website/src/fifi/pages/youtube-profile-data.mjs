const DAY=86400000;
export const AGE_BANDS=['0–7 days','8–30 days','31–90 days','91–365 days','Over 1 year'];
export const VIEW_BANDS=['Under 10K','10K–100K','100K–1M','1M–10M','10M+'];
export function observedPortfolio(videos){
 const seen=new Set();
 const known=videos.filter(v=>{if(seen.has(v.videoId)||!Number.isFinite(v.currentViews)||v.currentViews<0)return false;seen.add(v.videoId);return true;}).sort((a,b)=>b.currentViews-a.currentViews||a.videoId.localeCompare(b.videoId));
 const n=known.length,total=n?known.reduce((s,v)=>s+v.currentViews,0):null;
 const age=AGE_BANDS.map(label=>({label,value:0})),bands=VIEW_BANDS.map(label=>({label,value:0}));let dated=0;
 for(const v of known){const views=v.currentViews;bands[views<1e4?0:views<1e5?1:views<1e6?2:views<1e7?3:4].value++;
  const days=(Date.parse(v.observedAt)-Date.parse(v.publishedAt))/DAY;
  if(v.observedAt&&v.publishedAt&&Number.isFinite(days)&&days>=0){dated++;age[days<8?0:days<31?1:days<91?2:days<366?3:4].value+=views;}
 }
 const median=n?(known[Math.floor((n-1)/2)].currentViews+known[Math.floor(n/2)].currentViews)/2:null;
 return {known,total,median,topShare:total>0?100*known[0].currentViews/total:null,topFiveShare:total>0?100*known.slice(0,5).reduce((s,v)=>s+v.currentViews,0)/total:null,age:dated?age:[],bands:n?bands:[],dated};
}
