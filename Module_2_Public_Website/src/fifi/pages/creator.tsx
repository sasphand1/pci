'use client';
import {useState} from 'react';
import {Link} from '@/fifi/router';
import {ArrowLeft,BarChart3,CalendarDays,Eye,Instagram,Layers,MapPin,PlaySquare,TrendingUp,UsersRound,X,Youtube} from 'lucide-react';
import {Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
import {FollowButton,Pic} from '@/fifi/components/page-elements';
import type {RealCreator} from '@/fifi/lib/real';
import type {PubCreatorAnalytics} from '@/lib/public';
import {observedSeries,intervalRates,hasChange,windowChange,sparkPoints,profileViews,type ChartPoint,type ProfileView} from './creator-chart-data.mjs';

export type ProfileAccount={platform:'youtube'|'instagram'|'tiktok';handle:string;url:string|null;followers:number|null;views:number|null;posts30d:number|null;asOf:string|null};
export type ProfileAnalytics=Pick<PubCreatorAnalytics,'history'|'growth'|'video'|'historyAccountCount'|'instagram'>|null;
export type CreatorProfileProps={creator:RealCreator;rank:string;rankLabel:string;accounts:ProfileAccount[];analytics:ProfileAnalytics;
 peers:{slug:string;name:string;avatar:string|null;reach:number|null}[];initialView?:string|null};

const compact=(v:number|null|undefined)=>v==null?'Not available':new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(v);
const full=(v:number|null|undefined)=>v==null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(v);
const signed=(v:number|null|undefined)=>v==null?'No change recorded':(v>0?'+':'')+compact(v);
const date=(t:number|string)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const tick=(t:number)=>new Date(t).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const VIEW_LABEL:Record<ProfileView,string>={all:'All accounts',youtube:'YouTube',instagram:'Instagram',tiktok:'TikTok'};
const VIEW_ICON={all:Layers,youtube:Youtube,instagram:Instagram,tiktok:PlaySquare};

type Stat={id:string;label:string;value:string;note:string;icon:typeof Eye;tint:string;points:ChartPoint[];unit?:string};

function Spark({points}:{points:ChartPoint[]}){
 if(!hasChange(points))return <span className="mt-2 block h-7 text-[11px] text-muted-foreground">{points.length<2?'Trend after more readings':'No change in this window'}</span>;
 return <svg className="mt-2 block h-7 w-full" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points={sparkPoints(points)} fill="none" stroke="var(--color-chart-1)" strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/></svg>;
}
function Tile({s,open,onOpen}:{s:Stat;open:boolean;onOpen:()=>void}){
 const Icon=s.icon;
 return <button type="button" onClick={onOpen} aria-expanded={open} className={`rounded-xl border bg-background/60 p-3.5 text-left transition hover:border-primary/40 ${open?'border-primary/60 ring-2 ring-primary/15':'border-border/70'}`}>
  <div className="flex items-start gap-2.5"><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${s.tint}`}><Icon className="h-4 w-4"/></span>
   <div className="min-w-0"><p className="truncate text-base font-bold leading-tight text-foreground">{s.value}</p><p className="truncate text-[11px] text-muted-foreground">{s.label}</p></div></div>
  <Spark points={s.points}/>
  <p className="truncate text-[11px] font-semibold text-primary">{s.note}</p>
 </button>;
}
function Detail({s,onClose}:{s:Stat;onClose:()=>void}){
 const p=s.points;
 return <section className="mt-3 rounded-xl border border-border/70 bg-background/70 p-4" aria-label={`${s.label} detail`}>
  <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">{s.label}</p><p className="mt-1 text-2xl font-bold text-primary">{s.value}</p></div>
   <button type="button" onClick={onClose} aria-label="Close chart" className="grid h-8 w-8 place-items-center rounded-full border border-border bg-background text-muted-foreground hover:text-primary"><X className="h-4 w-4"/></button></div>
  {hasChange(p)?<div className="mt-3 h-[170px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={p} margin={{top:6,right:8,left:-8,bottom:0}}>
   <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
   <XAxis dataKey="time" type="number" domain={['dataMin','dataMax']} tickFormatter={tick} minTickGap={30} tick={{fontSize:11,fill:'var(--color-muted-foreground)'}}/>
   <YAxis domain={['auto','auto']} tickFormatter={v=>compact(Number(v))} width={52} tick={{fontSize:11,fill:'var(--color-muted-foreground)'}}/>
   <Tooltip labelFormatter={v=>date(Number(v))} formatter={v=>[full(Number(v))+(s.unit??''),s.label]} contentStyle={{backgroundColor:'var(--color-card)',borderColor:'var(--color-border)',borderRadius:'12px',fontSize:'12px'}}/>
   <Area type="linear" dataKey="value" stroke="var(--color-chart-1)" fill="var(--color-sage)" fillOpacity={0.7} strokeWidth={2} isAnimationActive={false}/>
  </AreaChart></ResponsiveContainer></div>:<p className="mt-3 rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{p.length<2?'Not enough recorded readings to draw this chart yet.':'No recorded change in this window.'}</p>}
  {p.length>0&&<p className="mt-2 text-[11px] text-muted-foreground">{date(p[0].time)} – {date(p.at(-1)!.time)} · {p.length} recorded readings · {s.note}</p>}
 </section>;
}
function Bars({rows}:{rows:{key:string;label:string;value:number;href?:string;sub?:string}[]}){
 const max=Math.max(1,...rows.map(r=>r.value));
 return <ol className="space-y-2.5">{rows.map((r,i)=><li key={r.key} className="text-sm">
  <div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate"><span className="mr-1.5 text-xs font-bold text-gold-foreground">{i+1}</span>{r.href?<a href={r.href} target="_blank" rel="noopener noreferrer" className="font-medium text-foreground hover:text-primary hover:underline">{r.label}</a>:<span className="font-medium">{r.label}</span>}</span><span className="shrink-0 text-xs font-bold tabular-nums text-primary">{compact(r.value)}</span></div>
  <progress className="cmp-meter mt-1" max={max} value={Math.max(r.value,max*0.03)} aria-label={`${r.label}: ${compact(r.value)}`}/>
  {r.sub&&<p className="mt-0.5 text-[11px] text-muted-foreground">{r.sub}</p>}
 </li>)}</ol>;
}

export function CreatorProfilePage({creator,rank,rankLabel,accounts,analytics,peers,initialView}:CreatorProfileProps){
 const {views:tabs,initial}=profileViews([...new Set(accounts.map(a=>a.platform))],initialView);
 const [view,setView]=useState<ProfileView>(initial);
 const [span,setSpan]=useState(30);
 const [open,setOpen]=useState<string|null>(null);
 const choose=(v:ProfileView)=>{setView(v);setOpen(null);
  try{const u=new URL(window.location.href);if(v===tabs[0])u.searchParams.delete('platform');else u.searchParams.set('platform',v);window.history.replaceState(null,'',u.pathname+u.search);}catch{/* URL sync is a convenience only */}};

 const yt=accounts.filter(a=>a.platform==='youtube'),ig=accounts.filter(a=>a.platform==='instagram');
 const sum=(xs:(number|null)[])=>xs.length&&xs.every(x=>x!==null)?xs.reduce<number>((s,x)=>s+(x??0),0):null;
 const reach=sum(accounts.map(a=>a.followers));
 const subs=observedSeries(analytics?.history.subscribers,span),ytViews=observedSeries(analytics?.history.views,span),rates=intervalRates(ytViews);
 const igFollowers=observedSeries(analytics?.instagram?.history.followers,span),igPosts=observedSeries(analytics?.instagram?.history.posts30d,span);
 const video=analytics?.video,top=video?.topVideos??[];
 const ytOne=yt.length===1?yt[0]:null,igTop=[...ig].sort((a,b)=>(b.followers??-1)-(a.followers??-1))[0]??null;
 const inWindow=(c:number|null)=>c==null?`No change in ${span} days`:`${signed(c)} in ${span} days`;

 const stats:Record<ProfileView,Stat[]>={
  all:[
   {id:'reach',label:'Total reach',value:compact(reach),note:`${accounts.length} linked account${accounts.length===1?'':'s'}`,icon:UsersRound,tint:'bg-secondary text-primary',points:[]},
   {id:'yt-subs',label:'YouTube subscribers',value:compact(sum(yt.map(a=>a.followers))),note:inWindow(windowChange(subs)),icon:Youtube,tint:'bg-gold-soft text-gold-foreground',points:subs},
   {id:'ig-followers',label:'Instagram followers',value:compact(igTop?.followers),note:inWindow(windowChange(igFollowers)),icon:Instagram,tint:'bg-gold-soft text-gold-foreground',points:igFollowers},
   {id:'rank',label:rankLabel,value:rank,note:'Published ranking',icon:BarChart3,tint:'bg-secondary text-primary',points:[]}],
  youtube:[
   {id:'subs',label:'Subscribers',value:compact(ytOne?.followers??sum(yt.map(a=>a.followers))),note:inWindow(windowChange(subs)),icon:UsersRound,tint:'bg-secondary text-primary',points:subs},
   {id:'views',label:'Lifetime views',value:compact(ytOne?.views??sum(yt.map(a=>a.views))),note:inWindow(windowChange(ytViews)),icon:Eye,tint:'bg-gold-soft text-gold-foreground',points:ytViews},
   {id:'rate',label:'Views gained per day',value:compact(rates.at(-1)?.value),note:`7 days: ${signed(analytics?.growth.views['7d'])}`,icon:TrendingUp,tint:'bg-gold-soft text-gold-foreground',points:rates,unit:' views/day'},
   {id:'uploads',label:'Uploads · 30 days',value:compact(sum(yt.map(a=>a.posts30d))),note:video?.sampledVideos?`${video.sampledVideos} videos tracked`:'Upload count from YouTube',icon:CalendarDays,tint:'bg-secondary text-primary',points:[]}],
  instagram:[
   {id:'followers',label:'Followers',value:compact(igTop?.followers),note:inWindow(windowChange(igFollowers)),icon:UsersRound,tint:'bg-secondary text-primary',points:igFollowers},
   {id:'change',label:'Follower change · 30 days',value:signed(analytics?.instagram?.growth.followers['30d']),note:`7 days: ${signed(analytics?.instagram?.growth.followers['7d'])}`,icon:TrendingUp,tint:'bg-gold-soft text-gold-foreground',points:igFollowers},
   {id:'posts',label:'Posts · 30 days',value:compact(igTop?.posts30d),note:'Posting rhythm',icon:CalendarDays,tint:'bg-gold-soft text-gold-foreground',points:igPosts},
   {id:'accounts',label:'Instagram accounts',value:String(ig.length),note:ig.length>1?'Largest account shown':'Linked account',icon:Instagram,tint:'bg-secondary text-primary',points:[]}],
  tiktok:[]
 };
 const tiles=stats[view];const openStat=tiles.find(s=>s.id===open)??null;
 const shown=view==='all'?accounts:accounts.filter(a=>a.platform===view);
 const peerRows=peers.filter(p=>p.reach!==null);

 return <main className="page-main pb-10 pt-5 sm:pt-6">
  <Link to="/creators" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary"><ArrowLeft className="h-4 w-4"/> Back to Creator Index</Link>

  <section className="mt-4 rounded-2xl border border-primary/10 bg-secondary/60 p-5 shadow-soft">
   <div className="flex flex-wrap items-center gap-4">
    <Pic src={creator.image} alt={creator.name} className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-soft sm:h-20 sm:w-20"/>
    <div className="min-w-0 flex-1">
     <div className="flex flex-wrap items-center gap-2"><span className="inline-flex h-6 items-center rounded-full bg-gold-soft px-2.5 text-[11px] font-bold text-gold-foreground">{rank==='Not ranked'?'Not ranked':`${rank} · ${rankLabel}`}</span><span className="eyebrow">{creator.category}</span></div>
     <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-primary sm:text-3xl">{creator.name}</h1>
     <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground"><span>{creator.handle}</span><span>·</span><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3"/>{creator.city}</span><span>·</span><span>{accounts.length} account{accounts.length===1?'':'s'}</span></p>
    </div>
    <FollowButton name={creator.name}/>
   </div>

   <div className="mt-5 rounded-2xl border border-border/70 bg-card/80 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
     <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Choose account view">
      {tabs.map(t=>{const Icon=VIEW_ICON[t];return <button key={t} type="button" role="tab" aria-selected={view===t} onClick={()=>choose(t)} className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition ${view===t?'bg-primary text-primary-foreground':'bg-secondary/70 text-primary hover:bg-secondary'}`}><Icon className="h-3.5 w-3.5"/>{VIEW_LABEL[t]}</button>;})}
     </div>
     <div className="flex gap-1" role="group" aria-label="Chart window">{[7,30,90].map(n=><button key={n} type="button" aria-pressed={span===n} onClick={()=>setSpan(n)} className={`h-7 rounded-full px-2.5 text-[11px] font-bold ${span===n?'bg-gold-soft text-gold-foreground':'text-muted-foreground hover:text-primary'}`}>{n}D</button>)}</div>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4" role="tabpanel">
     {tiles.map(s=><Tile key={s.id} s={s} open={open===s.id} onOpen={()=>setOpen(open===s.id?null:s.id)}/>)}
    </div>
    {openStat?<Detail s={openStat} onClose={()=>setOpen(null)}/>:<p className="mt-2 text-[11px] text-muted-foreground">Tap a tile to open its chart.</p>}

    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
     <section className="rounded-xl border border-border/70 bg-background/60 p-4">
      <p className="eyebrow">{view==='all'?'Where the audience is':'Accounts'}</p>
      {shown.length?<div className="mt-3"><Bars rows={shown.map(a=>({key:a.platform+a.handle,label:`${VIEW_LABEL[a.platform]} · ${a.handle}`,value:a.followers??0,href:a.url??undefined,sub:`${a.platform==='youtube'?'subscribers':'followers'}${a.views!=null&&a.platform==='youtube'?` · ${compact(a.views)} views`:''}${a.posts30d!=null?` · ${a.posts30d} posts in 30 days`:''} · ${a.asOf?`as of ${date(a.asOf)}`:'not available'}`}))}/></div>:<p className="mt-3 text-xs text-muted-foreground">No linked accounts.</p>}
     </section>
     {view==='youtube'||(view==='all'&&top.length>0)?<section className="rounded-xl border border-border/70 bg-background/60 p-4">
      <p className="eyebrow">Top videos · tracked sample</p>
      {top.length?<div className="mt-3"><Bars rows={top.slice(0,5).map(v=>({key:v.videoId,label:v.title,value:v.views,href:`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`,sub:v.publishedAt?`Published ${date(v.publishedAt)}`:undefined}))}/></div>:<p className="mt-3 text-xs text-muted-foreground">No video observations yet.</p>}
      {video&&video.averageViews!=null&&<p className="mt-3 text-[11px] text-muted-foreground">Average {compact(video.averageViews)} views across {video.sampledVideos} tracked videos.</p>}
     </section>:view==='instagram'?<section className="rounded-xl border border-border/70 bg-background/60 p-4">
      <p className="eyebrow">Posting rhythm</p>
      <p className="mt-3 text-3xl font-bold text-primary">{igTop?.posts30d!=null?(Math.round(igTop.posts30d/30*7*10)/10).toString():'—'}</p>
      <p className="text-xs text-muted-foreground">posts per week on average over the last 30 days</p>
      <p className="mt-3 text-[11px] text-muted-foreground">Instagram reach is the followers of the largest linked account. Follower history comes from our own recorded readings.</p>
     </section>:null}
    </div>

    {view==='youtube'&&(video?.videos?.length??0)>0&&<details className="mt-4 rounded-xl border border-border/70 bg-background/60 p-4">
     <summary className="cursor-pointer text-sm font-semibold text-primary">Recent tracked videos ({video!.videos.length})</summary>
     <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{['Video','Views','At 24h','At 7d','At 30d'].map(h=><th key={h} scope="col" className="border-b border-border py-2 pr-3">{h}</th>)}</tr></thead>
      <tbody>{video!.videos.map(v=><tr key={v.videoId}><td className="max-w-[220px] truncate border-b border-border/70 py-2 pr-3"><a href={`https://www.youtube.com/watch?v=${encodeURIComponent(v.videoId)}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">{v.title}</a></td>{[v.currentViews,v.views24h,v.views7d,v.views30d].map((n,i)=><td key={i} className="border-b border-border/70 py-2 pr-3 tabular-nums">{full(n)}</td>)}</tr>)}</tbody></table></div>
     <p className="mt-2 text-[11px] text-muted-foreground">Views recorded when each video reached that age. Nothing is reconstructed.</p>
    </details>}
    {(analytics?.historyAccountCount??0)>1&&view!=='instagram'&&<p className="mt-3 text-[11px] text-muted-foreground">YouTube history follows the first linked channel only; channels are not summed into a false series.</p>}
   </div>
  </section>

  {peerRows.length>0&&<section className="content-card mt-5 p-5">
   <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-primary">Similar creators</h2><UsersRound className="h-4 w-4 text-muted-foreground"/></div>
   <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">{[{slug:'',name:creator.name,avatar:creator.image||null,reach,self:true},...peerRows.map(p=>({...p,self:false}))].filter(p=>p.reach!==null).sort((a,b)=>(b.reach??0)-(a.reach??0)).map(p=>{const max=Math.max(reach??0,...peerRows.map(x=>x.reach??0),1);const inner=<><Pic src={p.avatar} alt={p.name} className="h-9 w-9 shrink-0 rounded-full object-cover"/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><span className="truncate text-sm font-semibold">{p.name}{p.self?' (this creator)':''}</span><span className="text-xs font-bold text-primary">{compact(p.reach)}</span></div><progress className={`cmp-meter mt-1 ${p.self?'cmp-meter-b':''}`} max={max} value={Math.max(p.reach??0,max*0.03)} aria-label={`${p.name}: ${compact(p.reach)}`}/></div></>;
    return p.self?<div key="self" className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-soft/40 p-2.5">{inner}</div>:<Link key={p.slug} to="/creators/$id" params={{id:p.slug}} className="flex items-center gap-3 rounded-xl border border-border/70 p-2.5 hover:border-primary/40">{inner}</Link>;})}</div>
   <p className="mt-2 text-[11px] text-muted-foreground">Total reach across linked accounts, same category.</p>
  </section>}

  <p className="mt-4 max-w-3xl text-[11px] leading-5 text-muted-foreground">These are the numbers the platforms report, recorded by PCI. A number older than 7 days is shown as not available rather than as zero. YouTube subscriber counts are rounded by YouTube. Charts show recorded readings only: no smoothing and no filled-in history.</p>
 </main>;
}
