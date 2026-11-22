import Link from 'next/link';
import type {Metadata} from 'next';
import {Avatar,Badge,Card,EmptyState,Notice} from '@pci/ui';
import {displayDate,formatCount,safeCreatorImage} from '@/lib/format.mjs';
import {pubGet,platformName,type PubPersonDetail} from '@/lib/public';
import {CreatorAnalyticsPanel} from '@/components/CreatorAnalyticsPanel';
const valid=(s:string)=>/^[a-z0-9-]{2,60}$/.test(s);
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const r=valid(slug)?await pubGet<PubPersonDetail>(`/people/${slug}`):null;return {title:r?.displayName||'Creator profile',description:r?`Where ${r.displayName} ranks and the latest public numbers.`:undefined};}
export default async function CreatorPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const p=valid(slug)?await pubGet<PubPersonDetail>(`/people/${slug}`):null;
 if(!p)return <div className="container"><EmptyState title="Creator not found" message="This creator is not in the index."><Link href="/creators" className="btn btn-primary">Creator directory</Link></EmptyState></div>;
 return <div className="container">
  <section className="section"><div className="creator-card-header"><Avatar name={p.displayName} src={safeCreatorImage(p.avatarUrl)} large/><div><h1>{p.displayName}</h1><div className="inline">{p.categories.map(c=><Link key={c.slug} href={`/categories/${c.slug}`}><Badge variant="muted">{c.label}</Badge></Link>)}</div></div></div></section>
  <section className="section"><h2>Where {p.displayName} ranks</h2>{p.positions.length?<div className="grid-3">{p.positions.map(x=><Card key={x.scope}><div className="eyebrow">{x.label}</div><h3>#{x.rank}</h3><p className="muted">{formatCount(x.value,true)} {x.unit}</p></Card>)}</div>:<Notice>Not in a published ranking yet. Numbers older than 7 days are left out of rankings.</Notice>}</section>
  {p.analytics&&<CreatorAnalyticsPanel data={p.analytics}/>}
  {!!p.similarCreators?.length&&<section className="section pci-similar-creators"><h2>Similar creators</h2><p className="fineprint">Others in the same PCI categories, not a popularity prediction.</p><div className="grid-3">{p.similarCreators.map(c=><Card key={c.slug}><Link href={`/creators/${encodeURIComponent(c.slug)}`}>{c.displayName}</Link></Card>)}</div></section>}
  <section className="section"><h2>Accounts</h2><div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Platform</th><th scope="col">Account</th><th scope="col" className="numeric">Followers</th><th scope="col" className="numeric">Lifetime views</th><th scope="col" className="numeric">Posts, 30 days</th><th scope="col">As of</th></tr></thead><tbody>{p.accounts.map(a=><tr key={a.platform}><td>{platformName(a.platform)}</td><td>{a.url?<a href={a.url} target="_blank" rel="noopener noreferrer">{a.handle} ↗</a>:a.handle}</td><td className="numeric">{a.followers===null?'Not available':formatCount(a.followers)}</td><td className="numeric">{a.platform==='youtube'?(a.views===null?'Not available':formatCount(a.views)):'—'}</td><td className="numeric">{a.posts30d===null?'Not available':formatCount(a.posts30d)}</td><td>{a.observedAt?displayDate(a.observedAt):'—'}</td></tr>)}</tbody></table></div>
   <p className="fineprint">These are the numbers the platforms report. A number older than 7 days is shown as not available rather than as zero. YouTube subscriber counts are rounded by YouTube.</p></section>
 </div>;
}
