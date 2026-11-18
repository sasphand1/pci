import type {Metadata} from 'next';
import Link from 'next/link';
import {PageHeading,Notice,Card} from '@pci/ui';
import {adapterGet,qs} from '@/lib/api';
import type {Creator,SortMetric} from '@/lib/types';
import {CreatorTable} from '@/components/CreatorParts';
export const metadata:Metadata={title:'Rankings'};
export default async function Rankings({searchParams}:{searchParams:Promise<{sort?:string;category?:string}>}){const p=await searchParams;const sort:SortMetric=p.sort==='views'||p.sort==='videos'?p.sort:'subscribers';const category=typeof p.category==='string'&&/^[a-z0-9-]{2,60}$/.test(p.category)?p.category:'';
 const response=await adapterGet<{data:Creator[];meta:{sort:string;scope:string;total:number}}>(`/api/v1/rankings?${qs({sort,category,limit:100})}`);const rankings=response?.data||[];
 return <div className="container"><PageHeading eyebrow="Published statistics" title="Creator rankings" description="No proprietary score, popularity grade, or estimated earnings. These lists are sorted directly by the reported YouTube metric."/><div className="inline"><Link className={`btn ${sort==='subscribers'?'btn-primary':'btn-secondary'}`} href={`/rankings?${qs({sort:'subscribers',category})}`}>Subscribers</Link><Link className={`btn ${sort==='views'?'btn-primary':'btn-secondary'}`} href={`/rankings?${qs({sort:'views',category})}`}>Channel views</Link><Link className={`btn ${sort==='videos'?'btn-primary':'btn-secondary'}`} href={`/rankings?${qs({sort:'videos',category})}`}>Video count</Link></div><section className="section"><Card><p className="muted text-sm">Ranking scope: selected and enabled creators monitored by this website. Equal API values share the same rank; unavailable values remain unranked. Subscriber figures are rounded by YouTube.</p></Card></section><section className="section">{response?<CreatorTable creators={rankings} sort={sort}/>:<Notice tone="warning">Ranking data is unavailable. Check the adapter connection.</Notice>}</section></div>}
