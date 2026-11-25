import {count,DAY} from './logic.mjs';
/** Fixed cohort of video IDs present at every selected actual collection timestamp. No resampling or imputation. */
export function fixedVideoCohort(rows, catalogue, now=Date.now()) {
 const eligible=new Map(catalogue.map(v=>[v.videoId,v.publishedAt?new Date(v.publishedAt).getTime():null]));
 const rounds=new Map();
 for(const r of rows){if(r.metric!=='views'||!eligible.has(r.videoId))continue;const t=new Date(r.at).getTime(),v=count(r.value),published=eligible.get(r.videoId);if(!Number.isFinite(t)||t>now||t<now-30*DAY||v===null||(published!==null&&(!Number.isFinite(published)||t<published)))continue;let m=rounds.get(t);if(!m)rounds.set(t,m=new Map());m.set(r.videoId,v);}
 const sorted=[...rounds].sort((a,b)=>a[0]-b[0]);
 if(!sorted.length)return null;
 const max=Math.max(...sorted.map(([,m])=>m.size));
 const min=Math.max(1,Math.ceil(max*.5)); // reject partial collections below half of the largest real round
 const usable=sorted.filter(([,m])=>m.size>=min);
 if(usable.length<2)return null;
 const last=usable.at(-1);let ids=[...last[1].keys()];const chosen=[last];
 for(let i=usable.length-2;i>=0;i--){const r=usable[i];const common=ids.filter(id=>r[1].has(id));if(common.length<min)break;ids=common;chosen.unshift(r);}
 if(chosen.length<2)return null;
 const points=chosen.map(([t,m])=>{const values=ids.map(id=>m.get(id)).sort((a,b)=>a-b);return {at:new Date(t).toISOString(),total:values.reduce((a,b)=>a+b,0),median:(values[Math.floor((values.length-1)/2)]+values[Math.floor(values.length/2)])/2};});
 if(points.some(p=>!Number.isSafeInteger(p.total)))return null;
 return {videoCount:ids.length,observationCount:points.length*ids.length,points};
}
