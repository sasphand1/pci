export function observedSeries(points,days){
 const map=new Map();for(const p of points){const time=Date.parse(p.at);if(Number.isFinite(time)&&Number.isSafeInteger(p.value)&&p.value>=0&&time<=Date.now())map.set(time,{time,value:p.value});}
 const sorted=[...map.values()].sort((a,b)=>a.time-b.time);const end=sorted.at(-1)?.time;return end===undefined?[]:sorted.filter(p=>p.time>=end-days*86400000);
}
export function intervalRates(points){return points.slice(1).flatMap((b,i)=>{const a=points[i],days=(b.time-a.time)/86400000;return days>0&&days<=2&&b.value>=a.value?[{time:b.time,value:Math.round((b.value-a.value)/days)}]:[];});}
export function hasChange(points){return points.length>1&&points.some(p=>p.value!==points[0].value);}
