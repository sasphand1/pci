import type {Metadata} from 'next';
import Link from 'next/link';
import {displayDate,formatCount} from '@/lib/format.mjs';
import {formatCompact,growthPercent,formatPercent,platformLabel} from '@/lib/fifi.mjs';
import {pubGet,type PubPersonDetail} from '@/lib/public';
import {FifiPage} from '@/fifi/FifiPage';
import {CreatorProfilePage} from '@/fifi/pages/creator';
import type {RealCreator} from '@/fifi/lib/real';

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
export default async function CreatorPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const p=valid(slug)?await pubGet<PubPersonDetail>(`/people/${slug}`):null;
 if(!p)return <FifiPage><main className="page-main flex min-h-[55vh] items-center justify-center py-20 text-center"><div><p className="eyebrow">Creator not found</p><h1 className="mt-4 font-display text-5xl text-primary">Not in the index.</h1><Link href="/creators" className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">All creators</Link></div></main></FifiPage>;
 const known=p.accounts.map(a=>a.followers).filter((n):n is number=>typeof n==='number');
 const audience=known.length===p.accounts.length&&known.length>0?known.reduce((a,b)=>a+b,0):null;
 const gain30=p.analytics?.growth.subscribers['30d']??null;
 const best=p.positions.length?[...p.positions].sort((a,b)=>a.rank-b.rank)[0]:null;
 const creator:RealCreator={id:best?.rank??0,slug:p.slug,name:p.displayName,handle:p.accounts[0]?.handle??'',category:p.categories[0]?.label??'Creator',city:'Pakistan',followers:audience===null?'Not available':formatCompact(audience),growth:formatPercent(growthPercent(audience,gain30)),image:p.avatarUrl??'',bio:''};
 const history=p.analytics?.history.subscribers??[];
 const series=history.slice(-60).map(h=>({month:new Date(h.at).toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}),reachK:Math.round(h.value/100)/10}));
 const peers:RealCreator[]=(p.similarCreators??[]).slice(0,3).map((c,i)=>({id:i+1,slug:c.slug,name:c.displayName,handle:'',category:'Creator',city:'Pakistan',followers:'',growth:'',image:'',bio:''}));
 const accounts=p.accounts.map(a=>({platform:platformLabel(a.platform),handle:a.handle,url:a.url,followers:a.followers===null?'Not available':formatCount(a.followers),views:a.platform==='youtube'?(a.views===null?'Not available':formatCount(a.views)):'—',posts30d:a.posts30d===null?'Not available':formatCount(a.posts30d),asOf:a.observedAt?displayDate(a.observedAt):'—'}));
 return <FifiPage><CreatorProfilePage creator={creator} rank={best?`#${best.rank}`:'Not ranked'} series={series} peers={peers} accounts={accounts}/></FifiPage>;
}
