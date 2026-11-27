'use client';
import {useState,type ReactNode} from 'react';
import {Pic} from '@/fifi/components/page-elements';
import type {CreatorProfileProps} from './creator';
import type {ProfilePortfolio,ProfileGrowth} from '../../lib/creators-bucket';
import {alignDaily,VIEW_BANDS,type Peer} from './youtube-profile-data.mjs';
import {LineChart,HorizontalBars,Scatter,BandChart,GroupedBars} from './youtube-reference';
const fmt=(n:number|null|undefined)=>n==null?'N/A':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
const exact=(n:number|null|undefined)=>n==null?'N/A':n.toLocaleString('en-US',{maximumFractionDigits:2});
const date=(s:string|undefined|null)=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Not available';
const signed=(n:number|null|undefined)=>n==null?'N/A':`${n>=0?'+':''}${exact(n)}`;
const pct=(n:number|null|undefined)=>n==null?'N/A':n.toFixed(2)+'%';
const NOTES=['¹','²','³','⁴','⁵'];
function NoteMark({n}:{n:number}){return <sup><a className="cp-note-mark" aria-label={'Read methodology note '+n} href={'#cp-note-'+n}>{NOTES[n-1]}</a></sup>}
function Card({title,children,aside,className=''}:{title:string;children:ReactNode;aside?:ReactNode;className?:string}){return <section className={'cp-card rounded-2xl border border-border/70 bg-card shadow-soft '+className}><div className="cp-card-heading"><h2>{title}</h2>{aside&&<div className="cp-card-aside">{aside}</div>}</div>{children}</section>}
function KPI({title,value,note}:{title:string;value:string;note:ReactNode}){return <div className="cp-kpi"><p>{title}</p><strong>{value}</strong><small>{note}</small></div>}
function Empty({children='Data not available yet.'}:{children?:ReactNode}){return <div className="cp-empty">{children}</div>}
function ChartEmbed({children,comparison=false}:{children:ReactNode;comparison?:boolean}){return <div className={'pci-yt-reference cp-chart-embed'+(comparison?' yr-comparison':'')}>{children}</div>}
const COMPARE=['Subscribers','Lifetime views','Public videos','Daily views gained','Video view bands'] as const;
const COMPARE_TITLES=['Subscriber comparison','Lifetime view comparison','Public video comparison','Daily view-gain comparison','Videos by view band'] as const;
function PeerComparison({peers,rankingDate}:{peers:Peer[];rankingDate?:string|null}){
 const [metric,setMetric]=useState(0);
 const groups=alignDaily(peers).map(g=>({label:new Date(g.day+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),values:g.values}));
 const bands=VIEW_BANDS.map(label=>({label,values:peers.map(p=>p.bands.find(b=>b.label===label)?.value??null)}));
 return <Card title="Creator comparison" className="cp-full-card cp-peer-compact"><div className="cp-compare-tabs" role="group" aria-label="Comparison metric">{COMPARE.map((label,i)=><button type="button" key={label} aria-pressed={metric===i} className={metric===i?'cp-tab cp-tab-active':'cp-tab'} onClick={()=>setMetric(i)}>{label}</button>)}</div><h3 className="cp-subheading">{COMPARE_TITLES[metric]}</h3><p className="cp-note">{['Published YouTube subscriber ranking · '+date(rankingDate),'Current public YouTube lifetime views','Official public YouTube video counts','Observed primary-channel view gains normalized to 24 hours · UTC ending day','Number of sampled videos in each view range'][metric]}</p>{!peers.length?<Empty>No comparable YouTube accounts recorded.</Empty>:<ChartEmbed comparison>{metric<3?<HorizontalBars displayExact={metric!==0} rounded={metric===0} rows={peers.map((p,i)=>({key:p.slug,label:p.name,value:metric===0?p.subscribers:metric===1?p.views:p.publicVideos,color:i}))}/>:metric===3?<GroupedBars key={metric} peers={peers} groups={groups}/>:<GroupedBars key={metric} peers={peers} groups={bands} distribution/>}</ChartEmbed>}<p className="cp-note">Same creator colors across tabs. Missing figures are unavailable, not zero.</p></Card>;
}
export function CreatorProfilePage({creator,ytRank,ytAccounts,creatorsBucket:bucket,comparisonPeers,rankingDate}:CreatorProfileProps){
 const yt=ytAccounts[0];
 const portfolio:ProfilePortfolio=bucket?.profile?.portfolio??{known:[],total:null,median:null,topShare:null,topFiveShare:null,topFiveViews:null,age:[],bands:[],dated:0};
 const growth:ProfileGrowth=bucket?.profile?.channelGrowth??{points:[],dailyTotals:[],dailyRates:[],pace:null,delta:null,change:null};
 const count=bucket?.totals.totalVideos??null,subs=bucket?.totals.subscribers??null,views=bucket?.totals.views??null;
 const first=growth.points[0]?.time,last=growth.points.at(-1)?.time;
 const iso=(t:number|undefined)=>t===undefined?null:new Date(t).toISOString();
 const coverage=portfolio.known.length;
 return <main className="page-main pb-10 pt-5 cp-profile" data-creator-template="fifi-unified-profile-v1" data-creator-layout="approved-no-tabs" data-creator-analytics="bucket-v1">
 <section className="cp-hero cp-compact-header"><div className="cp-avatar"><Pic src={creator.image||yt?.avatarUrl||''} alt={creator.name} className="h-full w-full object-cover"/></div><div className="cp-identity"><h1>{creator.name} {ytRank&&/^#\d+$/.test(ytRank)&&<span className="cp-header-rank" title="PCI YouTube subscriber ranking">{ytRank}</span>}</h1>{yt?.handle&&(yt.url?<a className="cp-note" href={yt.url} target="_blank" rel="noopener noreferrer">{yt.handle} ↗</a>:<span className="cp-note">{yt.handle}</span>)}</div><span className="cp-data-label">PCI data</span></section>
 <div className="cp-dashboard"><div className="cp-main-column"><div className="cp-kpi-grid">
 <KPI title="Subscribers" value={fmt(subs)} note={<>Current public channel total <NoteMark n={1}/></>}/>
 <KPI title="Lifetime views" value={exact(views)} note="Current public channel total"/>
 <KPI title="Public videos" value={exact(count)} note={<>Current public catalogue <NoteMark n={2}/></>}/>
 <KPI title="Average daily views gained" value={exact(growth.pace)} note={<>{first===undefined?'Not available':`Since ${date(iso(first))}`} <NoteMark n={5}/></>}/>
 <KPI title="Top-video share" value={pct(portfolio.topShare)} note={<>Recorded sample share <NoteMark n={3}/></>}/>
 <KPI title="Median video views" value={exact(portfolio.median)} note={<>Recorded sample median <NoteMark n={4}/></>}/>
 </div>
 <div className="cp-growth-heading"><div className="cp-eyebrow">Performance movement{first===undefined?'':` · Since ${date(iso(first))}`}</div><h2>Growth signals from {growth.points.length} observation rounds</h2></div>
 <div className="cp-two-grid cp-analytics-grid">
 <Card title="Total channel views gained" aside={<span className="cp-mini">Daily snapshots</span>}><div className="cp-big-stat">{signed(growth.delta)}</div><ChartEmbed><LineChart points={growth.dailyTotals} label="Channel lifetime views"/></ChartEmbed><p className="cp-note">{growth.dailyTotals.length} daily points · {growth.points.length} observation rounds · UTC</p></Card>
 <Card title="Daily view-gain rate" aside={<span className="cp-mini">24h rate</span>}><div className="cp-big-stat">{growth.pace==null?'N/A':`Average ${exact(growth.pace)}/day`}</div><ChartEmbed><LineChart points={growth.dailyRates} label="Daily view-gain rate"/></ChartEmbed><p className="cp-note">Recorded primary-channel observations.</p></Card>
 </div><p className="cp-note">Daily points use observed UTC dates. Missing observations are not filled or interpolated.</p>
 <div className="cp-two-grid cp-analytics-grid"><Card title="Views by video age" aside={<span className="cp-mini">{portfolio.dated} videos</span>}><ChartEmbed><Scatter points={portfolio.age}/></ChartEmbed><p className="cp-note">Each point links to an observed video. Square-root view axis.</p></Card><Card title="Videos by view band" aside={<span className="cp-mini">Vertical bars</span>}><ChartEmbed><BandChart rows={portfolio.bands}/></ChartEmbed><p className="cp-note">Number of sampled videos in each view range.</p></Card></div>
 <div className="cp-growth-heading"><div className="cp-eyebrow">Current platform scale</div></div><PeerComparison peers={comparisonPeers??[]} rankingDate={rankingDate}/>
 <Card title="Provenance & validation"><h3 className="cp-subheading">Source-backed observations</h3><div className="cp-two-grid"><div className="cp-provenance"><p className="cp-note">PCI data · Latest channel observation</p><strong>{last===undefined?'Not available':new Date(last).toISOString().replace('T',' ').slice(0,16)+' UTC'}</strong><p className="cp-note">First observation: {date(iso(first))}</p></div><div className="cp-provenance"><p className="cp-note">Video catalogue & growth</p><strong>{exact(coverage)} observed videos / {exact(count)} public videos</strong><p className="cp-note">Full-catalogue collection is not yet enabled.</p></div></div></Card>
 </div></div>
 <section className="cp-card rounded-2xl border border-border/70 bg-card shadow-soft cp-footnotes" id="cp-footnotes"><h2>Footnotes</h2><p id="cp-note-1"><b>¹ Subscribers.</b> YouTube public counts are rounded to three significant figures.</p><p id="cp-note-2"><b>² Public videos.</b> Official public channel video count.</p><p id="cp-note-3"><b>³ Top-video share.</b> Highest-viewed recorded video divided by total sampled views.</p><p id="cp-note-4"><b>⁴ Median video views.</b> Middle view count of the recorded sample; for an even sample the mean of the two middle counts.</p><p id="cp-note-5"><b>⁵ Growth and average daily gain.</b> Primary YouTube channel observations; daily gains are weighted by elapsed time. Counter decreases and gaps beyond two days are excluded from the rate. Missing observations are not estimated. Channel totals can include multiple linked accounts.</p></section>
 <p className="cp-source">Source: PCI Hub / Creators Bucket · Missing data stays unavailable; readings older than 7 days are not treated as zero.</p>
 </main>;
}
