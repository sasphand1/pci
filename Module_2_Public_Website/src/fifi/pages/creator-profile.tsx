'use client';
import {useState,type ReactNode} from 'react';
import {Pic} from '@/fifi/components/page-elements';
import type {CreatorProfileProps} from './creator';
import type {ProfilePortfolio,ProfileGrowth} from '../../lib/creators-bucket';
import {alignDaily,VIEW_BANDS,type Peer} from './youtube-profile-data.mjs';
import {LineChart,HorizontalBars,Scatter,BandChart,GroupedBars} from './youtube-reference';
const fmt=(n:number|null|undefined,digits=2)=>n==null?'N/A':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:digits}).format(n);
const exact=(n:number|null|undefined)=>n==null?'N/A':n.toLocaleString('en-US',{maximumFractionDigits:2});
const date=(s:string|undefined|null)=>s&&Number.isFinite(Date.parse(s))?new Date(s).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Karachi'}):'Not available';
const signed=(n:number|null|undefined)=>n==null?'N/A':`${n>=0?'+':''}${exact(n)}`;
const pct=(n:number|null|undefined)=>n==null?'N/A':n.toFixed(2)+'%';
const NOTES=['¹','²','³','⁴','⁵'];
function NoteMark({n}:{n:number}){return <sup><a className="cp-note-mark" aria-label={'Read methodology note '+n} href={'#cp-note-'+n}>{NOTES[n-1]}</a></sup>}
function Card({title,children,aside,className=''}:{title:ReactNode;children:ReactNode;aside?:ReactNode;className?:string}){return <section className={'cp-card rounded-2xl border border-border/70 bg-card shadow-soft '+className}><div className="cp-card-heading"><h2>{title}</h2>{aside&&<div className="cp-card-aside">{aside}</div>}</div>{children}</section>}
function KPI({title,value,note}:{title:string;value:string;note:ReactNode}){return <div className="cp-kpi"><p>{title}</p><strong>{value}</strong><small>{note}</small></div>}
function Empty({children='Data not available yet.'}:{children?:ReactNode}){return <div className="cp-empty">{children}</div>}
function ChartEmbed({children,comparison=false}:{children:ReactNode;comparison?:boolean}){return <div className={'pci-yt-reference cp-chart-embed'+(comparison?' yr-comparison':'')}>{children}</div>}
const COMPARE=['Subscribers','Lifetime views','Public videos','Daily views gained','Video view bands'] as const;
const COMPARE_TITLES=['Subscriber comparison','Lifetime view comparison','Public video comparison','Daily view-gain comparison','Videos by view band'] as const;
function PeerComparison({peers,rankingDate}:{peers:Peer[];rankingDate?:string|null}){
 const [metric,setMetric]=useState(0);
 const groups=alignDaily(peers).map(g=>({label:new Date(g.day+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'Asia/Karachi'}),values:g.values}));
 const bands=VIEW_BANDS.map(label=>({label,values:peers.map(p=>p.bands.find(b=>b.label===label)?.value??null)}));
 return <Card title="Creator comparison" className="cp-full-card cp-peer-compact"><div className="cp-compare-tabs" role="group" aria-label="Comparison metric">{COMPARE.map((label,i)=><button type="button" key={label} aria-pressed={metric===i} className={metric===i?'cp-tab cp-tab-active':'cp-tab'} onClick={()=>setMetric(i)}>{label}</button>)}</div><h3 className="cp-subheading">{COMPARE_TITLES[metric]}</h3><p className="cp-note">{['Published YouTube subscriber ranking · '+date(rankingDate),'Current public YouTube lifetime views','Official public YouTube video counts','Observed primary-channel view gains normalized to 24 hours · PKT ending day','Number of observed videos in each view range'][metric]}</p>{!peers.length?<Empty>No comparable YouTube accounts recorded.</Empty>:<ChartEmbed comparison>{metric<3?<HorizontalBars displayExact={metric!==0} rounded={metric===0} rows={peers.map((p,i)=>({key:p.slug,label:p.name,value:metric===0?p.subscribers:metric===1?p.views:p.publicVideos,color:i}))}/>:metric===3?<GroupedBars key={metric} peers={peers} groups={groups}/>:<GroupedBars key={metric} peers={peers} groups={bands} distribution/>}</ChartEmbed>}<p className="cp-note">Same creator colors across tabs. Missing figures are unavailable, not zero.</p></Card>;
}
export function CreatorProfilePage({creator,ytAccounts,creatorsBucket:bucket,comparisonPeers,rankingDate}:CreatorProfileProps){
 const yt=ytAccounts[0];
 const portfolio:ProfilePortfolio=bucket?.profile?.portfolio??{known:[],total:null,median:null,topShare:null,topFiveShare:null,topFiveViews:null,age:[],bands:[],dated:0};
 const growth:ProfileGrowth=bucket?.profile?.channelGrowth??{points:[],dailyTotals:[],dailyRates:[],pace:null,delta:null,change:null};
 const count=bucket?.totals.totalVideos??null,subs=bucket?.totals.subscribers??null,views=bucket?.totals.views??null;
 const first=growth.points[0]?.time,last=growth.points.at(-1)?.time;
 const iso=(t:number|undefined)=>t===undefined?null:new Date(t).toISOString();
 const coverage=portfolio.observedCount??portfolio.known.length;
 return <main className="page-main pb-10 pt-5 cp-profile" data-creator-template="fifi-unified-profile-v1" data-creator-layout="approved-no-tabs" data-creator-analytics="bucket-v1">
 <section className="cp-hero cp-compact-header"><div className="cp-avatar"><Pic src={creator.image||yt?.avatarUrl||''} alt={creator.name} className="h-full w-full object-cover"/></div><div className="cp-identity"><h1>{creator.name}</h1>{yt?.handle&&(yt.url?<a className="cp-note" href={yt.url} target="_blank" rel="noopener noreferrer">{yt.handle} ↗</a>:<span className="cp-note">{yt.handle}</span>)}</div></section>
 <div className="cp-dashboard"><div className="cp-main-column"><div className="cp-kpi-grid">
 <KPI title="Subscribers" value={fmt(subs)} note={<>Current public channel total <NoteMark n={1}/></>}/>
 <KPI title="Lifetime views" value={fmt(views,3)} note={views==null?"Not available":`${exact(views)} views`}/>
 <KPI title="Public videos" value={exact(count)} note="Current public catalogue"/>
 <KPI title="Overall engagement rate" value={pct(portfolio.engagementRate)} note={<>{portfolio.interactions==null?"Not available":`${exact(portfolio.interactions)} total interactions`} <NoteMark n={2}/></>}/>
 <KPI title="Top-video share" value={pct(portfolio.topShare)} note={<>{portfolio.known[0]?.currentViews==null?"Not available":`${exact(portfolio.known[0].currentViews)} views`} <NoteMark n={3}/></>}/>
 <KPI title="Videos published" value={exact(bucket?.totals.posts30d)} note="Last 30 days"/>
 </div>
 <div className="cp-growth-heading"><div className="cp-eyebrow">Performance movement{first===undefined?'':` · Since ${date(iso(first))}`}</div><h2>Growth signals</h2></div>
 <div className="cp-two-grid cp-analytics-grid">
 <Card title={<>Total channel views gained <NoteMark n={4}/></>}><div className="cp-big-stat">{signed(growth.dailyDelta??null)}</div><ChartEmbed><LineChart points={growth.dailyCumulative??[]} label="Cumulative views gained"/></ChartEmbed></Card>
 <Card title={<>Daily view-gain rate <NoteMark n={4}/></>}><div className="cp-big-stat">{growth.pace==null?'N/A':`Average ${fmt(growth.pace)}/day`}</div><ChartEmbed><LineChart points={growth.dailyRates} label="Daily view-gain rate"/></ChartEmbed></Card>
 </div>
 <div className="cp-two-grid cp-analytics-grid"><Card title="Views by video age"><ChartEmbed><Scatter points={portfolio.age}/></ChartEmbed></Card><Card title="Videos by view band"><ChartEmbed><BandChart rows={portfolio.bands}/></ChartEmbed></Card></div>
 <div className="cp-growth-heading"><div className="cp-eyebrow">Current platform scale</div></div><PeerComparison peers={comparisonPeers??[]} rankingDate={rankingDate}/>
 <Card title="Provenance & validation"><h3 className="cp-subheading">Source-backed observations</h3><div className="cp-two-grid"><div className="cp-provenance"><p className="cp-note">Latest channel observation</p><strong>{last===undefined?'Not available':new Date(last).toLocaleString('en-GB',{timeZone:'Asia/Karachi',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})+' PKT'}</strong><p className="cp-note">First observation: {date(iso(first))} · {growth.points.length} observation rounds · {growth.dailyTotals.length} daily points</p></div><div className="cp-provenance"><p className="cp-note">Video catalogue & growth</p><strong>{exact(portfolio.catalogueCount??coverage)} collected / {exact(count)} public videos</strong><p className="cp-note">{portfolio.catalogueComplete?"Catalogue scan complete.":"Catalogue collection incomplete or awaiting verification."} Views recorded: {exact(coverage)} videos. Engagement: {exact(portfolio.engagementCoverage)} eligible videos.</p></div></div></Card>
 </div></div>
 <section className="cp-card rounded-2xl border border-border/70 bg-card shadow-soft cp-footnotes" id="cp-footnotes"><h2>Footnotes</h2><p id="cp-note-1"><b>¹ Subscribers.</b> YouTube public counts are rounded to three significant figures.</p><p id="cp-note-2"><b>² Overall engagement rate.</b> Total likes and comments divided by total views of eligible observed videos, multiplied by 100. Missing or unmatched engagement readings and zero-view videos are excluded. Total interactions use the same eligible videos.</p><p id="cp-note-3"><b>³ Top-video share.</b> Highest-viewed recorded video divided by total observed video views. Catalogue coverage is reported above.</p><p id="cp-note-4"><b>⁴ Growth observations.</b> Daily points use Pakistan Standard Time (UTC+5). Cumulative gains start at the first displayed daily observation. Lines connect recorded observations across gaps; missing dates have no markers or estimated readings. Rates use actual elapsed time; counter decreases and gaps beyond two days are excluded from the rate. Growth reflects the primary YouTube channel.</p></section>
 <p className="cp-source">Source: PCI Hub / Creators Bucket · Missing data stays unavailable; readings older than 7 days are not treated as zero.</p>
 </main>;
}
