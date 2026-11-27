import {TikTokDirectory} from '@/components/TikTokDirectory';
import type {Metadata} from 'next';
import {pubGet,pubCreatorIndex,pubCreatorSlugs,type PubCategory} from '@/lib/public';
import {qs} from '@/lib/api';
import {safePage,safeSearchParam,safeSlug} from '@/lib/fifi.mjs';
import {parseCompare} from '@/lib/creators.mjs';
import {FifiPage} from '@/fifi/FifiPage';
import {CreatorsPage} from '@/fifi/pages/creators';

export const metadata:Metadata={title:'Creators — Pakistan Creator Index',description:'Search, filter and compare Pakistani creators by platform and category, using the latest recorded figures.'};
type Params={metric?:string;page?:string;category?:string;search?:string;platform?:string;sort?:string;view?:string;compare?:string;open?:string};
const PER_PAGE=24;
const oneOf=(v:string|undefined,allowed:string[],fallback:string)=>v&&allowed.includes(v)?v:fallback;
export default async function Creators({searchParams}:{searchParams:Promise<Params>}){
 const p=await searchParams;
 const category=safeSlug(p.category);const search=safeSearchParam(p.search);const page=safePage(p.page);
 if(p.platform==='tiktok')return <FifiPage><main className="page-main pb-10 pt-5"><TikTokDirectory metric={p.metric} search={search} page={page}/></main></FifiPage>;
 const platform=oneOf(p.platform,['youtube','instagram'],'');const sort=oneOf(p.sort,['rank','followers','name'],'rank');const view=oneOf(p.view,['list','grid'],'list');
 const compare=parseCompare(p.compare);
 const [list,cats,compareRows]=await Promise.all([
  pubCreatorIndex(`?${qs({page,limit:PER_PAGE,category,search,platform,sort})}`),
  pubGet<PubCategory[]>('/categories'),
  compare.length>=2?pubCreatorSlugs(compare,true):Promise.resolve([])]);
 return <FifiPage><CreatorsPage rows={list?.data??[]} total={list?.pagination.total??0} pages={list?.pagination.pages??1} page={page}
  totals={list?.totals??null} search={search} category={category} platform={platform} sort={sort} view={view}
  categories={(cats??[]).map(c=>({slug:c.slug,label:c.label}))} compare={compare} open={p.open==='1'&&compare.length>=2} compareRows={compareRows}/></FifiPage>;
}
