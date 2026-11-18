import {PageHeading} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import {UnifiedTop100,type UnifiedPerson,type UnifiedRankingResponse} from '@/components/UnifiedCreatorExperience';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Top 100 Creators'};
type Metric='views'|'subscribers'|'videos';
export default async function Rankings(){const metrics:Metric[]=['views','subscribers','videos'];
 const responses=await Promise.all(metrics.map(metric=>adapterGet<UnifiedRankingResponse>(`/api/v1/unified/rankings?metric=${metric}&platform=all&limit=100`)));
 const rankings=Object.fromEntries(metrics.map((m,i)=>[m,responses[i]?.data??[]])) as Record<Metric,UnifiedPerson[]>;
 return <div className="container"><PageHeading eyebrow="Pakistan Creator Index" title="Top 100 Creators" description="Individual human creators across linked YouTube and Instagram accounts. TikTok integration is reserved for later."/><UnifiedTop100 rankings={rankings}/></div>;
}
