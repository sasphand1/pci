'use client';
import {useState} from 'react';
import type {BucketVideo} from '@/lib/creators-bucket';
import type {BucketPoint,ComparisonData} from './bucket-chart-data.mjs';
const compact=(v:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
export const exact=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:6});
export const timestamp=(v:number|string)=>new Date(v).toISOString().replace('T',' ').replace('.000Z',' UTC').replace('Z',' UTC');
export const pointLabel=(p:BucketPoint)=>`${exact(p.value)} · ${p.from===undefined?'Observed '+timestamp(p.time):timestamp(p.from)+' → '+timestamp(p.time)}`;
const date=(t:number)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
export function PeriodComparisonChart({data}:{data:ComparisonData|null}){
 const [focus,setFocus]=useState<string|null>(null);
 if(!data)return <section className="yt-card"><h3>Current vs previous period</h3><p className="yt-note">Not enough continuous recorded observations for both periods. No values have been filled in.</p></section>;
 const {current,previous,days,start,end,previousStart}=data;
 if(current.every(p=>p.value===current[0].value)&&previous.every(p=>p.value===previous[0].value))return <section className="yt-card"><h3>Current vs previous period · daily view pace</h3><div className="yt-kpis"><div className="yt-tile"><small>Current period</small><strong title={exact(current[0].value)}>{compact(current[0].value)}</strong></div><div className="yt-tile"><small>Previous period</small><strong title={exact(previous[0].value)}>{compact(previous[0].value)}</strong></div></div><p className="yt-note">Both recorded series are flat; numerical values replace redundant graphs.</p></section>;
 const all=[...current,...previous],max=Math.max(1,...all.map(p=>p.value)),x=(d:number)=>65+d/days*510,y=(v:number)=>200-v/max*175;
 const sets=[{name:'Current period',color:'#146C4B',points:current,dash:undefined},{name:'Previous period',color:'#B4D4C3',points:previous,dash:'5 3'}];
 return <section className="yt-card"><h3>Current vs previous period · daily view pace</h3><p className="yt-note">Current: {date(start)}–{date(end)} · Previous: {date(previousStart)}–{date(start)}</p><svg className="yt-chart" viewBox="0 0 600 245" role="img" aria-label="Recorded daily view rates for two comparable periods">
 {Array.from({length:5},(_,i)=>{const v=max*i/4;return <g key={i}><line x1="65" x2="575" y1={y(v)} y2={y(v)} stroke="#e1e9e3"/><text x="57" y={y(v)+4} textAnchor="end" fontSize="11" fill="#52675d">{compact(v)}</text></g>;})}
 {sets.map(s=><g key={s.name}><polyline points={s.points.map(p=>`${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinejoin="round"/>{s.points.map(p=>{const label=`${s.name}: ${pointLabel(p)}`;return <g key={p.time} tabIndex={0} aria-label={label} onPointerEnter={()=>setFocus(label)} onPointerLeave={()=>setFocus(null)} onFocus={()=>setFocus(label)} onBlur={()=>setFocus(null)} onClick={()=>setFocus(label)}><title>{label}</title><circle cx={x(p.day)} cy={y(p.value)} r="9" fill="transparent"/><circle cx={x(p.day)} cy={y(p.value)} r="3" fill={s.color} stroke="#146C4B" strokeWidth=".5"/></g>;})}</g>)}
 <text x="65" y="218" fontSize="11">Day 0</text><text x="575" y="218" textAnchor="end" fontSize="11">Day {days}</text><line x1="65" x2="85" y1="236" y2="236" stroke="#146C4B" strokeWidth="3"/><text x="91" y="240" fontSize="11">Current</text><line x1="180" x2="200" y1="236" y2="236" stroke="#B4D4C3" strokeWidth="3" strokeDasharray="5 3"/><text x="206" y="240" fontSize="11">Previous</text>
 </svg><p className="yt-note" aria-live="polite">{focus??'Hover, tap or focus a point for its exact measurement interval. Rates are aligned by elapsed time.'}</p></section>;
}
export function EngagementScatter({videos}:{videos:BucketVideo[]}){
 const [metric,setMetric]=useState<'engagementRate'|'likeRate'>('engagementRate');const [focus,setFocus]=useState<string|null>(null);
 const rows=videos.filter(v=>v.currentViews!==null&&v.currentViews>0&&v[metric]!==null);
 const xs=rows.map(v=>Math.log10(v.currentViews!)),lo=Math.floor(Math.min(...xs,1)),hi=Math.max(lo+1,Math.ceil(Math.max(...xs,1))),max=Math.max(.01,...rows.map(v=>v[metric]!));
 const x=(v:number)=>65+(Math.log10(v)-lo)/(hi-lo)*510,y=(v:number)=>200-v/max*175;
 return <section className="yt-card"><div className="yt-toolbar"><h3>Views vs {metric==='engagementRate'?'engagement':'like rate'}</h3><div className="yt-tabs" role="group" aria-label="Engagement metric">{(['engagementRate','likeRate'] as const).map(m=><button key={m} type="button" aria-pressed={metric===m} onClick={()=>{setMetric(m);setFocus(null);}}>{m==='engagementRate'?'Engagement':'Like rate'}</button>)}</div></div>
 {rows.length<2?<p className="yt-note">Insufficient videos with compatible recorded metrics. Missing likes or comments are not treated as zero.</p>:<><svg className="yt-chart" viewBox="0 0 600 245" role="img" aria-label="Video views versus recorded engagement rate, logarithmic views axis">
 {Array.from({length:5},(_,i)=>{const v=max*i/4;return <g key={i}><line x1="65" x2="575" y1={y(v)} y2={y(v)} stroke="#e1e9e3"/><text x="57" y={y(v)+4} textAnchor="end" fontSize="11" fill="#52675d">{v.toFixed(2)}%</text></g>;})}
 {Array.from({length:hi-lo+1},(_,i)=>Math.pow(10,lo+i)).map(v=><g key={v}><line x1={x(v)} x2={x(v)} y1="25" y2="200" stroke="#e1e9e3"/><text x={x(v)} y="218" fontSize="10" textAnchor="middle" fill="#52675d">{compact(v)}</text></g>)}
 {rows.map(v=>{const label=`${v.title} · ${exact(v.currentViews!)} views · ${v.likes===null?'likes unavailable':exact(v.likes)+' likes'} · ${v.comments===null?'comments unavailable':exact(v.comments)+' comments'} · ${exact(v[metric]!)}% · ${v.observedAt?timestamp(v.observedAt):'timestamp unavailable'}`;return <g key={v.videoId} tabIndex={0} aria-label={label} onFocus={()=>setFocus(label)} onBlur={()=>setFocus(null)} onPointerEnter={()=>setFocus(label)} onPointerLeave={()=>setFocus(null)} onClick={()=>setFocus(label)}><title>{label}</title><circle cx={x(v.currentViews!)} cy={y(v[metric]!)} r="10" fill="transparent"/><circle cx={x(v.currentViews!)} cy={y(v[metric]!)} r="4.5" fill="#74AA8E" stroke="#146C4B" strokeWidth="1"/></g>;})}
 <text x="320" y="238" fontSize="11" textAnchor="middle" fill="#52675d">Public video views (log scale)</text></svg><p className="yt-note" aria-live="polite">{focus??`${rows.length} videos with compatible observations. ${metric==='engagementRate'?'(Likes + comments) ÷ views':'Likes ÷ views'} × 100.`}</p></>}
 </section>;
}
