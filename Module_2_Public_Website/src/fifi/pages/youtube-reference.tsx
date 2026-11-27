'use client';
import {useState,type ReactNode} from 'react';
import {localBands,type Band,type Point,type AgePoint,type Peer} from './youtube-profile-data.mjs';

const fmt=(v:number|null|undefined,digits=2)=>v==null?'—':Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:digits}).format(v);
const exact=(v:number|null|undefined)=>v==null?'Not available':Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v);
const pct=(v:number|null)=>v==null?'—':v.toFixed(1)+'%';
const signed=(v:number|null,compact=false)=>v==null?'—':(v>=0?'+':'')+(compact?fmt(v):exact(v));
const date=(v:string|number|null|undefined)=>v==null||!Number.isFinite(new Date(v).getTime())?'Not available':new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const time=(v:number|string)=>new Date(v).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',timeZone:'UTC'}).replace(',','');
const shortDate=(v:string|number)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const videoUrl=(id:string)=>'https://www.youtube.com/watch?v='+encodeURIComponent(id);
const color=(i:number)=>`yr-color-${i%6}`;
function Empty({children='Not enough recorded observations yet.'}:{children?:ReactNode}){return <div className="yr-empty">{children}</div>}
export function LineChart({points,label}:{points:Point[];label:string}){
 const [focus,setFocus]=useState<string|null>(null);const p=points;
 if(!p.length)return <Empty/>;
 const min=Math.min(...p.map(x=>x.value)),max=Math.max(...p.map(x=>x.value)),range=max-min||Math.max(Math.abs(max)*.1,1);
 const low=Math.max(0,min-range*.25),high=Math.max(low+1,max+range*.2);
 const start=p[0].time,end=p.at(-1)!.time,days=Math.round((end-start)/86400000)+1,width=Math.max(535,90+days*49),right=width-20;
 const x=(v:number)=>end===start?(60+right)/2:60+(v-start)/(end-start)*(right-60);
 const y=(v:number)=>174-(v-low)/(high-low)*150;
 const segments:Point[][]=[];for(const q of p){const seg=segments.at(-1);if(!seg||q.time-seg.at(-1)!.time>86400000)segments.push([q]);else seg.push(q);}
 return <><div className="yr-daily-scroll"><svg className="yr-line-plot" viewBox={`0 0 ${width} 207`} width={width} height={207} role="img" aria-label={label}>
 {Array.from({length:4},(_,i)=>low+(high-low)*i/3).map((v,i)=><g key={i}><line x1="60" x2={right} y1={y(v)} y2={y(v)} className="yr-gridline"/><text x="51" y={y(v)+4} textAnchor="end">{fmt(v,3)}</text></g>)}
 {segments.map((seg,i)=>{const line=seg.map(q=>`${x(q.time)},${y(q.value)}`).join(' ');return seg.length>1?<g key={i}><polygon className="yr-area" points={`${x(seg[0].time)},174 ${line} ${x(seg.at(-1)!.time)},174`}/><polyline className="yr-line" points={line}/></g>:null})}
 {p.map(q=>{const desc=`${date(q.time)} UTC: ${exact(q.value)}${label.includes('gain')?' views/day':' views'}`;return <g key={q.time} tabIndex={0} aria-label={desc} onFocus={()=>setFocus(desc)} onBlur={()=>setFocus(null)} onPointerEnter={()=>setFocus(desc)} onPointerLeave={()=>setFocus(null)}><title>{desc}</title><circle cx={x(q.time)} cy={y(q.value)} r="9" fill="transparent"/><circle className="yr-dot" cx={x(q.time)} cy={y(q.value)} r="4"/></g>})}
 {Array.from({length:days},(_,i)=>start+i*86400000).map(t=><text key={t} x={x(t)} y="195" textAnchor="middle">{shortDate(t)}</text>)}</svg></div><p className="yr-daily-readout" aria-live="polite">{focus??'Select a point to see its recorded value.'}</p></>;
}
export function HorizontalBars({rows,compact=false,displayExact=false,rounded=false}:{displayExact?:boolean;rounded?:boolean;rows:{label:string;value:number|null;color:number;href?:string;key:string}[];compact?:boolean}){
 if(!rows.length)return <Empty>No comparable recorded values available.</Empty>;
 const max=Math.max(1,...rows.flatMap(r=>r.value===null?[]:[r.value]));return <div className={'yr-bars'+(compact?' yr-bars-compact':'')}>{rows.map((r,i)=>{const label=`${r.label}: ${rounded?fmt(r.value):exact(r.value)}${rounded&&r.value!==null?' (rounded public count)':''}`;const content=<>{compact&&<span className="yr-index">{i+1}</span>}<span className="yr-row-label" title={r.label}>{r.label}</span><svg viewBox="0 0 100 10" preserveAspectRatio="none" role="img" aria-label={label}><title>{label}</title><rect className="yr-track" width="100" height="10" rx="5"/>{r.value!==null&&<rect className={color(r.color)} width={100*r.value/max} height="10" rx="5"/>}</svg><strong>{displayExact&&r.value!==null?exact(r.value):fmt(r.value,2)}</strong></>;return r.href?<a key={r.key} className="yr-bar-row" href={r.href} target="_blank" rel="noopener noreferrer" aria-label={label}>{content}</a>:<div key={r.key} className="yr-bar-row">{content}</div>})}</div>;
}
export function Scatter({points}:{points:AgePoint[]}){
 if(!points.length)return <Empty/>;const maxAge=Math.max(1,...points.map(p=>p.days)),maxViews=Math.max(1,...points.map(p=>p.value));
 const x=(d:number)=>58+455*d/maxAge,y=(v:number)=>265-230*Math.sqrt(v/maxViews); // square-root axis expands dense low-view region, labels match actual scale
 return <svg className="yr-plot yr-scatter" viewBox="0 0 535 300" role="img" aria-label="Views by actual video age; square-root view axis">
 {[0,.25,.5,.75,1].map(t=>{const v=t*t*maxViews;return <g key={t}><line x1="58" x2="513" y1={y(v)} y2={y(v)} className="yr-gridline"/><text x="50" y={y(v)+4} textAnchor="end">{fmt(v)}</text></g>})}
 {points.map(p=><a key={p.videoId} href={videoUrl(p.videoId)} target="_blank" rel="noopener noreferrer" aria-label={`${p.title}: ${exact(p.value)} views, ${p.days.toFixed(1)} days old`}><title>{p.title}: {exact(p.value)} views · {p.days.toFixed(1)} days</title><circle className="yr-scatter-dot" cx={x(p.days)} cy={y(p.value)} r="4.4"/></a>)}
 <text x="58" y="289">Newer</text><text x="513" y="289" textAnchor="end">Older · {Math.ceil(maxAge)} days</text></svg>;
}
export function BandChart({rows}:{rows:Band[]}){if(!rows.length)return <Empty/>;const shown=localBands(rows),max=Math.max(1,...shown.map(r=>r.value)),step=525/shown.length;return <svg className="yr-plot yr-band-plot" viewBox="0 0 535 300" role="img" aria-label="Number of tracked videos within each view range">{[.25,.5,.75].map(t=><line key={t} x1="5" x2="530" y1={253-t*190} y2={253-t*190} className="yr-gridline"/>)}{shown.map((r,i)=>{const cx=5+(i+.5)*step,h=r.value/max*190,w=Math.min(44,step*.48);return <g key={r.label} tabIndex={0} aria-label={`${r.label}: ${r.value} videos`}><title>{r.label}: {r.value} videos</title>{r.value>0?<rect className={color(i)} x={cx-w/2} y={253-h} width={w} height={h} rx="4"/>:<circle className={color(i)} cx={cx} cy="253" r="2.5"/>}<text className="yr-band-number" x={cx} y="56" textAnchor="middle">{r.value}</text><text x={cx} y="272" textAnchor="middle">{r.label}</text></g>})}<line x1="5" x2="530" y1="284" y2="284" className="yr-gridline"/></svg>}
export function GroupedBars({peers,groups,distribution=false}:{peers:Peer[];groups:{label:string;values:(number|null)[]}[];distribution?:boolean}){
 const [active,setActive]=useState<string|null>(null),[selected,setSelected]=useState<{group:string;slug:string}|null>(null);
 const visible=peers.map((p,i)=>({p,i})).filter(({p})=>active===null||p.slug===active);
 if(!groups.length)return <Empty>No comparable observed intervals available yet.</Empty>;
 if(distribution&&active!==null){const i=visible[0]?.i;if(i!==undefined&&groups.some(g=>g.values[i]!==null)){let last=groups.reduce((last,g,j)=>(g.values[i]??0)>0?j:last,-1);groups=groups.slice(0,Math.max(3,last+1));}}
 const rawMax=Math.max(1,...groups.flatMap(g=>visible.flatMap(({i})=>g.values[i]===null||g.values[i]===undefined?[]:[g.values[i]!] ))),max=distribution?Math.ceil(rawMax/4)*4:rawMax;
 const width=Math.max(720,groups.length*(visible.length*22+34)),step=(width-75)/groups.length,bw=Math.min(34,(step-12)/Math.max(visible.length,1));
 const chosen=selected?groups.find(g=>g.label===selected.group):null,person=selected?peers.findIndex(p=>p.slug===selected.slug):-1;
 const detail=chosen&&person>=0?`${peers[person].name} · ${chosen.label}: ${exact(chosen.values[person])}${chosen.values[person]==null?'':distribution?' videos':' views/day'}`:distribution?'Each bar counts videos in that view range. Select a bar for its count.':'Select a bar to see its daily rate.';
 return <><div className="yr-legend yr-legend-controls" role="group" aria-label="Focus comparison on a creator"><button type="button" aria-pressed={active===null} onClick={()=>{setActive(null);setSelected(null)}}>All creators</button>{peers.map((p,i)=><button type="button" key={p.slug} aria-pressed={active===p.slug} onClick={()=>{setActive(active===p.slug?null:p.slug);setSelected(null)}}><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect className={color(i)} width="12" height="12" rx="3"/></svg>{p.name}</button>)}</div>
 <div className="yr-scroll-plot"><svg className="yr-grouped" viewBox={`0 0 ${width} 270`} width={width} role="group" aria-label={distribution?'Video view bands by creator':'Daily view-gain rates by creator'}>{[0,.25,.5,.75,1].map(t=><g key={t}><line className="yr-gridline" x1="65" x2={width-8} y1={220-t*190} y2={220-t*190}/><text x="56" y={224-t*190} textAnchor="end">{fmt(max*t)}</text></g>)}{groups.map((g,i)=><g key={g.label}>{visible.map(({p,i:j},k)=>{const n=g.values[j],x=65+i*step+(step-bw*visible.length)/2+k*bw;const label=`${p.name} · ${g.label}: ${exact(n)}${n==null?'':distribution?' videos':' views/day'}`;const choose=()=>setSelected({group:g.label,slug:p.slug});return <g key={p.slug} role="button" tabIndex={0} aria-label={label} aria-pressed={selected?.group===g.label&&selected.slug===p.slug} onPointerEnter={choose} onFocus={choose} onClick={choose} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose()}}}><title>{label}</title><rect className="yr-bar-hit" x={x} y="24" width={bw} height="205" rx="2" fill="transparent"/>{n==null?<line className="yr-missing" x1={x+3} x2={x+bw-3} y1="216" y2="216"/>:n===0?<circle className={color(j)} cx={x+bw/2} cy="220" r="2.5"/>:<rect className={color(j)} x={x+2} y={220-n/max*190} width={Math.max(1,bw-4)} height={n/max*190} rx="2"/>}</g>})}<text x={65+(i+.5)*step} y="246" textAnchor="middle">{g.label}</text></g>)}</svg></div>
 <p className="yr-comparison-detail" aria-live="polite">{detail}</p></>;
}
