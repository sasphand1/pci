import type {Metadata} from 'next';
import Link from 'next/link';
import {formatCompact,platformLabel} from '@/lib/fifi.mjs';
import {displayDate,formatCount} from '@/lib/format.mjs';
import {pubGet,type PubPersonDetail,type PubRanking} from '@/lib/public';
import {FifiPage} from '@/fifi/FifiPage';
import {CreatorProfilePage} from '@/fifi/pages/creator-profile';
import type {RealCreator} from '@/fifi/lib/real';
import {type Peer} from '@/fifi/pages/youtube-profile-data.mjs';
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
 const initialPlatform=typeof requested==='string'&&/^(youtube|instagram)$/.test(requested)?requested:null;
 const [p,ytRanking]=valid(slug)?await Promise.all([pubGet<PubPersonDetail>(`/people/${slug}`),pubGet<PubRanking>('/rankings/youtube.subscribed?limit=5').catch(()=>null)]):[null,null];
 if(!p)return <FifiPage><main className="page-main flex min-h-[55vh] items-center justify-center py-20 text-center"><div><p className="eyebrow">Creator not found</p><h1 className="mt-4 font-display text-5xl text-primary">Not in the index.</h1><Link href="/creators" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">All creators</Link></div></main></FifiPage>;
 const audience=p.creatorAudience?.total??null;
 const best=p.positions.length?[...p.positions].sort((a,b)=>a.rank-b.rank)[0]:null;
 const creator:RealCreator={id:best?.rank??0,slug:p.slug,name:p.displayName,handle:p.accounts[0]?.handle??'',category:p.categories[0]?.label??'Creator',city:'Pakistan',followers:audience===null?'Not available':formatCompact(audience),growth:'Not available',image:p.avatarUrl??'',bio:''};
 const accounts=p.accounts.map(a=>({platform:platformLabel(a.platform),handle:a.handle,url:a.url,followers:a.followers===null?'Not available':formatCount(a.followers),followersCount:a.followers,views:a.platform==='youtube'?(a.views===null?'Not available':formatCount(a.views)):'—',posts30d:a.posts30d===null?'Not available':formatCount(a.posts30d),asOf:a.observedAt?displayDate(a.observedAt):'—'}));
 const ytAccounts=p.accounts.filter(a=>a.platform==='youtube').map(a=>({handle:a.handle,url:a.url,followers:a.followers,views:a.views,posts30d:a.posts30d,asOf:a.observedAt,avatarUrl:a.avatarUrl??(p.accounts.every(x=>x.platform==='youtube')?p.avatarUrl:null)}));
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
  return {slug:seed.slug,name:seed.name,subscribers:bucket?.totals.subscribers??null,views:bucket?.totals.views??null,publicVideos:bucket?.totals.totalVideos??null,dailyRates:bucket?.profile?.channelGrowth?.dailyRates??[],bands:bucket?.profile?.portfolio.bands??[]};
 })):[];
 const a=p.analytics;
 // Allowlist public display fields before crossing the server/client boundary.
 const analytics=a?{history:a.history,growth:a.growth,video:a.video,historyAccountCount:a.historyAccountCount}:null;
 const platforms=[...new Set(p.accounts.map(x=>x.platform).filter((x):x is 'youtube'|'instagram'=>x==='youtube'||x==='instagram'))];
 return <FifiPage><CreatorProfilePage platforms={platforms} initialPlatform={initialPlatform} creator={creator} rank={best?`#${best.rank}`:'Not ranked'} rankLabel={best?.label??'PCI ranking'} accounts={accounts} ytAccounts={ytAccounts} analytics={analytics} creatorsBucket={p.creatorsBucket??null} creatorAudience={p.creatorAudience} ytRank={ytPosition?`#${ytPosition.rank}`:'Not ranked'} comparison={comparison} comparisonPeers={comparisonPeers} rankingDate={ytRanking?.publishedAt??null}/></FifiPage>;
}
