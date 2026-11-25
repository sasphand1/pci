'use client';
import {useState,type ReactNode} from 'react';
import {Link} from '@/fifi/router';
import {Pic} from '@/fifi/components/page-elements';
import type {RealCreator} from '@/fifi/lib/real';
import type {PubCreatorAnalytics} from '@/lib/public';
import {observedSeries,intervalRates,hasChange,type ChartPoint} from './creator-chart-data.mjs';

export type ProfilePlatform='youtube'|'instagram'|'tiktok';
export type CreatorProfileProps={creator:RealCreator;rank:string;rankLabel:string;
 accounts:{platform:string;handle:string;url:string|null;followers:string;views:string;posts30d:string;asOf:string}[];
 ytAccounts:{handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;asOf:string|null}[];
 analytics:Pick<PubCreatorAnalytics,'history'|'growth'|'video'|'historyAccountCount'>|null;
 comparison:{slug:string;name:string;value:number;self:boolean}[];rankingDate:string|null;
 platforms?:ProfilePlatform[];initialPlatform?:string|null};

const fmt=(v:number|string|null|undefined)=>v==null?'Not available':typeof v==='string'?v:new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
const full=(v:number|null|undefined)=>v==null?'—':Number(v).toLocaleString('en-US');
const date=(t:number|string)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const longDate=(t:string)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
const sum=(xs:(number|null)[])=>xs.length&&xs.every(x=>x!==null)?xs.reduce<number>((s,x)=>s+(x??0),0):null;

function Tiles({items}:{items:[string,number|string|null|undefined][]}){
 return <div className="yt-kpis">{items.map(([k,v])=><div key={k} className="yt-tile"><small>{k}</small><strong>{fmt(v)}</strong></div>)}</div>;
}
/** Horizontal bars: name, track, value. Bar length is an SVG rect, so no inline CSS. */
function Bars({rows}:{rows:{key:string;name:string;value:number;selected:boolean;href?:string}[]}){
 const max=Math.max(1,...rows.map(r=>r.value));
 return <div>{rows.map(r=><div key={r.key} className="yt-barrow">
  <span>{r.href?<a href={r.href} target="_blank" rel="noopener noreferrer">{r.name}</a>:r.name}</span>
  <svg className="yt-track" viewBox="0 0 100 13" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="13" rx="3" className="yt-track-bg"/><rect width={Math.max(0.5,r.value/max*100)} height="13" rx="3" className={r.selected?'yt-fill yt-selected':'yt-fill'}/></svg>
  <strong>{fmt(r.value)}</strong></div>)}</div>;
}
/** Recorded-observation chart: 5 gridlines, polyline (area optional), a dot per reading, start/end dates. */
function Trend({title,points,area=false,fallback=null}:{title:string;points:ChartPoint[];area?:boolean;fallback?:number|null}){
 const p=points;
 if(p.length<2||!hasChange(p)||p.at(-1)!.time===p[0].time)return <section className="yt-card"><h3>{title}</h3><strong className="yt-number">{fmt(p.at(-1)?.value??fallback)}</strong><p className="yt-note">{p.length<2?'Insufficient observations for a trend.':'No recorded change in this period.'}</p></section>;
 const lo=Math.min(...p.map(q=>q.value)),hi=Math.max(...p.map(q=>q.value)),start=p[0].time,end=p.at(-1)!.time;
 const x=(t:number)=>65+(t-start)/(end-start)*510,y=(v:number)=>200-(v-lo)/(hi-lo)*175;
 const coords=p.map(q=>`${x(q.time)},${y(q.value)}`).join(' ');
 return <section className="yt-card"><h3>{title}</h3>
  <svg className="yt-chart" viewBox="0 0 600 235" role="img" aria-label={title}>
   {Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*i/4;return <g key={i}><line x1="65" x2="575" y1={y(v)} y2={y(v)} stroke="#e1e9e3"/><text x="57" y={y(v)+4} textAnchor="end" fontSize="11" fill="#52675d">{fmt(v)}</text></g>;})}
   {area&&<polygon points={`65,200 ${coords} 575,200`} fill="#B4D4C3"/>}
   <polyline points={coords} fill="none" stroke="#146C4B" strokeWidth="2.5" strokeLinejoin="round"/>
   {p.map(q=><circle key={q.time} cx={x(q.time)} cy={y(q.value)} r="3" fill="#146C4B"><title>{`${date(q.time)}: ${full(q.value)}`}</title></circle>)}
   <text x="65" y="225" fontSize="11">{date(start)}</text><text x="575" y="225" fontSize="11" textAnchor="end">{date(end)}</text>
  </svg><p className="yt-note">{p.length} observations</p></section>;
}

/** The YouTube view of any creator, built to match the approved reference layout (PCI-creator-final.html). */
function YouTubeCreatorView({creator,rank,rankLabel,ytAccounts,analytics,comparison,rankingDate,switcher}:CreatorProfileProps&{switcher?:ReactNode}){
 const [tab,setTab]=useState<'overview'|'content'|'accounts'>('overview');
 const [span,setSpan]=useState(30);
 const one=ytAccounts.length===1?ytAccounts[0]:null;
 const subscribers=one?.followers??sum(ytAccounts.map(a=>a.followers)),views=one?.views??sum(ytAccounts.map(a=>a.views)),posts30d=sum(ytAccounts.map(a=>a.posts30d));
 const recorded=ytAccounts.map(a=>a.asOf).filter((t):t is string=>Boolean(t)).sort().at(-1);
 const v=observedSeries(analytics?.history.views??[],span),s=observedSeries(analytics?.history.subscribers??[],span);
 const video=analytics?.video,videos=video?.videos??[];
 const top=[...videos].filter(x=>typeof x.currentViews==='number').sort((a,b)=>(b.currentViews??0)-(a.currentViews??0)).slice(0,5);
 return <main className="page-main pci-yt">
  <div className="yt-note"><Link to="/creators">← Creator Index</Link> / Creator profile</div>
  {switcher}
  <section className="yt-card">
   <div className="yt-profile"><Pic src={creator.image} alt={creator.name} className="yt-avatar"/><div className="yt-grow"><p className="yt-eyebrow">{creator.category} · Public profile</p><h1>{creator.name}</h1><p className="yt-note">YouTube · {creator.city}{recorded?` · Recorded ${longDate(recorded)}`:''}</p></div></div>
   <Tiles items={[['YouTube subscribers',subscribers],['YouTube lifetime views',views],['YouTube uploads · 30 days',posts30d],[rankLabel==='PCI ranking'?'PCI ranking':`PCI ranking · ${rankLabel}`,rank]]}/>
  </section>
  <nav className="yt-tabs" aria-label="Creator analytics sections">{(['overview','content','accounts'] as const).map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</nav>

  {tab==='overview'&&<section className="yt-panel">
   <div className="yt-toolbar"><h2>Channel performance</h2><div className="yt-tabs" role="group" aria-label="Observation window">{[7,30,90].map(n=><button key={n} type="button" aria-pressed={span===n} onClick={()=>setSpan(n)}>{n}D</button>)}</div></div>
   <Tiles items={[['Views gained · 7 days',analytics?.growth.views['7d']],['Views gained · 30 days',analytics?.growth.views['30d']],['Subscriber change · 30 days',analytics?.growth.subscribers['30d']]]}/>
   <div className="yt-grid"><Trend title="Views gained per day of observed interval" points={intervalRates(v)}/><Trend title="Lifetime view growth" points={v} area fallback={views}/><Trend title="Subscriber history" points={s} fallback={subscribers}/></div>
   {(analytics?.historyAccountCount??0)>1&&<p className="yt-note">History covers the first linked YouTube channel only. Multiple-channel totals are not inferred.</p>}
   <p className="yt-note">View rate is the recorded counter difference divided by elapsed days, not exact daily YouTube analytics. Missing intervals and counter decreases are not backfilled.</p>
   {comparison.length>1&&<section className="yt-card"><h3>Comparable creators · YouTube subscribers</h3>
    <Bars rows={comparison.map(c=>({key:c.slug,name:c.name,value:c.value,selected:c.self}))}/>
    <p className="yt-note">Top five from the published PCI YouTube ranking{rankingDate?`, ${longDate(rankingDate)}`:''}{comparison.length>5?'; this creator added for comparison':''}.</p></section>}
  </section>}

  {tab==='content'&&<section className="yt-panel">
   <h2>Video performance</h2>
   <Tiles items={[['Videos with observed views',video?.sampledVideos??null],['Average views per sampled video',video?.averageViews??null]]}/>
   {top.length>1&&<section className="yt-card"><h3>Top videos in tracked sample</h3><Bars rows={top.map((x,i)=>({key:x.videoId,name:x.title,value:x.currentViews??0,selected:i===0,href:`https://www.youtube.com/watch?v=${encodeURIComponent(x.videoId)}`}))}/></section>}
   <section className="yt-card"><h3>Recent tracked videos</h3>
    {videos.length?<div className="yt-table"><table><thead><tr>{['Video','Views','At 24h','At 7d','At 30d','Views/hour'].map(h=><th key={h}>{h}</th>)}</tr></thead>
     <tbody>{videos.map(x=><tr key={x.videoId}><td><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(x.videoId)}`} target="_blank" rel="noopener noreferrer">{x.title}</a></td>{[x.currentViews,x.views24h,x.views7d,x.views30d,x.velocityPerHour].map((n,i)=><td key={i}>{full(n==null?null:Math.round(n))}</td>)}</tr>)}</tbody></table></div>
     :<p className="yt-note">No verified video observations yet.</p>}
    <p className="yt-note">Video-age milestones require recorded observations. Likes, comments and total channel video count are not exposed by the current profile API.</p></section>
  </section>}

  {tab==='accounts'&&<section className="yt-panel"><section className="yt-card"><h2>Linked public accounts</h2>
   <div className="yt-table"><table><thead><tr>{['Platform','Account','Followers','Lifetime views','Posts, 30 days','As of'].map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{ytAccounts.map(a=><tr key={a.handle}><td>YouTube</td><td>{a.url?<a href={a.url} target="_blank" rel="noopener noreferrer">{a.handle}</a>:a.handle}</td><td>{fmt(a.followers)}</td><td>{fmt(a.views)}</td><td>{fmt(a.posts30d)}</td><td>{a.asOf?date(a.asOf):'Not available'}</td></tr>)}</tbody></table></div>
  </section></section>}

  <p className="yt-note">Source: PCI public API and recorded platform observations. A number older than 7 days is shown as not available rather than as zero. YouTube subscriber counts are rounded by YouTube. No fabricated historical values.</p>
 </main>;
}

const PLATFORM_LABEL:Record<ProfilePlatform,string>={youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok'};
/** Picks the platform view to open: the requested one if the creator has it, otherwise YouTube, Instagram, TikTok in that order. */
export function pickPlatform(platforms:ProfilePlatform[],requested?:string|null):ProfilePlatform{
 const order:ProfilePlatform[]=['youtube','instagram','tiktok'];const have=order.filter(p=>platforms.includes(p));
 return have.find(p=>p===requested)??have[0]??'youtube';
}
/** Instagram and TikTok get their own designs later; until then they show only that platform's recorded figures. */
function PlatformPendingView({creator,rank,rankLabel,accounts,platform,switcher}:CreatorProfileProps&{platform:ProfilePlatform;switcher?:ReactNode}){
 const mine=accounts.filter(a=>a.platform.toLowerCase()===platform);
 return <main className="page-main pci-yt">
  <div className="yt-note"><Link to="/creators">← Creator Index</Link> / Creator profile</div>{switcher}
  <section className="yt-card"><div className="yt-profile"><Pic src={creator.image} alt={creator.name} className="yt-avatar"/><div className="yt-grow"><p className="yt-eyebrow">{creator.category} · {PLATFORM_LABEL[platform]} profile</p><h1>{creator.name}</h1><p className="yt-note">{mine[0]?.handle??creator.handle} · {creator.city}</p></div></div>
   <Tiles items={[[`${PLATFORM_LABEL[platform]} followers`,mine.length===1?mine[0].followers:mine.length?`${mine.length} accounts`:null],['Posts · 30 days',mine.length===1?mine[0].posts30d:null],['As of',mine[0]?.asOf??null],[rankLabel==='PCI ranking'?'PCI ranking':`PCI ranking · ${rankLabel}`,rank]]}/></section>
  <section className="yt-card"><h2>{PLATFORM_LABEL[platform]} accounts</h2><div className="yt-table"><table><thead><tr>{['Account','Followers','Posts, 30 days','As of'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{mine.map(a=><tr key={a.handle}><td>{a.url?<a href={a.url} target="_blank" rel="noopener noreferrer">{a.handle}</a>:a.handle}</td><td>{a.followers}</td><td>{a.posts30d}</td><td>{a.asOf}</td></tr>)}</tbody></table></div>
   <p className="yt-note">The dedicated {PLATFORM_LABEL[platform]} view is being designed. These are the platform-reported figures recorded by PCI. A number older than 7 days is shown as not available rather than as zero.</p></section>
 </main>;
}
/** One profile per creator with a layout per platform. */
export function CreatorProfilePage(props:CreatorProfileProps){
 const platforms=props.platforms?.length?props.platforms:(['youtube'] as ProfilePlatform[]);
 const [platform,setPlatform]=useState<ProfilePlatform>(pickPlatform(platforms,props.initialPlatform));
 const order=(['youtube','instagram','tiktok'] as ProfilePlatform[]).filter(p=>platforms.includes(p));
 const choose=(p:ProfilePlatform)=>{setPlatform(p);try{const u=new URL(window.location.href);if(p===order[0])u.searchParams.delete('platform');else u.searchParams.set('platform',p);window.history.replaceState(null,'',u.pathname+u.search);}catch{/* URL sync is optional */}};
 const switcher=order.length>1?<nav className="yt-tabs" aria-label="Platform view">{order.map(p=><button key={p} type="button" aria-pressed={platform===p} onClick={()=>choose(p)}>{PLATFORM_LABEL[p]}</button>)}</nav>:null;
 return platform==='youtube'?<YouTubeCreatorView {...props} switcher={switcher}/>:<PlatformPendingView {...props} platform={platform} switcher={switcher}/>;
}
