/** PCI observational intelligence. Pure functions, no external API, no fabricated inference. */
export function compareDailySeries(input,metric,now=Date.now()){
 const unit=metric==='rainfall'?'mm/day':'kWh/m²/day';
 if(metric!=='rainfall'&&metric!=='solar')throw Error('Unsupported metric');
 const accepted=new Map();
 for(const row of Array.isArray(input)?input:[]){
  if(!row||typeof row!=='object'||typeof row.value!=='number'||!Number.isFinite(row.value)||row.value<0)continue;
  if(typeof row.observedAt!=='string')continue;
  const when=Date.parse(row.observedAt);
  if(!Number.isFinite(when)||when>now+3600000||when<now-31*86400000)continue;
  const day=new Date(when).toISOString().slice(0,10);
  if(!accepted.has(day)||when>accepted.get(day).when)accepted.set(day,{value:row.value,when});
 }
 const values=[...accepted.values()].sort((a,b)=>b.when-a.when);
 const latest=values[0];const age=latest?(now-latest.when)/86400000:Infinity;
 const fail={status:'insufficient',days:values.length,summary:'Not enough verified history',explanation:'At least 7 distinct recent daily observations and an observation within 10 days are required to compare recent conditions.'};
 if(values.length<7||age>10)return fail;
 const mean=values.reduce((sum,x)=>sum+x.value,0)/values.length;
 const rounded=n=>Number(n.toFixed(2));
 return {status:'ready',days:values.length,summary:`Latest ${rounded(latest.value)} ${unit} · 30-day sample mean ${rounded(mean)} ${unit}`,explanation:`Based on ${values.length} observed days, the latest value is ${latest.value>mean?'above':latest.value<mean?'below':'equal to'} the available 30-day sample mean. This is not a seasonal anomaly or forecast.`,latest:rounded(latest.value),sampleMean:rounded(mean)};
}
export function summarizeThermalDetections(input,now=Date.now()){
 const valid=(Array.isArray(input)?input:[]).filter(p=>p&&typeof p==='object'&&typeof p.latitude==='number'&&typeof p.longitude==='number'&&p.latitude>=23&&p.latitude<=38&&p.longitude>=60&&p.longitude<=78&&typeof p.observedAt==='string'&&Number.isFinite(Date.parse(p.observedAt))&&Date.parse(p.observedAt)<=now+3600000&&Date.parse(p.observedAt)>=now-4*86400000);
 const count=valid.length;
 return {count,explanation:count?`${count} recent geolocated detection records in the returned regional sample; detections are not confirmed fires, and records may be outside Pakistan.`:'No qualifying records in the returned sample. This does not establish that no fires occurred.'};
}
