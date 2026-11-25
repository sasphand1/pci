'use client';
import {useState,type ReactNode} from 'react';
import type {Peer} from './youtube-profile-data.mjs';
import {Link} from '@/fifi/router';
import {Pic} from '@/fifi/components/page-elements';
import type {RealCreator} from '@/fifi/lib/real';
import type {PubCreatorAnalytics} from '@/lib/public';
import {hasChange} from './creator-chart-data.mjs';
import type {PubCreatorsBucket} from '@/lib/creators-bucket';
import {bucketPoints,dailyRates,averagePace,periodComparison,rankVideos,type BucketPoint,type VideoMetric} from './bucket-chart-data.mjs';
import {PeriodComparisonChart,EngagementScatter,pointLabel,exact,timestamp} from './creator-bucket-charts';

export type ProfilePlatform='youtube'|'instagram'|'tiktok';
export type CreatorProfileProps={creator:RealCreator;rank:string;rankLabel:string;
 accounts:{platform:string;handle:string;url:string|null;followers:string;followersCount?:number|null;views:string;posts30d:string;asOf:string}[];
 ytAccounts:{handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;asOf:string|null;avatarUrl?:string|null}[];
 analytics:Pick<PubCreatorAnalytics,'history'|'growth'|'video'|'historyAccountCount'>|null;
 creatorsBucket?:PubCreatorsBucket|null;ytRank?:string;
 comparison:{slug:string;name:string;value:number;self:boolean}[];comparisonPeers?:Peer[];rankingDate:string|null;
 platforms?:ProfilePlatform[];initialPlatform?:string|null};

const fmt=(v:number|string|null|undefined)=>v==null?'Not available':typeof v==='string'?v:new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
const full=(v:number|null|undefined)=>v==null?'—':Number(v).toLocaleString('en-US');
const date=(t:number|string)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const longDate=(t:string)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const sum=(xs:(number|null)[])=>xs.length&&xs.every(x=>x!==null)?xs.reduce<number>((s,x)=>s+(x??0),0):null;

function Tiles({items}:{items:[string,number|string|null|undefined][]}){
 return <div className="yt-kpis">{items.map(([k,v])=><div key={k} className="yt-tile"><small>{k}</small><strong title={typeof v==='number'?exact(v):undefined}>{fmt(v)}</strong></div>)}</div>;
}
/** Horizontal bars: name, track, value. Bar length is an SVG rect, so no inline CSS. */
function Bars({rows,percent=false}:{rows:{key:string;name:string;value:number;selected:boolean;href?:string;at?:string|null}[];percent?:boolean}){
 const [focus,setFocus]=useState<string|null>(null);
 const max=Math.max(1e-12,...rows.map(r=>r.value));
 return <div>{rows.map(r=>{const label=r.name+': '+exact(r.value)+(percent?'%':'')+(r.at?' · '+timestamp(r.at):'');return <div key={r.key} className="yt-barrow" onPointerEnter={()=>setFocus(label)} onPointerLeave={()=>setFocus(null)}>
  <span>{r.href?<a href={r.href} target="_blank" rel="noopener noreferrer">{r.name}</a>:r.name}</span>
  <svg className="yt-track" viewBox="0 0 100 13" preserveAspectRatio="none" role="img" aria-label={label} tabIndex={0} onFocus={()=>setFocus(label)} onBlur={()=>setFocus(null)} onClick={()=>setFocus(label)}><title>{label}</title><rect width="100" height="13" rx="3" className="yt-track-bg"/><rect width={r.value/max*100} height="13" rx="3" className={r.selected?'yt-fill yt-selected':'yt-fill'}/></svg>
  <strong title={label}>{percent?r.value.toFixed(2)+'%':fmt(r.value)}</strong></div>;})}{focus&&<p className="yt-note" aria-live="polite">{focus}</p>}</div>;
}
/** Same chart card and SVG geometry, with exact point hover/focus/tap details. */
function Trend({title,points,area=false,fallback=null,rank=false}:{title:string;points:BucketPoint[];area?:boolean;fallback?:number|null;rank?:boolean}){
 const [focus,setFocus]=useState<string|null>(null);const p=points;
 const valueLabel=(v:number|null)=>v===null?'Not available':rank?'#'+fmt(v):fmt(v);
 if(p.length<2||!hasChange(p)||p.at(-1)!.time===p[0].time)return <section className="yt-card"><h3>{title}</h3><strong className="yt-number">{valueLabel(p.at(-1)?.value??fallback)}</strong><p className="yt-note">{p.length<2?'Insufficient observations for a trend.':'No recorded change in this period.'}</p></section>;
 const lo=Math.min(...p.map(q=>q.value)),hi=Math.max(...p.map(q=>q.value)),start=p[0].time,end=p.at(-1)!.time;
 const x=(t:number)=>65+(t-start)/(end-start)*510,y=(v:number)=>rank?25+(v-lo)/(hi-lo)*175:200-(v-lo)/(hi-lo)*175;
 const coords=p.map(q=>x(q.time)+','+y(q.value)).join(' ');
 const step=p.map((q,i)=>i===0?'M'+x(q.time)+' '+y(q.value):'H'+x(q.time)+' V'+y(q.value)).join(' ');
 return <section className="yt-card"><h3>{title}</h3>
  <svg className="yt-chart" viewBox="0 0 600 235" role="img" aria-label={title}>
   {Array.from({length:5},(_,i)=>lo+(hi-lo)*i/4).filter(v=>!rank||Number.isInteger(v)).map((v,i)=><g key={i}><line x1="65" x2="575" y1={y(v)} y2={y(v)} stroke="#e1e9e3"/><text x="57" y={y(v)+4} textAnchor="end" fontSize="11" fill="#52675d">{valueLabel(v)}</text></g>)}
   {area&&<polygon points={'65,200 '+coords+' 575,200'} fill="#B4D4C3"/>}
   {rank?<path d={step} fill="none" stroke="#146C4B" strokeWidth="2.5" strokeLinejoin="round"/>:<polyline points={coords} fill="none" stroke="#146C4B" strokeWidth="2.5" strokeLinejoin="round"/>}
   {p.map(q=>{const label=(rank?'Rank #':'')+pointLabel(q);return <g key={q.time} tabIndex={0} aria-label={label} onPointerEnter={()=>setFocus(label)} onPointerLeave={()=>setFocus(null)} onFocus={()=>setFocus(label)} onBlur={()=>setFocus(null)} onClick={()=>setFocus(label)}><title>{label}</title><circle cx={x(q.time)} cy={y(q.value)} r="9" fill="transparent"/><circle cx={x(q.time)} cy={y(q.value)} r="3" fill="#146C4B"/></g>;})}
   <text x="65" y="225" fontSize="11">{date(start)}</text><text x="575" y="225" fontSize="11" textAnchor="end">{date(end)}</text>
  </svg><p className="yt-note" aria-live="polite">{focus??p.length+' recorded points · hover, tap or focus for values'}</p></section>;
}
const percent=(n:number|null|undefined)=>n==null?null:n.toFixed(2)+'%';
const TOP_METRICS:{key:VideoMetric;label:string}[]=[{key:'currentViews',label:'Views'},{key:'likes',label:'Likes'},{key:'comments',label:'Comments'},{key:'engagementRate',label:'Engagement'},{key:'likeRate',label:'Like rate'}];
/** All creator accounts now use the same person-level profile dashboard. */
export {CreatorProfilePage} from './creator-profile';
