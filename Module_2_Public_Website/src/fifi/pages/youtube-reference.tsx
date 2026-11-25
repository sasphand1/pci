'use client';
import {useState,type ReactNode} from 'react';
import {Link} from '@/fifi/router';
import {Pic} from '@/fifi/components/page-elements';
import type {CreatorProfileProps} from './creator';
import {bucketPoints,dailyRates,averagePace,type BucketPoint} from './bucket-chart-data.mjs';
import {observedPortfolio,type Band} from './youtube-profile-data.mjs';

const fmt=(v:number|null|undefined)=>v==null?'—':Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
const exact=(v:number|null|undefined)=>v==null?'Not available':Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(v);
const pct=(v:number|null)=>v==null?'—':v.toFixed(1)+'%';
const date=(v:string|number|null|undefined)=>v==null||!Number.isFinite(new Date(v).getTime())?'Not available':new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const shortDate=(v:number)=>new Date(v).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const sum=(values:(number|null)[])=>values.length&&values.every(v=>v!==null)?values.reduce<number>((a,b)=>a+(b??0),0):null;
function MetricCard({label,value,note}:{label:string;value:string;note:string}){return <article className="yr-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}
function ChartCard({title,subtitle,children}:{title:string;subtitle:string;children:ReactNode}){return <article className="yr-card"><h3>{title}</h3><p className="yr-sub">{subtitle}</p>{children}</article>}
function Empty({children='Not enough recorded data yet.'}:{children?:ReactNode}){return <div className="yr-empty">{children}</div>}
function LineChart({points,area=false,bars=false,rank=false}:{points:BucketPoint[];area?:boolean;bars?:boolean;rank?:boolean}){
 const [selected,setSelected]=useState<string|null>(null);
 const p=points;if(p.length<(bars?1:2))return <Empty/>;
 const min=Math.min(...p.map(x=>x.value)),max=Math.max(...p.map(x=>x.value));
 const low=bars?0:min,high=max===low?low+1:max;
 const start=p[0].time,end=p.at(-1)!.time;
 const x=(v:number)=>end===start?265:58+(v-start)/(end-start)*414;
 const y=(v:number)=>rank?20+(v-low)/(high-low)*135:155-(v-low)/(high-low)*135;
 const line=p.map(q=>`${x(q.time)},${y(q.value)}`).join(' ');
 const ticks=Array.from({length:5},(_,i)=>low+(high-low)*i/4);
 return <><svg className="yr-plot" viewBox="0 0 490 185" role="img" aria-label="Recorded observations chart">
 {ticks.map((v,i)=><g key={i}><line x1="58" x2="472" y1={y(v)} y2={y(v)} className="yr-gridline"/><text x="50" y={y(v)+3} textAnchor="end">{rank?'#'+Math.round(v):fmt(v)}</text></g>)}
 {area&&!bars&&<polygon className="yr-area" points={`${x(start)},155 ${line} ${x(end)},155`}/>}
 {!bars&&<polyline className="yr-line" points={line}/>}
 {p.map((q,i)=>{const label=`${date(q.time)}: ${rank?'#':''}${exact(q.value)}${q.from===undefined?'':` · from ${date(q.from)}`}`;return <g key={q.time} tabIndex={0} aria-label={label} onFocus={()=>setSelected(label)} onBlur={()=>setSelected(null)} onPointerEnter={()=>setSelected(label)} onPointerLeave={()=>setSelected(null)} onClick={()=>setSelected(label)}><title>{label}</title>{bars?<rect className="yr-bar" x={x(q.time)-Math.min(9,180/p.length)} y={y(q.value)} width={Math.min(18,360/p.length)} height={Math.max(0,155-y(q.value))} rx="2"/>:<><circle cx={x(q.time)} cy={y(q.value)} r="8" fill="transparent"/><circle className="yr-dot" cx={x(q.time)} cy={y(q.value)} r={i===p.length-1?3.5:2.4}/></>}</g>})}
 <text x="58" y="175">{shortDate(start)}</text>{end!==start&&<text x="472" y="175" textAnchor="end">{shortDate(end)}</text>}
 </svg><p className="yr-chart-note" aria-live="polite">{selected??`${p.length} recorded ${bars?'intervals':'observations'}`}</p></>;
}
function HorizontalBars({rows}:{rows:{label:string;value:number;self?:boolean;href?:string}[]}){
 if(!rows.length)return <Empty>No comparable recorded values available.</Empty>;
 const max=Math.max(1,...rows.map(r=>r.value));return <div className="yr-bars">{rows.map((r,i)=><div className={'yr-bar-row'+(r.self?' yr-self':'')} key={i}><span title={r.label}>{r.href?<a href={r.href} target="_blank" rel="noopener noreferrer">{r.label}</a>:r.label}</span><svg viewBox="0 0 100 12" preserveAspectRatio="none" role="img" aria-label={`${r.label}: ${exact(r.value)}`}><title>{exact(r.value)}</title><rect className="yr-track" width="100" height="12" rx="2"/><rect className={r.self?'yr-bar-active':'yr-bar'} width={100*r.value/max} height="12" rx="2"/></svg><strong>{fmt(r.value)}</strong></div>)}</div>;
}
function BandChart({rows}:{rows:Band[]}){if(!rows.length)return <Empty/>;const max=Math.max(1,...rows.map(r=>r.value));return <svg className="yr-plot yr-band-plot" viewBox="0 0 490 185" role="img" aria-label="Tracked video distribution">{[0,.25,.5,.75,1].map(t=><g key={t}><line x1="53" x2="475" y1={150-t*125} y2={150-t*125} className="yr-gridline"/><text x="46" y={153-t*125} textAnchor="end">{fmt(t*max)}</text></g>)}{rows.map((r,i)=><g key={r.label} tabIndex={0} aria-label={`${r.label}: ${exact(r.value)}`}><title>{r.label}: {exact(r.value)}</title><rect className="yr-bar" x={72+i*83} y={150-r.value/max*125} width="44" height={r.value/max*125} rx="3"/><text x={94+i*83} y="170" textAnchor="middle">{r.label}</text></g>)}</svg>}
function Observation({label,value,children}:{label:string;value:string;children:ReactNode}){return <article className="yr-observation"><span>{label}</span><strong>{value}</strong><p>{children}</p></article>}
const COMPARE=['Subscribers','Lifetime views','Public videos','Average daily views gained'] as const;
export function YouTubeReference({creator,ytRank,ytAccounts,creatorsBucket:bucket,comparison,rankingDate,switcher}:CreatorProfileProps&{switcher?:ReactNode}){
 const [metric,setMetric]=useState<(typeof COMPARE)[number]>('Subscribers');
 const [span,setSpan]=useState(30);
 const subs=bucket?bucket.totals.subscribers:sum(ytAccounts.map(a=>a.followers));
 const views=bucket?bucket.totals.views:sum(ytAccounts.map(a=>a.views));
 const totalVideos=bucket?.totals.totalVideos??null;
 const recorded=ytAccounts.map(a=>a.asOf).filter((s):s is string=>!!s).sort().at(-1)??null;
 const vp=bucketPoints(bucket?.history.views??[],span),sp=bucketPoints(bucket?.history.subscribers??[],span),rp=bucketPoints(bucket?.history.ranks??[],span);
 const rates=dailyRates(vp),pace=averagePace(vp);
 const portfolio=observedPortfolio(bucket?.video.videos??[]);
 const handle=bucket?.primaryHandle||ytAccounts[0]?.handle||'';
 const ownMetric=metric==='Lifetime views'?views:metric==='Public videos'?totalVideos:pace;
 const comparable=metric==='Subscribers'?comparison.map(c=>({label:c.name,value:c.value,self:c.self})):ownMetric==null?[]:[{label:creator.name,value:ownMetric,self:true}];
 const top=portfolio.known.slice(0,5).flatMap(v=>v.currentViews===null?[]:[{label:v.title,value:v.currentViews,href:'https://www.youtube.com/watch?v='+encodeURIComponent(v.videoId)}]);
 return <main className="page-main pci-yt-reference">
 <div className="yr-breadcrumb"><Link to="/creators">← Creator Index</Link><span>/</span> Creator profile</div>
 {switcher}
 <section className="yr-hero">
  <div className="yr-identity"><Pic src={creator.image} alt={creator.name} className="yr-avatar"/><div><div className="yr-eyebrow"><span className="yr-youtube-mark">▶</span> YOUTUBE CREATOR PROFILE</div><h1>{creator.name}</h1><p className="yr-handle">{handle||'YouTube'} <span>·</span> {creator.category} <span>·</span> Pakistan</p><div className="yr-rank">PCI rank {ytRank??'Not ranked'}</div></div></div>
  <div className="yr-fresh"><span>DATA AS OF</span><strong>{date(recorded)}</strong><small>Source: PCI Data Hub</small></div>
 </section>
 <div className="yr-kpis">
  <MetricCard label="Subscribers" value={fmt(subs)} note="YouTube public count"/>
  <MetricCard label="Lifetime views" value={fmt(views)} note="Total channel views"/>
  <MetricCard label="Public videos" value={fmt(totalVideos)} note="Public channel uploads"/>
  <MetricCard label="Average daily views gained" value={fmt(pace)} note={`Observed intervals · ${span} days`}/>
 </div>
 <div className="yr-notice"><span className="yr-info">i</span><div><strong>Baseline &amp; coverage notice</strong><p>Figures reflect recorded public YouTube observations. Historical growth requires sufficient observations; unavailable values are not estimated. {bucket?.historyAccountCount&&bucket.historyAccountCount>1?`History covers ${handle||'the primary channel'}; totals cover linked YouTube accounts.`:''}</p></div></div>
 <div className="yr-kpis">
  <MetricCard label="Tracked views" value={fmt(portfolio.total)} note={bucket?`${portfolio.known.length} videos with observed views`:'Video observations unavailable'}/>
  <MetricCard label="Top-video share" value={pct(portfolio.topShare)} note="Share of tracked views"/>
  <MetricCard label="Top-five share" value={pct(portfolio.topFiveShare)} note="Share of tracked views"/>
  <MetricCard label="Median tracked video" value={fmt(portfolio.median)} note="Median views in tracked sample"/>
 </div>
 <section className="yr-section"><div className="yr-section-head"><div><h2>Growth signals</h2><p>Observed channel performance and ranking history</p></div><div className="yr-tabs" role="group" aria-label="Observation window">{[7,30,90].map(n=><button type="button" key={n} aria-pressed={span===n} onClick={()=>setSpan(n)}>{n}D</button>)}</div></div><div className="yr-grid">
  <ChartCard title="Daily views gained" subtitle="Observed daily view-gain rate"><LineChart points={rates} bars/></ChartCard>
  <ChartCard title="Lifetime view growth" subtitle="Recorded channel view count"><LineChart points={vp} area/></ChartCard>
  <ChartCard title="Subscriber history" subtitle="Recorded public subscriber count"><LineChart points={sp}/></ChartCard>
  <ChartCard title="PCI rank movement" subtitle="Published YouTube subscriber ranking"><LineChart points={rp} rank/></ChartCard>
 </div></section>
 <section className="yr-section"><div className="yr-section-head"><div><h2>Creator comparison</h2><p>Compare public YouTube metrics across PCI creators</p></div></div><article className="yr-card yr-comparison"><div className="yr-tabs" role="group" aria-label="Comparison metric">{COMPARE.map(m=><button type="button" key={m} aria-pressed={metric===m} onClick={()=>setMetric(m)}>{m}</button>)}</div><HorizontalBars rows={comparable}/><p className="yr-chart-note">{metric==='Subscribers'?`Published PCI ranking · ${date(rankingDate)}`:'Peer values not connected yet; only the selected creator is shown when recorded.'}</p></article></section>
 <section className="yr-section"><div className="yr-section-head"><div><h2>Portfolio analytics</h2><p>Analysis of recorded videos in the tracked sample</p></div></div><div className="yr-grid">
  <ChartCard title="Views by video age" subtitle="Observed views grouped by age at observation"><BandChart rows={portfolio.age}/><p className="yr-chart-note">{portfolio.dated} videos with known publication and observation dates</p></ChartCard>
  <ChartCard title="Tracked videos by view band" subtitle="Distribution of tracked video performance"><BandChart rows={portfolio.bands}/><p className="yr-chart-note">{portfolio.known.length} videos with observed views</p></ChartCard>
  <ChartCard title="Daily view-gain rate by interval" subtitle="Actual elapsed days between valid observations"><LineChart points={rates}/></ChartCard>
  <ChartCard title="Top-performing tracked videos" subtitle="Ranked by observed lifetime video views"><HorizontalBars rows={top}/></ChartCard>
 </div></section>
 <section className="yr-section"><div className="yr-section-head"><div><h2>Provenance &amp; validation</h2><p>Source-backed observations and data coverage</p></div></div><div className="yr-provenance">
  <Observation label="Channel observations" value={exact(bucket?vp.length:null)}>Recorded view readings within the selected period.</Observation>
  <Observation label="Video sample coverage" value={exact(bucket?portfolio.known.length:null)}>Tracked videos with a recorded public view count.</Observation>
  <Observation label="Latest channel observation" value={date(recorded)}>Latest available linked YouTube account observation.</Observation>
 </div><p className="yr-foot">Source: PCI Data Hub / Creators Bucket. YouTube public subscriber counts are rounded by YouTube. Daily rates use elapsed observation intervals; no missing history is backfilled.</p></section>
 </main>;
}
