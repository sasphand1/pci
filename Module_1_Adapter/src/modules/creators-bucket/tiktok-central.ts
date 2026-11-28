import type { RankInput, Metric } from '../../engine/types.js';
import { metricOf, projectTikTok, type TikTokRow } from '../public/tiktok-rules.js';
export type CentralMode='off'|'prepare'|'active';
export function centralTikTokMode(value=process.env.PCI_TIKTOK_CENTRAL):CentralMode {
 if(value===undefined||value==='off')return 'off';
 if(value==='prepare'||value==='active')return value;
 throw Error('PCI_TIKTOK_001: use PCI_TIKTOK_CENTRAL=off, prepare or active.');
}
export const TIKTOK_SCOPES=['tiktok.followers','tiktok.average_views','tiktok.average_likes','tiktok.average_comments','tiktok.average_shares'] as const;
const keys={followers:'followers',averageViews:'average_views',averageLikes:'average_likes',averageComments:'average_comments',averageShares:'average_shares'} as const;
type Db={query(sql:string,values?:unknown[]):Promise<{rows:any[]}>};
export function centralRankInput(rows:Record<string,any>[],now:Date):RankInput {
 const people:RankInput['people']=[],observations:RankInput['observations']=[];
 for(const r of rows){
  const projected=projectTikTok(r,now.getTime());if(!projected)continue;
  people.push({id:r.person_id,createdAt:new Date(r.person_created_at).toISOString(),accounts:[{id:r.account_id,platform:'tiktok'}],categories:[]});
  for(const [key,metric] of Object.entries(keys)){
   const value=projected[key as keyof typeof keys];
   const scaled=typeof value==='number'?Math.round(value*(key==='followers'?1:10)):null;
   if(scaled===null||!Number.isSafeInteger(scaled)||scaled<0)continue;
   observations.push({accountId:r.account_id,metric:metric as Metric,value:scaled,accuracy:key==='followers'?'exact':'rounded3',observedAt:projected.observedAt});
  }
 }
 return {now:now.toISOString(),freshnessDays:15,people,observations};
}
export async function loadTikTokRankInput(db:Db,now:Date):Promise<RankInput>{
 return centralRankInput((await db.query('SELECT * FROM public.hub_tiktok_registered ORDER BY person_id')).rows,now);
}
// No public-side ranking. Read the selected central slot and confirm that it belongs to the same approved account.
export async function readCentralTikTok(db:Db,metric:unknown,now=new Date()):Promise<TikTokRow[]> {
 const key=metricOf(metric),scope='tiktok.'+keys[key];
 const rows=(await db.query(`SELECT v.*,rs.rank AS published_rank,rs.value::text AS published_value,
  rs.breakdown->'contributions'->0->>'observedAt' AS ranked_at
 FROM public.hub_tiktok_registered v
 JOIN public.published_pointers cohort_ptr ON cohort_ptr.scope='tiktok.followers'
 JOIN public.rank_runs cohort_run ON cohort_run.id=cohort_ptr.run_id AND cohort_run.status='published' AND cohort_run.scope=cohort_ptr.scope AND cohort_run.published_at>=v.published_at
 JOIN public.rank_slots cohort_slot ON cohort_slot.run_id=cohort_run.id AND cohort_slot.person_id=v.person_id
 AND cohort_slot.breakdown->'contributions'->0->>'accountId'=v.account_id::text
 LEFT JOIN public.published_pointers ptr ON ptr.scope=$1
 LEFT JOIN public.rank_runs rr ON rr.id=ptr.run_id AND rr.status='published' AND rr.scope=ptr.scope AND rr.published_at>=v.published_at
 LEFT JOIN public.rank_slots rs ON rs.run_id=rr.id AND rs.person_id=v.person_id
 AND rs.breakdown->'contributions'->0->>'accountId'=v.account_id::text
 ORDER BY rs.slot NULLS LAST,v.handle`,[scope])).rows;
 const result:TikTokRow[]=[];
 for(const r of rows){
  const item=projectTikTok(r,now.getTime());if(!item)continue;
  const at=Date.parse(r.ranked_at??''),value=r.published_value===null||r.published_value===undefined?null:Number(r.published_value);
  if(!item.stale&&item[key]!==null&&Number.isFinite(at)&&at<=now.getTime()&&now.getTime()-at<=15*86400000&&value!==null&&Number.isSafeInteger(value)&&value>=0&&Number.isInteger(r.published_rank)&&r.published_rank>0){
   item[key]=value/(key==='followers'?1:10);item.rank=r.published_rank;
  }
  result.push(item);
 }
 // Preserve authoritative ranks; rows without a valid published slot appear last.
 return result.sort((a,b)=>(a.rank??Infinity)-(b.rank??Infinity)||a.handle.localeCompare(b.handle));
}
