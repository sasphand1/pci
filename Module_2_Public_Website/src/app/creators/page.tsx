import type {Metadata} from 'next';
import {pubGet,pubList,type PubCategory,type PubPerson} from '@/lib/public';
import {qs} from '@/lib/api';
import {safePage,safeSearchParam,safeSlug} from '@/lib/fifi.mjs';
import {FifiPage} from '@/fifi/FifiPage';
import {CreatorsPage} from '@/fifi/pages/creators';
import {personToCreator} from '@/fifi/lib/real';

export const metadata:Metadata={title:'Creator Index — Fifi',description:'Discover Pakistani creators by category, from published public data.'};
type Params={page?:string;category?:string;search?:string};
const PER_PAGE=12;
export default async function Creators({searchParams}:{searchParams:Promise<Params>}){
 const p=await searchParams;
 const category=safeSlug(p.category);const search=safeSearchParam(p.search);const page=safePage(p.page);
 const [list,cats]=await Promise.all([pubList<PubPerson>(`/people?${qs({page,limit:PER_PAGE,category,search})}`),pubGet<PubCategory[]>('/categories')]);
 return <FifiPage><CreatorsPage
  creators={(list?.data??[]).map((x,i)=>personToCreator(x,(page-1)*PER_PAGE+i))}
  total={list?.pagination.total??0} pages={list?.pagination.pages??1} page={page}
  search={search} category={category} categories={(cats??[]).map(c=>({slug:c.slug,label:c.label}))}/></FifiPage>;
}
