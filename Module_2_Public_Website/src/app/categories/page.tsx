import Link from 'next/link';
import type {Metadata} from 'next';
import {PageHeading,EmptyState} from '@pci/ui';
import {pubGet,type PubCategory} from '@/lib/public';
export const metadata:Metadata={title:'Categories'};
export default async function Categories(){
 const categories=(await pubGet<PubCategory[]>('/categories'))??[];
 return <div className="container"><PageHeading eyebrow="Editorial navigation" title="Browse categories" description="Categories are an editorial aid chosen by the curators, not a platform classification or a statement about anyone's beliefs."/><section className="section">{categories.length?<div className="grid-3">{categories.map(c=><Link key={c.slug} href={`/categories/${c.slug}`} className="card card-clickable"><h2>{c.label}</h2><p className="muted">{c.description||'Explore creators in this section.'}</p><p className="fineprint">{c.people} {c.people===1?'creator':'creators'}{c.hasRanking?'':' · ranking not published yet'} · Open category →</p></Link>)}</div>:<EmptyState title="Categories unavailable" message="Categories will appear once creators are added."/>}</section></div>;
}

export const dynamic = 'force-dynamic';
