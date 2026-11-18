import type {Metadata} from 'next';
import Link from 'next/link';
import {PageHeading,EmptyState} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {Category} from '@/lib/types';
export const metadata:Metadata={title:'Categories'};
export default async function Categories(){const r=await adapterGet<{data:Category[]}>('/api/v1/categories');const categories=r?.data||[];return <div className="container"><PageHeading eyebrow="Editorial navigation" title="Browse categories" description="Explore seven topic-based collections. Categories are an editorial organizational aid, not a YouTube-certified classification or assessment of anyone's beliefs."/><section className="section">{categories.length?<div className="grid-3">{categories.map(c=><Link key={c.id} href={`/categories/${c.slug}`} className="card card-clickable"><h2>{c.label}</h2><p className="muted">{c.description||'Explore creators in this section.'}</p><p className="fineprint">Open category →</p></Link>)}</div>:<EmptyState title="Categories unavailable" message="Categories will appear after the adapter registry is configured."/>}</section></div>}
