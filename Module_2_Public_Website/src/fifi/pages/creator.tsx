'use client';
import {useState,type ReactNode} from 'react';
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
 accounts:{platform:string;handle:string;url:string|null;followers:string;views:string;posts30d:string;asOf:string}[];
 ytAccounts:{handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;asOf:string|null}[];
 analytics:Pick<PubCreatorAnalytics,'history'|'growth'|'video'|'historyAccountCount'>|null;
 creatorsBucket?:PubCreatorsBucket|null;ytRank?:string;
 comparison:{slug:string;name:string;value:number;self:boolean}[];rankingDate:string|null;
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
/** The YouTube view of any creator, built to match the approved reference layout (PCI-creator-final.html). */
function YouTubeCreatorView({creator,rank,ytRank,ytAccounts,creatorsBucket:bucket,comparison,rankingDate,switcher}:CreatorProfileProps&{switcher?:ReactNode}){
 const [tab,setTab]=useState<'overview'|'content'|'accounts'>('overview');
 const [span,setSpan]=useState(30);
 const [topMetric,setTopMetric]=useState<VideoMetric>('currentViews');
 const one=ytAccounts.length===1?ytAccounts[0]:null;
 const subscribers=bucket?bucket.totals.subscribers:one?.followers??sum(ytAccounts.map(a=>a.followers));
 const views=bucket?bucket.totals.views:one?.views??sum(ytAccounts.map(a=>a.views));
 const posts30d=bucket?bucket.totals.posts30d:sum(ytAccounts.map(a=>a.posts30d));
 const totalVideos=bucket?.totals.totalVideos??null;
 const recorded=ytAccounts.map(a=>a.asOf).filter((t):t is string=>Boolean(t)).sort().at(-1);
 const allViews=bucketPoints(bucket?.history.views??[]),v=bucketPoints(bucket?.history.views??[],span),s=bucketPoints(bucket?.history.subscribers??[],span);
 const end=allViews.at(-1)?.time;
 const weeks=bucketPoints(bucket?.weeklyViews??[],span,end),months=bucketPoints(bucket?.monthlyViews??[],span,end),ranks=bucketPoints(bucket?.history.ranks??[],span);
 const video=bucket?.video,videos=video?.videos??[];
 const top=rankVideos(videos,topMetric),isPercent=topMetric==='engagementRate'||topMetric==='likeRate';
 const viewPace=averagePace(v),topLabel=TOP_METRICS.find(m=>m.key===topMetric)!.label;
 const topAt=(x:typeof videos[number])=>topMetric==='likes'?x.likesAt:topMetric==='comments'?x.commentsAt:x.observedAt;
 return <main className="page-main pci-yt">
  <div className="yt-note"><Link to="/creators">← Creator Index</Link> / Creator profile</div>
  {switcher}
  <section className="yt-card">
   <div className="yt-profile"><Pic src={creator.image} alt={creator.name} className="yt-avatar"/><div className="yt-grow"><p className="yt-eyebrow">{creator.category} · Public profile</p><h1>{creator.name}</h1><p className="yt-note">YouTube · {creator.city}{recorded?` · Recorded ${longDate(recorded)}`:''}</p></div></div>
   <Tiles items={[['YouTube subscribers',subscribers],['YouTube lifetime views',views],['Total public videos',totalVideos],['YouTube uploads · 30 days',posts30d],['Publishing frequency · uploads/day',bucket?.totals.publishingFrequency?.toFixed(2)??null],['PCI ranking · YouTube subscribers',ytRank??rank]]}/>
  </section>
  <nav className="yt-tabs" aria-label="Creator analytics sections">{(['overview','content','accounts'] as const).map(t=><button key={t} type="button" aria-pressed={tab===t} onClick={()=>setTab(t)}>{t[0].toUpperCase()+t.slice(1)}</button>)}</nav>

  {tab==='overview'&&<section className="yt-panel">
   <div className="yt-toolbar"><h2>Channel performance</h2><div className="yt-tabs" role="group" aria-label="Observation window">{[7,30,90].map(n=><button key={n} type="button" aria-pressed={span===n} onClick={()=>setSpan(n)}>{n}D</button>)}</div></div>
   <Tiles items={[['Views gained · 24h',bucket?.growth.views['24h']],['Views gained · 7 days',bucket?.growth.views['7d']],['Views gained · 30 days',bucket?.growth.views['30d']],['Subscriber change · 7 days',bucket?.growth.subscribers['7d']],['Subscriber change · 30 days',bucket?.growth.subscribers['30d']],['Observed average daily views · selected period',viewPace===null?null:Math.round(viewPace)]]}/>
   <div className="yt-grid"><Trend key={'daily-'+span} title="Views gained per day of observed interval" points={dailyRates(v)}/><Trend key={'views-'+span} title="Lifetime view growth" points={v} area fallback={bucket?.historyAccountCount===1?views:null}/><Trend key={'subs-'+span} title="Subscriber history" points={s} fallback={bucket?.historyAccountCount===1?subscribers:null}/>
    <Trend key={'weekly-'+span} title="Rolling weekly view growth" points={weeks}/><Trend key={'monthly-'+span} title="Rolling monthly view growth" points={months}/><PeriodComparisonChart key={'period-'+span} data={periodComparison(allViews,span)}/>{hasChange(ranks)&&<Trend key={'rank-'+span} title="Published YouTube rank movement" points={ranks} rank/>}</div>
   {(bucket?.historyAccountCount??0)>1&&<p className="yt-note">History covers {bucket?.primaryHandle||'the first linked YouTube channel'}; current totals sum linked channels only when each has fresh data. Subscriber totals are not unique people.</p>}
   {!bucket&&<p className="yt-note">Creators Bucket data is not available yet. No external or fictional history is substituted.</p>}
   <p className="yt-note">View rate is the recorded counter difference divided by elapsed days, not exact daily YouTube Studio analytics. Weekly and monthly growth use observed readings near each lookback; hover shows actual intervals. Missing intervals and counter decreases are not backfilled. Growth KPIs require fresh end readings.</p>
   {comparison.length>1&&<section className="yt-card"><h3>Comparable creators · YouTube subscribers</h3>
    <Bars rows={comparison.map(c=>({key:c.slug,name:c.name,value:c.value,selected:c.self,at:rankingDate}))}/>
    <p className="yt-note">Top five from the published PCI YouTube ranking{rankingDate?`, ${longDate(rankingDate)}`:''}{comparison.length>5?'; this creator added for comparison':''}.</p></section>}
  </section>}

  {tab==='content'&&<section className="yt-panel">
   <h2>Video performance</h2>
   <Tiles items={[['Latest tracked videos',video?videos.length:null],['Videos with observed views',video?.sampledVideos??null],['Average views per sampled video',video?.averageViews==null?null:Math.round(video.averageViews)],['Average likes per observed video',video?.averageLikes==null?null:Math.round(video.averageLikes)],['Average comments per observed video',video?.averageComments==null?null:Math.round(video.averageComments)],['Average engagement rate',percent(video?.averageEngagement)],['Average like rate',percent(video?.averageLikeRate)]]}/>
   <section className="yt-card"><div className="yt-toolbar"><h3>Top videos in tracked sample · {topLabel}</h3><div className="yt-tabs" role="group" aria-label="Top video metric">{TOP_METRICS.map(m=><button key={m.key} type="button" aria-pressed={topMetric===m.key} onClick={()=>setTopMetric(m.key)}>{m.label}</button>)}</div></div>
   {top.length?<Bars key={topMetric} percent={isPercent} rows={top.map((x,i)=>({key:x.videoId,name:x.title,value:x[topMetric]!,selected:i===0,at:topAt(x),href:'https://www.youtube.com/watch?v='+encodeURIComponent(x.videoId)}))}/>:<p className="yt-note">No recorded values for this metric yet.</p>}</section>
   <EngagementScatter videos={videos}/>

   <section className="yt-card"><h3>Recent tracked videos</h3>
    {videos.length?<div className="yt-table"><table><thead><tr>{['Video','Published','Views','Likes','Comments','Engagement','Like rate','At 24h','At 7d','At 30d','Views/hour','Breakout','Views observed'].map(h=><th key={h}>{h}</th>)}</tr></thead>
     <tbody>{videos.map(x=><tr key={x.videoId}><td><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(x.videoId)}`} target="_blank" rel="noopener noreferrer">{x.title}</a></td><td>{x.publishedAt?date(x.publishedAt):'—'}</td><td title={x.observedAt?timestamp(x.observedAt):undefined}>{full(x.currentViews)}</td><td title={x.likesAt?timestamp(x.likesAt):undefined}>{full(x.likes)}</td><td title={x.commentsAt?timestamp(x.commentsAt):undefined}>{full(x.comments)}</td><td>{percent(x.engagementRate)??'—'}</td><td>{percent(x.likeRate)??'—'}</td>{([[x.views24h,x.views24hAt],[x.views7d,x.views7dAt],[x.views30d,x.views30dAt],[x.velocityPerHour,x.velocityAt]] as const).map(([n,at],i)=><td key={i} title={n===null?undefined:exact(n)+(at?' · '+timestamp(at):'')+(i===3&&x.velocityFrom?' · from '+timestamp(x.velocityFrom):'')}>{full(n)}</td>)}<td>{x.breakoutFactor===null?'—':x.breakoutFactor.toFixed(2)+'×'}</td><td>{x.observedAt?timestamp(x.observedAt):'—'}</td></tr>)}</tbody></table></div>
     :<p className="yt-note">No verified video observations yet.</p>}
    <p className="yt-note">Latest 50 available tracked videos across linked YouTube channels, ordered by publication date. Video-age milestones use actual readings near 24h/7d/30d; missing readings remain blank. Engagement requires views, likes and comments from the same observation; like rate requires matching views and likes. {video?video.likesCoverage+' videos with likes · '+video.commentsCoverage+' with comments · '+video.engagementCoverage+' with matching engagement observations.':''}</p></section>
  </section>}

  {tab==='accounts'&&<section className="yt-panel"><section className="yt-card"><h2>Linked public accounts</h2>
   <div className="yt-table"><table><thead><tr>{['Platform','Account','Followers','Lifetime views','Total public videos','Posts, 30 days','As of'].map(h=><th key={h}>{h}</th>)}</tr></thead>
    <tbody>{ytAccounts.map(a=><tr key={a.handle}><td>YouTube</td><td>{a.url?<a href={a.url} target="_blank" rel="noopener noreferrer">{a.handle}</a>:a.handle}</td><td>{fmt(a.followers)}</td><td>{fmt(a.views)}</td><td title={bucket?.accountStats.find(x=>x.handle===a.handle)?.totalVideos?.at}>{fmt(bucket?.accountStats.find(x=>x.handle===a.handle)?.totalVideos?.value)}</td><td>{fmt(a.posts30d)}</td><td>{a.asOf?date(a.asOf):'Not available'}</td></tr>)}</tbody></table></div>
  </section></section>}

  <p className="yt-note">Source: PCI Data Hub / Creators Bucket. Current counts older than 7 days are not available; historical observations retain their actual timestamps. YouTube subscriber counts are rounded by YouTube. No fabricated historical values or estimated earnings.</p>
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
