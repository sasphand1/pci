export const DAY=86400000;
/** Public counters are nonnegative safe integers. Null, whitespace and coercible booleans are not readings. */
export function count(v){if(typeof v==='string'&&!/^\d+$/.test(v))return null;if(typeof v!=='string'&&typeof v!=='number')return null;const n=Number(v);return Number.isSafeInteger(n)&&n>=0?n:null;}
export function series(rows,now=Date.now()){
 const map=new Map();for(const r of rows){const t=Date.parse(r.at),v=count(r.value);if(Number.isFinite(t)&&t<=now&&v!==null)map.set(t,{at:new Date(t).toISOString(),value:v});}
 return [...map.values()].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
}
export function daily(rows,now){const m=new Map();for(const p of series(rows,now))m.set(p.at.slice(0,10),p);return [...m.values()];}
const tolerance=days=>(days===1?.5:days===7?1:2)*DAY;
function baseline(a,end,days){const t=Date.parse(end.at),target=t-days*DAY;return a.filter(p=>Date.parse(p.at)<t&&Math.abs(Date.parse(p.at)-target)<=tolerance(days)).sort((x,y)=>Math.abs(Date.parse(x.at)-target)-Math.abs(Date.parse(y.at)-target))[0];}
function hasReset(a,from,to){const p=a.filter(x=>x.at>=from.at&&x.at<=to.at);return p.some((v,i)=>i>0&&v.value<p[i-1].value);}
export function gain(rows,days,now=Date.now(),allowDecrease=false){
 const a=series(rows,now),last=a.at(-1);if(!last||now-Date.parse(last.at)>2*DAY)return null;
 const b=baseline(a,last,days);return b&&(allowDecrease||!hasReset(a,b,last))?last.value-b.value:null;
}
export function average(xs){const a=xs.filter(x=>typeof x==='number'&&Number.isFinite(x));return a.length?a.reduce((s,x)=>s+x,0)/a.length:null;}
export function engagement(views,likes,comments){return typeof views==='number'&&views>0&&typeof likes==='number'&&typeof comments==='number'?100*(likes+comments)/views:null;}
export function likeRate(views,likes){return typeof views==='number'&&views>0&&typeof likes==='number'?100*likes/views:null;}
/** Rolling near-window gains: the actual starting timestamp is carried into every chart tooltip. */
export function periodRates(rows,days,now=Date.now()){
 const a=series(rows,now);return a.flatMap((b,i)=>{const p=baseline(a.slice(0,i),b,days);if(!p||hasReset(a,p,b))return [];return [{at:b.at,from:p.at,value:b.value-p.value}];});
}
