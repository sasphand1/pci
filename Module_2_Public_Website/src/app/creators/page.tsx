import Link from 'next/link';
import type {Metadata} from 'next';
import {Avatar,Card,EmptyState,Notice,PageHeading} from '@pci/ui';
import {safeYoutubeImage} from '@/lib/format.mjs';
import {Pager} from '@/components/CreatorParts';
import {pubGet,pubList,platformName,type PubCategory,type PubPerson} from '@/lib/public';
import {qs} from '@/lib/api';
export const metadata:Metadata={title:'Creator directory'};
type Params={page?:string;category?:string;search?:string};
export default async function CreatorsPage({searchParams}:{searchParams:Promise<Params>}){
 const p=await searchParams;
 const category=typeof p.category==='string'&&/^[a-z0-9-]{2,60}$/.test(p.category)?p.category:'';
 const search=typeof p.search==='string'?p.search.slice(0,100):'';
 const page=/^\d+$/.test(p.page||'')?Math.min(10000,Math.max(1,Number(p.page))):1;
 const [list,cats]=await Promise.all([pubList<PubPerson>(`/people?${qs({page,limit:25,category,search})}`),pubGet<PubCategory[]>('/categories')]);
 return <div className="container"><PageHeading eyebrow="Browse" title="Creator directory" description="Everyone in the index, best published position first."/>
  <Card><form className="filters" method="get" action="/creators" role="search"><div className="field"><label htmlFor="creator-search">Creator name</label><input id="creator-search" type="search" name="search" defaultValue={search} placeholder="Search creators…" maxLength={100}/></div><div className="field"><label htmlFor="creator-category">Category</label><select id="creator-category" name="category" defaultValue={category}><option value="">All categories</option>{(cats??[]).map(c=><option key={c.slug} value={c.slug}>{c.label}</option>)}</select></div><button className="btn btn-primary" type="submit">Apply</button></form></Card>
  <section className="section">{list?(list.data.length?<><div className="table-wrap"><table className="data-table"><thead><tr><th scope="col">Creator</th><th scope="col">Categories</th><th scope="col">Accounts</th></tr></thead><tbody>{list.data.map(c=><tr key={c.slug}><td><Link href={`/creators/${encodeURIComponent(c.slug)}`} className="identity"><Avatar name={c.displayName} src={safeYoutubeImage(c.avatarUrl)}/><span className="identity-name">{c.displayName}</span></Link></td><td>{c.categories.map(x=>x.label).join(', ')||'—'}</td><td>{c.accounts.map(a=>a.url?<a key={a.platform} href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">{platformName(a.platform)} ↗</a>:<span key={a.platform} className="fineprint">{platformName(a.platform)}</span>)}</td></tr>)}</tbody></table></div><Pager pagination={list.pagination} path="/creators" params={{category,search}}/></>:<EmptyState title="No creators found" message="Try another search or category."/>):<Notice tone="warning">The directory is unavailable. Try again shortly.</Notice>}</section></div>;
}
