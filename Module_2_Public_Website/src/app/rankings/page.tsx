import {TikTokDirectory} from '@/components/TikTokDirectory';
import {PageHeading} from '@pci/ui';
import type {Metadata} from 'next';
import {pubGet,WHEEL_SCOPES,type PubCategory,type PubRanking} from '@/lib/public';
import {PublishedTop100} from '@/components/PublishedTop100';
export const metadata:Metadata={title:'Top 100 Creators'};
export default async function Rankings(){
 const [categories,...top]=await Promise.all([pubGet<PubCategory[]>('/categories'),...WHEEL_SCOPES.map(s=>pubGet<PubRanking>(`/rankings/${s}?limit=100`))]);
 const initial=Object.fromEntries(WHEEL_SCOPES.map((s,i)=>[s,top[i]??null]));
 return <div className="container"><PageHeading eyebrow="Pakistan Creator Index" title="Top 100 Creators" description="Individual creators across YouTube and Instagram, from the latest published rankings. TikTok has an independent ranking below."/><PublishedTop100 initial={initial} categories={(categories??[]).filter(c=>c.hasRanking).map(c=>({slug:c.slug,label:c.label}))}/><TikTokDirectory compact/></div>;
}

export const dynamic = 'force-dynamic';
