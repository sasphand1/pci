import type {Metadata} from 'next';
import Link from 'next/link';
import {formatCompact,growthPercent,formatPercent,platformLabel} from '@/lib/fifi.mjs';
import {displayDate,formatCount} from '@/lib/format.mjs';
import {pubGet,type PubPersonDetail,type PubRanking} from '@/lib/public';
import {FifiPage} from '@/fifi/FifiPage';
import {CreatorProfilePage} from '@/fifi/pages/creator';
import type {RealCreator} from '@/fifi/lib/real';
import {observedPortfolio,type Peer} from '@/fifi/pages/youtube-profile-data.mjs';
const valid=(s:string)=>/^[a-z0-9-]{2,60}$/.test(s);
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 const r=valid(slug)?await pubGet<PubPersonDetail>(`/people/${slug}`):null;
 if(!r)return {title:'Creator not found',robots:{index:false,follow:false}};
 const title=`${r.displayName} — YouTube & Instagram Statistics`;
 const description=`Explore ${r.displayName}'s publicly reported creator statistics, linked accounts, categories and published Pakistan Creator Index rankings.`;
 const url=`/creators/${slug}`;
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,type:'profile',images:r.avatarUrl?[{url:r.avatarUrl,alt:r.displayName}]:undefined},twitter:{card:'summary',title,description}};
}
export default async function CreatorPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams?:Promise<{platform?:string|string[]}>}){
 const {slug}=await params;
 const requested=(await searchParams)?.platform;
 const initialPlatform=typeof requested==='string'&&/^(youtube|instagram|tiktok)$/.test(requested)?requested:null;
 const [p,ytRanking]=valid(slug)?await Promise.all([pubGet<PubPersonDetail>(`/people/${slug}`),pubGet<PubRanking>('/rankings/youtube.subscribed?limit=5').catch(()=>null)]):[null,null];
 if(!p)return <FifiPage><main className="page-main flex min-h-[55vh] items-center justify-center py-20 text-center"><div><p className="eyebrow">Creator not found</p><h1 className="mt-4 font-display text-5xl text-primary">Not in the index.</h1><Link href="/creators" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">All creators</Link></div></main></FifiPage>;
 const known=p.accounts.map(a=>a.followers).filter((n):n is number=>typeof n==='number');
 const audience=known.length===p.accounts.length&&known.length>0?known.reduce((a,b)=>a+b,0):null;
 const gain30=p.analytics?.growth.subscribers['30d']??null;
 const best=p.positions.length?[...p.positions].sort((a,b)=>a.rank-b.rank)[0]:null;
 const creator:RealCreator={id:best?.rank??0,slug:p.slug,name:p.displayName,handle:p.accounts[0]?.handle??'',category:p.categories[0]?.label??'Creator',city:'Pakistan',followers:audience===null?'Not available':formatCompact(audience),growth:formatPercent(growthPercent(audience,gain30)),image:p.avatarUrl??'',bio:''};
 const accounts=p.accounts.map(a=>({platform:platformLabel(a.platform),handle:a.handle,url:a.url,followers:a.followers===null?'Not available':formatCount(a.followers),views:a.platform==='youtube'?(a.views===null?'Not available':formatCount(a.views)):'—',posts30d:a.posts30d===null?'Not available':formatCount(a.posts30d),asOf:a.observedAt?displayDate(a.observedAt):'—'}));
 const ytAccounts=p.accounts.filter(a=>a.platform==='youtube').map(a=>({handle:a.handle,url:a.url,followers:a.followers,views:a.views,posts30d:a.posts30d,asOf:a.observedAt}));
 // Comparable creators: the published YouTube-subscriber ranking (top five); this creator is added if outside it.
 const top=(ytRanking?.entries??[]).slice(0,5).map(e=>({slug:e.person.slug,name:e.person.displayName,value:e.value,self:e.person.slug===p.slug}));
 const ytPosition=p.positions.find(x=>x.scope==='youtube.subscribed');
 const ownSubs=ytPosition?.value??null;
 const comparison=top.some(x=>x.self)||ownSubs===null?top:[...top,{slug:p.slug,name:p.displayName,value:ownSubs,self:true}];
 // Compare at most five YouTube creators, including the selected creator. Read only the existing public profile API.
 const peerSeeds=top.some(x=>x.self)?top:[...top.slice(0,4),{slug:p.slug,name:p.displayName,value:ownSubs,self:true}];
 const comparisonPeers:Peer[]=ytAccounts.length?await Promise.all(peerSeeds.map(async seed=>{
  const detail=seed.self?p:await pubGet<PubPersonDetail>(`/people/${encodeURIComponent(seed.slug)}`).catch(()=>null);
  const bucket=detail?.creatorsBucket??null;
  const yt=detail?.accounts.filter(a=>a.platform==='youtube')??[];
  const total=(field:'followers'|'views')=>yt.length&&yt.every(a=>typeof a[field]==='number')?yt.reduce((n,a)=>n+(a[field]??0),0):null;
  return {slug:seed.slug,name:seed.name,subscribers:seed.value??(bucket?bucket.totals.subscribers:total('followers')),views:bucket?bucket.totals.views:total('views'),publicVideos:bucket?.totals.totalVideos??null,cohort:bucket?.video.cohort??null,bands:observedPortfolio(bucket?.video.videos??[]).bands};
 })):[];
 const a=p.analytics;
 // Allowlist public display fields before crossing the server/client boundary.
 const analytics=a?{history:a.history,growth:a.growth,video:a.video,historyAccountCount:a.historyAccountCount}:null;
 const platforms=[...new Set(p.accounts.map(x=>x.platform).filter((x):x is 'youtube'|'instagram'|'tiktok'=>x==='youtube'||x==='instagram'||x==='tiktok'))];
 return <FifiPage><CreatorProfilePage platforms={platforms} initialPlatform={initialPlatform} creator={creator} rank={best?`#${best.rank}`:'Not ranked'} rankLabel={best?.label??'PCI ranking'} accounts={accounts} ytAccounts={ytAccounts} analytics={analytics} creatorsBucket={p.creatorsBucket??null} ytRank={ytPosition?`#${ytPosition.rank}`:'Not ranked'} comparison={comparison} comparisonPeers={comparisonPeers} rankingDate={ytRanking?.publishedAt??null}/></FifiPage>;
}
