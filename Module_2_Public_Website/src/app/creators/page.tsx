import type {Metadata} from 'next';
import {Card,PageHeading,Notice} from '@pci/ui';
import {adapterGet,qs} from '@/lib/api';
import type {Category,CreatorList,SortMetric} from '@/lib/types';
import {DirectoryFilters} from '@/components/DirectoryFilters';
import {CreatorTable,Pager} from '@/components/CreatorParts';
export const metadata:Metadata={title:'Creator directory'};
type Params={page?:string;category?:string;search?:string;sort?:string};
export default async function CreatorsPage({searchParams}:{searchParams:Promise<Params>}){const p=await searchParams;const sort:SortMetric=['views','videos'].includes(p.sort||'')?p.sort as SortMetric:'subscribers';const category=typeof p.category==='string'?p.category.slice(0,60):'';const search=typeof p.search==='string'?p.search.slice(0,100):'';const page=/^\d+$/.test(p.page||'')?Math.min(10000,Math.max(1,Number(p.page))):1;
 const [list,cats]=await Promise.all([adapterGet<CreatorList>(`/api/v1/creators?${qs({page,limit:25,sort,category,search})}`),adapterGet<{data:Category[]}>('/api/v1/categories')]);
 return <div className="container"><PageHeading eyebrow="Browse" title="Creator directory" description="Search the selected creators and sort by publicly available metrics. Positions refer to this directory, not all Pakistani YouTube channels."/><Card><DirectoryFilters categories={cats?.data||[]} sort={sort} category={category} search={search}/></Card><section className="section">{list?<><CreatorTable creators={list.data} sort={sort}/><Pager pagination={list.pagination} path="/creators" params={{sort,category,search}}/></>:<Notice tone="warning">Directory data is unavailable. Check the adapter connection and try again.</Notice>}</section></div>}
