import Link from 'next/link';
import type {Metadata} from 'next';
import {PageHeading,EmptyState} from '@pci/ui';
import {pubGet,type PubCategory,type PubRanking} from '@/lib/public';
import {RankingTable} from '@/components/RankingTable';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;
 if(!/^[a-z0-9-]{2,60}$/.test(slug))return {title:'Category not found',robots:{index:false,follow:false}};
 const categories=await pubGet<PubCategory[]>('/categories');
 const category=categories?.find(c=>c.slug===slug);
 if(!category)return {title:'Category not found',robots:{index:false,follow:false}};
 const title=`${category.label} — Pakistani Creator Rankings`;
 const description=category.description||`Explore Pakistani creators in ${category.label}, with public statistics and published rankings.`;
 const url=`/categories/${slug}`;
 return {title,description,alternates:{canonical:url},openGraph:{title,description,url,type:'website'}};
}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9-]{2,60}$/.test(slug))return <div className="container"><EmptyState title="Category not found" message="Invalid category link."/></div>;
 const [categories,ranking]=await Promise.all([pubGet<PubCategory[]>('/categories'),pubGet<PubRanking>(`/rankings/category.${slug}?limit=100`)]);
 const cat=categories?.find(c=>c.slug===slug);
 if(categories&&!cat)return <div className="container"><EmptyState title="Unknown category" message="This category is not part of the current directory."><Link href="/categories" className="btn btn-primary">Browse categories</Link></EmptyState></div>;
 return <div className="container"><PageHeading eyebrow="Category" title={cat?.label??'Category'} description="Creators in this category, ranked by followers across their accounts." action={<Link className="btn btn-secondary" href="/categories">All categories</Link>}/><section className="section"><RankingTable ranking={ranking}/></section></div>;
}
