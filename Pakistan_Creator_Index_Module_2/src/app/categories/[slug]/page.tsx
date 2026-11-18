import type {Metadata} from 'next';
import Link from 'next/link';
import {PageHeading,EmptyState,Notice} from '@pci/ui';
import {adapterGet,qs} from '@/lib/api';
import type {Category,CreatorList} from '@/lib/types';
import {CreatorTable,Pager} from '@/components/CreatorParts';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;return {title:`${slug.replace(/-/g,' ')} creators`};}
export default async function CategoryPage({params,searchParams}:{params:Promise<{slug:string}>;searchParams:Promise<{page?:string}>}){const {slug}=await params;const {page:pageParam}=await searchParams;const page=/^\d+$/.test(pageParam||'')?Math.min(10000,Math.max(1,Number(pageParam))):1;
 if(!/^[a-z0-9-]{2,60}$/.test(slug))return <div className="container"><EmptyState title="Category not found" message="Invalid category link."/></div>;
 const [categories,list]=await Promise.all([adapterGet<{data:Category[]}>('/api/v1/categories'),adapterGet<CreatorList>(`/api/v1/creators?${qs({page,limit:25,sort:'subscribers',category:slug})}`)]);
 const cat=categories?.data.find(c=>c.slug===slug);if(categories&&!cat)return <div className="container"><EmptyState title="Unknown category" message="This category is not part of the current directory."><Link href="/categories" className="btn btn-primary">Browse categories</Link></EmptyState></div>;
 return <div className="container"><PageHeading eyebrow="Category" title={cat?.label||'Category'} description={cat?.description||'Curated creator directory filtered by this editorial topic.'} action={<Link href="/categories" className="btn btn-secondary">All categories</Link>}/><section className="section">{list?<><CreatorTable creators={list.data}/><Pager pagination={list.pagination} path={`/categories/${slug}`}/></>:<Notice tone="warning">Creator information is unavailable.</Notice>}</section></div>}
