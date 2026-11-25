export const DAY=86400000;
export function bucketPoints(raw,days=Infinity,end){
 const map=new Map();for(const p of raw){const time=Date.parse(p.at);if(!Number.isFinite(time)||time>Date.now()||!Number.isFinite(p.value)||p.value<0)continue;const from=p.from?Date.parse(p.from):undefined;map.set(time,{time,value:p.value,...(Number.isFinite(from)&&from<time?{from}:{} )});}
 const a=[...map.values()].sort((x,y)=>x.time-y.time);const last=end??a.at(-1)?.time;return last===undefined?[]:a.filter(p=>p.time<=last&&p.time>=last-days*DAY);
}
export function dailyRates(points){return points.slice(1).flatMap((b,i)=>{const a=points[i],elapsed=(b.time-a.time)/DAY;return elapsed>=.5&&elapsed<=2&&b.value>=a.value?[{time:b.time,from:a.time,value:(b.value-a.value)/elapsed}]:[];});}
export function averagePace(points){const r=dailyRates(points);const days=r.reduce((s,p)=>s+(p.time-p.from)/DAY,0);return days?r.reduce((s,p)=>s+p.value*(p.time-p.from)/DAY,0)/days:null;}
/** Align actual observed rates by elapsed position, not interpolated or synthetic daily samples. */
export function periodComparison(points,days){
 const end=points.at(-1)?.time;if(end===undefined)return null;const start=end-days*DAY,previousStart=start-days*DAY;
 if(points.some((p,i)=>i>0&&points[i-1].time>=previousStart&&p.value<points[i-1].value))return null;
 const r=dailyRates(points);
 const select=(lo,hi)=>r.filter(p=>p.from>=lo&&p.time<=hi).map(p=>({...p,day:(p.time-lo)/DAY}));
 const current=select(start,end),previous=select(previousStart,start);
 const enough=(a,lo,hi)=>a.length>=2&&a[0].from-lo<=2*DAY&&hi-a.at(-1).time<=2*DAY&&a.reduce((s,p)=>s+p.time-p.from,0)>=Math.max(2,days-2)*DAY;
 return enough(current,start,end)&&enough(previous,previousStart,start)?{current,previous,start,end,previousStart,days}:null;
}
export function rankVideos(videos,metric,limit=10){return videos.filter(v=>typeof v[metric]==='number'&&Number.isFinite(v[metric])&&v[metric]>=0).sort((a,b)=>b[metric]-a[metric]||String(a.videoId).localeCompare(String(b.videoId))).slice(0,limit);}
