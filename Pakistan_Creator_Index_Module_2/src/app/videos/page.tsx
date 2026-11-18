import type {Metadata} from 'next';
import {PageHeading,Notice} from '@pci/ui';
import {adapterGet} from '@/lib/api';
import type {CreatorList,Video} from '@/lib/types';
import {VideoList} from '@/components/CreatorParts';
export const metadata:Metadata={title:'Recent video explorer'};
export default async function Videos(){const list=await adapterGet<CreatorList>('/api/v1/creators?limit=6&sort=subscribers');const selected=list?.data||[];
 const samples=await Promise.all(selected.map(c=>adapterGet<{data:Video[]}>(`/api/v1/creators/${c.slug}/videos?limit=5&order=recent`)));
 const videos=samples.flatMap(x=>x?.data||[]).sort((a,b)=>new Date(b.publishedAt||0).getTime()-new Date(a.publishedAt||0).getTime());
 return <div className="container"><PageHeading eyebrow="Video sample" title="Recent video explorer" description="A recent upload sample from up to six tracked creators, not all of YouTube Pakistan or a platform-wide trending ranking."/><section className="section">{videos.length?<VideoList videos={videos}/>:<Notice tone="warning">No recent video data is available. The adapter must fetch uploads first.</Notice>}</section></div>}
