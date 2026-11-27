const DAY=86400000;
export const VIEW_BANDS=['<10K','10–25K','25–50K','50–100K','100–250K','250K–1M','1M+'];
export function observedPortfolio(videos){
 const seen=new Set();
 const known=videos.filter(v=>{if(seen.has(v.videoId)||!Number.isFinite(v.currentViews)||v.currentViews<0)return false;seen.add(v.videoId);return true;}).sort((a,b)=>b.currentViews-a.currentViews||a.videoId.localeCompare(b.videoId));
 const n=known.length,total=n?known.reduce((s,v)=>s+v.currentViews,0):null;
 const bands=VIEW_BANDS.map(label=>({label,value:0})),age=[];
 for(const v of known){const views=v.currentViews;bands[views<10000?0:views<25000?1:views<50000?2:views<100000?3:views<250000?4:views<1000000?5:6].value++;
  const days=(Date.parse(v.observedAt)-Date.parse(v.publishedAt))/DAY;
  if(v.observedAt&&v.publishedAt&&Number.isFinite(days)&&days>=0)age.push({videoId:v.videoId,title:v.title,days,value:views});
 }
 const median=n?(known[Math.floor((n-1)/2)].currentViews+known[Math.floor(n/2)].currentViews)/2:null;
 return {known,total,median,topShare:total>0?100*known[0].currentViews/total:null,topFiveShare:total>0?100*known.slice(0,5).reduce((s,v)=>s+v.currentViews,0)/total:null,age,bands:n?bands:[],dated:age.length};
}
/** Use only verified fixed-cohort aggregates, never channel totals as a substitute. */
export function cohortSeries(cohort){
 const points=(cohort?.points??[]).filter(p=>Number.isFinite(Date.parse(p.at))&&Number.isFinite(p.total)&&p.total>=0&&Number.isFinite(p.median)&&p.median>=0).map(p=>({time:Date.parse(p.at),value:p.total,median:p.median})).sort((a,b)=>a.time-b.time).filter((p,i,a)=>!i||p.time!==a[i-1].time);
 const baseline=points[0],last=points.at(-1),rates=[];
 for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],elapsed=(b.time-a.time)/DAY,gain=b.value-a.value;if(elapsed>0&&elapsed<=2&&gain>=0)rates.push({time:b.time,from:a.time,value:gain/elapsed,gain,hours:elapsed*24});}
 const duration=rates.reduce((s,r)=>s+r.hours/24,0),pace=duration?rates.reduce((s,r)=>s+r.gain,0)/duration:null;
 return {points:points.map(({time,value})=>({time,value})),medians:points.map(({time,median})=>({time,value:median})),cumulative:baseline?points.map(p=>({time:p.time,value:p.value-baseline.value})):[],rates,pace,delta:baseline&&last&&points.length>1?last.value-baseline.value:null,change:baseline&&last&&baseline.value>0&&points.length>1?100*(last.value-baseline.value)/baseline.value:null};
}
/** Daily comparison: actual interval ending UTC day, weighted by observed elapsed time. Missing days stay null. */
export function groupedDaily(peers){
 const maps=peers.map(peer=>{const days=new Map();for(const r of cohortSeries(peer.cohort).rates){const key=new Date(r.time).toISOString().slice(0,10),p=days.get(key)??{gain:0,hours:0};p.gain+=r.gain;p.hours+=r.hours;days.set(key,p);}return days;});
 const days=[...new Set(maps.flatMap(m=>[...m.keys()]))].sort().slice(-14);
 return days.map(day=>({day,values:maps.map(m=>{const p=m.get(day);return p&&p.hours>0?p.gain*24/p.hours:null;})}));
}

/** Keep at least the three lower ranges; trim only unused upper ranges on the individual chart. */
export function localBands(rows){let last=rows.findLastIndex(r=>r.value>0);return rows.slice(0,Math.max(3,last+1));}
const utcDay=t=>Math.floor(t/DAY)*DAY;
/** One latest real observation per UTC day, no interpolated observations. */
export function dailyTotals(points){const m=new Map();for(const p of [...points].sort((a,b)=>a.time-b.time))m.set(utcDay(p.time),{time:utcDay(p.time),value:p.value});return [...m.values()];}
/** Same weighted daily rate as grouped comparison, using interval-ending UTC dates. */
export function dailyRates(rates){const m=new Map();for(const r of rates){const t=utcDay(r.time),p=m.get(t)??{gain:0,hours:0};p.gain+=r.gain;p.hours+=r.hours;m.set(t,p);}return [...m].sort((a,b)=>a[0]-b[0]).filter(([,p])=>p.hours>0).map(([time,p])=>({time,value:24*p.gain/p.hours}));}

export const PLATFORMS=['YouTube','Instagram','TikTok'];
export function platformAudience(accounts){return PLATFORMS.map(platform=>{const rows=accounts.filter(a=>a.platform.toLowerCase()===platform.toLowerCase());const known=rows.length>0&&rows.every(a=>Number.isSafeInteger(a.followersCount)&&a.followersCount>=0);return {platform,linked:rows.length>0,count:known?rows.reduce((n,a)=>n+a.followersCount,0):null};});}
export function recordedTotal(rows){const linked=rows.filter(r=>r.linked);return linked.length&&linked.every(r=>r.count!==null)?linked.reduce((n,r)=>n+r.count,0):null;}
export function historyWindow(points,days){const valid=points.filter(p=>Number.isFinite(Date.parse(p.at))&&Number.isFinite(p.value)&&p.value>=0).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));if(!valid.length)return [];const end=Date.parse(valid.at(-1).at);return valid.filter(p=>Date.parse(p.at)>=end-days*86400000);}
export function rankContent(videos){return videos.filter(v=>Number.isFinite(v.currentViews)&&v.currentViews>=0).sort((a,b)=>b.currentViews-a.currentViews||a.videoId.localeCompare(b.videoId));}

/** Presentation-ready values sourced from the existing read-only Creators Bucket. */
export function profileAnalytics(videos,cohort,subscribers){
 const p=observedPortfolio(videos),g=cohortSeries(cohort);
 const ranges={};for(const d of [7,30,90]){const points=historyWindow(subscribers,d);ranges[d]={points,gain:points.length>1?points.at(-1).value-points[0].value:null};}
 return {portfolio:{...p,topFiveViews:p.known.length?p.known.slice(0,5).reduce((n,v)=>n+v.currentViews,0):null},growth:{...g,dailyTotals:dailyTotals(g.points),dailyRates:dailyRates(g.rates)},subscriberRanges:ranges};
}
/** Cross-platform audience from the existing public registry readings, not YouTube-only counts. */
export function profileAudience(accounts){
 const rows=platformAudience(accounts.map(a=>({platform:a.platform,followersCount:a.followers})));
 const total=recordedTotal(rows),knownSum=rows.reduce((n,a)=>n+(a.count??0),0);
 return {total,knownSum,rows:rows.map(a=>({...a,share:a.count!==null&&total!==null&&total>0?100*a.count/total:null}))};
}

/** Accept only the official YouTube image CDN; no arbitrary or credential-bearing URLs. */
export function safeChannelBanner(value){
 if(typeof value!=='string'||value.length>500)return null;
 try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['yt3.ggpht.com','yt3.googleusercontent.com','i.ytimg.com','img.youtube.com'].includes(u.hostname)?u.toString():null;}catch{return null;}
}

/** Primary channel history, independent of the sampled-video cohort. */
export function channelGrowth(history){
 const g=cohortSeries({points:history.map(p=>({at:p.at,total:p.value,median:0}))});
 return {...g,dailyTotals:dailyTotals(g.points),dailyRates:dailyRates(g.rates)};
}
