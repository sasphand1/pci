'use client';
import Link from 'next/link';
import {useState,useRef,useCallback,useEffect} from 'react';
import type {PointerEvent,WheelEvent} from 'react';
import {formatCount,safeYoutubeImage} from '@/lib/format.mjs';

type Metric='views'|'subscribers'|'videos';
type WheelMetric=Metric|'allrounders';
type Platform='all'|'youtube'|'instagram'|'tiktok';
export type UnifiedPerson={id:string;slug:string;displayName:string;thumbnailUrl:string|null;rank:number|null;rankMetric:Metric;
 subscriberCount:string|null;viewCount:string|null;videoCount:string|null;allRounderScore?:number|null;
 platforms:{youtube:string|null;instagram:string|null;tiktok:string|null};
 metricSources:Record<Metric,string[]>;categories:{slug:string;label:string}[]};
export type UnifiedRankingResponse={data:UnifiedPerson[];meta:{total:number;known:number;metric:Metric;platform:Platform;disclosure:Record<string,string>}};
export type UnifiedOverviewResponse={data:{platform:Platform;creators:number;subscribers:string|null;views:string|null;posts:string|null;disclosure:Record<string,string>}};
const displayModes:{metric:Metric;title:string;label:string}[]=[
 {metric:'views',title:'Most Viewed',label:'Channel views'},
 {metric:'subscribers',title:'Most Subscribed',label:'Account followers + subscribers'},
 {metric:'videos',title:'Most Active',label:'Published videos + posts'}];
const wheelModes=[{metric:'allrounders' as const,title:'All Rounders',label:'Relative cross-platform score'},...displayModes];
const platformOptions:{id:Platform;label:string}[]=[{id:'all',label:'All platforms'},{id:'youtube',label:'YouTube'},{id:'instagram',label:'Instagram'},{id:'tiktok',label:'TikTok (soon)'}];
function count(c:UnifiedPerson,m:Metric){return m==='views'?c.viewCount:m==='videos'?c.videoCount:c.subscriberCount;}
function PlatformMark({platform}:{platform:'youtube'|'instagram'|'tiktok'}){
 if(platform==='youtube')return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><rect x="1" y="4" width="22" height="16" rx="5" fill="#ff0033"/><path d="m10 8 6 4-6 4z" fill="white"/></svg>;
 if(platform==='instagram')return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><defs><linearGradient id="pci-ig-gradient"><stop stopColor="#f58529"/><stop offset="0.55" stopColor="#dd2a7b"/><stop offset="1" stopColor="#8134af"/></linearGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill="url(#pci-ig-gradient)"/><rect x="7" y="7" width="10" height="10" rx="4" fill="none" stroke="white" strokeWidth="1.8"/><circle cx="17.5" cy="6.6" r="1.3" fill="white"/></svg>;
 return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M14 2v11.5a5.2 5.2 0 1 1-5.2-5.2" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M14 3c1 4 3 6 7 6" fill="none" stroke="currentColor" strokeWidth="3"/></svg>;
}
function Links({person}:{person:UnifiedPerson}){
 return <span className="pci-unified-links">{(['youtube','instagram','tiktok'] as const).map(platform=>person.platforms?.[platform]
 ?<a key={platform} href={person.platforms[platform]!} aria-label={`Open ${person.displayName} on ${platform}`} title={platform} target="_blank" rel="noopener noreferrer" className="pci-unified-platform-link"><PlatformMark platform={platform}/></a>:null)}</span>;
}
export function UnifiedRankingWheel({rankings,allRounders=[]}:{rankings:Record<Metric,UnifiedPerson[]>;allRounders?:UnifiedPerson[]}){
 const [metric,setMetric]=useState<WheelMetric>(allRounders.length?'allrounders':'views');const [active,setActive]=useState(0);
 const drag=useRef<number|null>(null),ignore=useRef(false);const cards=(metric==='allrounders'?allRounders:rankings[metric]).filter(x=>metric==='allrounders'?x.allRounderScore!=null:count(x,metric)!==null).slice(0,20);
 const index=Math.max(0,Math.min(active,cards.length-1));
 const move=useCallback((diff:number)=>setActive(i=>Math.max(0,Math.min(cards.length-1,i+diff))),[cards.length]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(!document.activeElement?.closest('.ranking-wheel'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();move(e.key==='ArrowRight'?1:-1);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[move]);
 function pointerDown(e:PointerEvent<HTMLElement>){if(e.pointerType==='mouse'&&e.button!==0)return;drag.current=e.clientX;}
 function pointerUp(e:PointerEvent<HTMLElement>){if(drag.current===null)return;const diff=e.clientX-drag.current;drag.current=null;if(Math.abs(diff)>12){ignore.current=true;move(diff<0?Math.max(1,Math.round(-diff/100)):-Math.max(1,Math.round(diff/100)));window.setTimeout(()=>{ignore.current=false;},150);}}
 function wheel(e:WheelEvent<HTMLElement>){if(!cards.length)return;const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(dx){e.preventDefault();move(dx>0?1:-1);}}
 return <section className="ranking-wheel" tabIndex={0} aria-label="Top 20 Pakistani individual human creator rankings">
  <div className="ranking-wheel-heading"><div className="ranking-wheel-kicker">PAKISTAN CREATOR INDEX <span>•</span> VERIFIED ACCOUNT METRICS</div><h1>Explore the <span>Creator Index</span></h1><p>Top 20 individual creators across YouTube and Instagram. TikTok coming later.</p></div>
  <div className="ranking-wheel-modes" role="group" aria-label="Choose ranking metric">{wheelModes.map(m=><button key={m.metric} className="ranking-wheel-mode" data-active={metric===m.metric} aria-pressed={metric===m.metric} onClick={()=>{setMetric(m.metric);setActive(0);}}>{m.title}</button>)}</div>
  <div className="ranking-wheel-stage" onPointerDown={pointerDown} onPointerUp={pointerUp} onPointerCancel={()=>drag.current=null} onWheel={wheel}>
   <div className="ranking-wheel-light" aria-hidden="true"/>
   {cards.map((c,i)=>({c,offset:i-index})).filter(x=>Math.abs(x.offset)<=2).map(({c,offset})=><Link key={`${metric}:${c.id}`} href={`/creators/${encodeURIComponent(c.slug)}`} draggable={false} className="ranking-wheel-card" data-offset={offset} data-rank-one={c.rank===1} aria-current={offset===0?'true':undefined} onClick={e=>{if(ignore.current)e.preventDefault()}}>
    {c.rank===1&&<div className="ranking-wheel-crown"><span aria-hidden="true">♛</span><small>#1 {wheelModes.find(m=>m.metric===metric)?.title}</small></div>}
    <div className="ranking-wheel-portrait">{safeYoutubeImage(c.thumbnailUrl)?<img src={safeYoutubeImage(c.thumbnailUrl)!} alt="" draggable={false}/>:<span className="ranking-wheel-monogram">{c.displayName.slice(0,1)}</span>}</div>
    <div className="ranking-wheel-card-info"><span className="ranking-wheel-place">#{c.rank} · {wheelModes.find(m=>m.metric===metric)?.label}</span><strong>{c.displayName}</strong><span className="ranking-wheel-figure">{metric==='allrounders'?`${c.allRounderScore?.toFixed(1)} / 100`:formatCount(count(c,metric),true)}</span><span className="ranking-wheel-profile">Open creator profile ↗</span></div>
   </Link>)}
   {!cards.length&&<div className="ranking-wheel-empty"><h2>No approved creator statistics yet</h2><p>Approve individual human creators in the management panel to populate the Top 20.</p></div>}
   <div className="ranking-wheel-stage-floor" aria-hidden="true"/>
  </div>
  <div className="ranking-wheel-controls"><button className="ranking-wheel-arrow" disabled={index<=0} aria-label="Previous creator" onClick={()=>move(-1)}>‹</button><span className="ranking-wheel-position">{cards.length?`${index+1} / ${cards.length} CREATOR PROFILES`:'NO RANKED CREATORS'}</span><button className="ranking-wheel-arrow" disabled={index>=cards.length-1} aria-label="Next creator" onClick={()=>move(1)}>›</button></div>
  <div className="ranking-wheel-foot"><p>Subscriber and follower counts across linked accounts are added, not deduplicated. Most Viewed currently uses YouTube lifetime channel views. Most Active uses lifetime videos plus posts, not posting frequency. Reported API figures, not a proprietary influence score.</p><Link className="ranking-wheel-all" href="/rankings">View full rankings →</Link></div>
 </section>;
}
export function UnifiedTop100({rankings,category}:{rankings:Record<Metric,UnifiedPerson[]>;category?:string}){
 const [platform,setPlatform]=useState<Platform>('all');const [metric,setMetric]=useState<Metric>('subscribers');
 // The homepage receives all-platform rankings; platform-specific sorts need API data.
 const [remote,setRemote]=useState<UnifiedPerson[]|null>(null);const [loading,setLoading]=useState(false);
 useEffect(()=>{let canceled=false;if(platform==='all'){setRemote(null);return;}
   setLoading(true);const q=new URLSearchParams({metric,platform,limit:'100'});if(category)q.set('category',category);
   // Browser uses the existing browser-facing adapter URL; no secrets or direct Meta access.
   const base=process.env.NEXT_PUBLIC_ADAPTER_API_URL||'';
   fetch(`${base.replace(/\/$/,'')}/api/v1/unified/rankings?${q}`,{cache:'no-store'})
    .then(r=>r.ok?r.json():Promise.reject(new Error('Ranking unavailable')))
    .then(j=>{if(!canceled)setRemote(j.data??[])}).catch(()=>{if(!canceled)setRemote([])})
    .finally(()=>{if(!canceled)setLoading(false)});return()=>{canceled=true};
 },[platform,metric,category]);
 const rows=(platform==='all'?rankings[metric]:remote??[]).slice(0,100);
 return <section className="section pci-unified-top"><div className="pci-unified-head"><div><h2>Top 100 Creators</h2><p className="muted">Approved individual human creators. Filter by social platform and reported metric.</p></div></div>
 <div className="pci-unified-filters" aria-label="Ranking platform filters">{platformOptions.map(p=><button key={p.id} className={`btn ${platform===p.id?'btn-primary':'btn-secondary'}`} disabled={p.id==='tiktok'} onClick={()=>{setPlatform(p.id);setRemote(null)}}>{p.label}</button>)}</div>
 <div className="pci-unified-filters" aria-label="Ranking metric filters">{displayModes.map(m=><button key={m.metric} className={`btn ${metric===m.metric?'btn-primary':'btn-secondary'}`} onClick={()=>{setMetric(m.metric);setRemote(null)}}>{m.title}</button>)}</div>
 <div className="table-wrap pci-unified-white"><table className="data-table"><thead><tr><th>Rank</th><th>Creator</th><th className="numeric">Followers + subscribers</th><th className="numeric">Views*</th><th className="numeric">Videos + posts</th><th>Social accounts</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td><span className="rank-mark">{c.rank??'—'}</span></td><td><Link href={`/creators/${encodeURIComponent(c.slug)}`} className="identity">{safeYoutubeImage(c.thumbnailUrl)?<img className="pci-unified-thumb" alt="" src={safeYoutubeImage(c.thumbnailUrl)!}/>:<span className="pci-unified-avatar">{c.displayName[0]}</span>}<span><strong>{c.displayName}</strong><small className="identity-sub">{c.categories?.map(x=>x.label).join(', ')}</small></span></Link></td><td className="numeric">{formatCount(c.subscriberCount,true)}</td><td className="numeric">{formatCount(c.viewCount,true)}</td><td className="numeric">{formatCount(c.videoCount,true)}</td><td><Links person={c}/></td></tr>)}</tbody></table>{(loading||!rows.length)&&<p className="muted pci-unified-empty">{loading?'Loading filtered rankings…':'No eligible people with this metric yet.'}</p>}</div>
 <p className="fineprint">*Views are YouTube lifetime channel views only. Subscriber/follower counts are an estimate of combined account audience, not unique individuals—followers may overlap between platforms. Activity uses lifetime content counts, not publishing frequency. TikTok is not yet integrated.</p>
 </section>;
}
export function UnifiedOverview({overviews}:{overviews:Record<'all'|'youtube'|'instagram',UnifiedOverviewResponse|null>}){
 const [platform,setPlatform]=useState<Platform>('all');const stats=platform==='tiktok'?null:overviews[platform]?.data;
 return <section className="section"><h2>The numbers behind the index</h2>
 <div className="pci-unified-filters" aria-label="Summary platform filters">{platformOptions.map(p=><button className={`btn ${p.id===platform?'btn-primary':'btn-secondary'}`} key={p.id} disabled={p.id==='tiktok'} onClick={()=>setPlatform(p.id)}>{p.label}</button>)}</div>
 <div className="metric-grid"><div className="card"><span className="muted">Individual creators</span><h3>{stats?.creators??'—'}</h3></div><div className="card"><span className="muted">Account follower + subscriber counts</span><h3>{formatCount(stats?.subscribers,true)}</h3></div><div className="card"><span className="muted">YouTube lifetime views</span><h3>{formatCount(stats?.views,true)}</h3></div><div className="card"><span className="muted">Published videos + posts</span><h3>{formatCount(stats?.posts,true)}</h3></div></div>
 <p className="fineprint">Figures are reported account counts, not unique people. Different platform audiences may overlap. Views exclude Instagram because account-wide lifetime view totals are not available from the current Meta connector.</p></section>;
}
