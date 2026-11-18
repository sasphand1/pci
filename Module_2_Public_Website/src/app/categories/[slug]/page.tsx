import Link from 'next/link';import type {Metadata} from 'next';
import {PageHeading,EmptyState} from '@pci/ui';
import {adapterGet} from '@/lib/api';import type {Category} from '@/lib/types';
import {UnifiedTop100,type UnifiedRankingResponse,type UnifiedPerson} from '@/components/UnifiedCreatorExperience';
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;return {title:`${slug.replace(/-/g,' ')} creators`};}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 if(!/^[a-z0-9-]{2,60}$/.test(slug))return <div className="container"><EmptyState title="Category not found" message="Invalid category link."/></div>;
 const metrics=['views','subscribers','videos'] as const;
 const [categories,results]=await Promise.all([
  adapterGet<{data:Category[]}>('/api/v1/categories'),
  Promise.all(metrics.map(metric=>adapterGet<UnifiedRankingResponse>(`/api/v1/unified/rankings?metric=${metric}&platform=all&limit=100&category=${encodeURIComponent(slug)}`)))
 ]);
 const cat=categories?.data.find(c=>c.slug===slug);
 if(categories&&!cat)return <div className="container"><EmptyState title="Unknown category" message="This category is not part of the current directory."><Link href="/categories" className="btn btn-primary">Browse categories</Link></EmptyState></div>;
 const rankings=Object.fromEntries(metrics.map((m,i)=>[m,results[i]?.data??[]])) as Record<typeof metrics[number],UnifiedPerson[]>;
 return <div className="container"><PageHeading eyebrow="Shared creator category" title={cat?.label??'Category'} description="Same category across a person's linked YouTube and Instagram accounts." action={<Link className="btn btn-secondary" href="/categories">All categories</Link>}/><UnifiedTop100 rankings={rankings} category={slug}/></div>;
}
