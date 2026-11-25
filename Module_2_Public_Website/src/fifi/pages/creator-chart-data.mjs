// Pure helpers for the creator profile. Recorded observations only: no smoothing, no backfill.
export function observedSeries(points,days){
 const map=new Map();for(const p of Array.isArray(points)?points:[]){const time=Date.parse(p?.at);if(Number.isFinite(time)&&Number.isSafeInteger(p.value)&&p.value>=0&&time<=Date.now())map.set(time,{time,value:p.value});}
 const sorted=[...map.values()].sort((a,b)=>a.time-b.time);const end=sorted.at(-1)?.time;return end===undefined?[]:sorted.filter(p=>p.time>=end-days*86400000);
}
/** Views gained per day between consecutive readings at most 2 days apart; counter resets are skipped. */
export function intervalRates(points){return points.slice(1).flatMap((b,i)=>{const a=points[i],days=(b.time-a.time)/86400000;return days>0&&days<=2&&b.value>=a.value?[{time:b.time,value:Math.round((b.value-a.value)/days)}]:[];});}
export function hasChange(points){return points.length>1&&points.some(p=>p.value!==points[0].value);}
/** Change from the first to the last reading in the window, or null when there is nothing to compare. */
export function windowChange(points){if(points.length<2)return null;return points.at(-1).value-points[0].value;}
/** SVG polyline points for a sparkline in a w x h box. Flat or single-point series give a flat midline. */
export function sparkPoints(points,w=100,h=28,pad=2){
 if(!points.length)return '';
 const t0=points[0].time,t1=points.at(-1).time,vs=points.map(p=>p.value),lo=Math.min(...vs),hi=Math.max(...vs);
 return points.map(p=>{const x=t1===t0?w/2:pad+(p.time-t0)/(t1-t0)*(w-2*pad);const y=hi===lo?h/2:pad+(1-(p.value-lo)/(hi-lo))*(h-2*pad);return `${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ');
}
/** Which platform views exist for a creator, and which one opens first. */
export function profileViews(platforms,requested){
 const order=['youtube','instagram','tiktok'];const have=order.filter(p=>platforms.includes(p));
 const views=have.length>1?['all',...have]:have.length?have:['all'];
 return {views,initial:views.includes(requested)?requested:views[0]};
}
