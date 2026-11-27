import { query, transaction } from '../../lib/db.js';
import { recordObservation } from '../ingest/store.js';
import type { collect } from '../scrappa/collector.js';

// Staged candidate observations are deliberately not live registry accounts.
// Promotion must re-key them to tiktok:<externalId> and attach an account UUID.
const sourceId = 'scrappa.api' as const;
export async function ensureTikTokSource(){
 await query(`INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label)
 VALUES('scrappa.api','tiktok','api',false,'creators',360,'Scrappa public TikTok API') ON CONFLICT(id) DO NOTHING`);
}
export async function storeTikTokCandidate(runId:string, result:Awaited<ReturnType<typeof collect>>){
 return transaction(async c=>{
  const {profile,posts,analytics,observedAt}=result;
  const key='tiktok_candidate:'+profile.accountId;
  let stored=0;
  async function put(entityKind:'account'|'content',entityId:string,metric:string,value:number|null,scale=0){
   if(value===null)return;
   const outcome=await recordObservation({sourceId,sourceRunRef:runId,accountId:null,entityKind,entityId,metric,valueNumeric:Math.round(value*10**scale),valueText:null,valueScale:scale,accuracy:'exact',observedAt,metadata:{candidateId:profile.accountId,stage:'candidate'}},c);
   if(outcome==='invalid')throw Error('invalid_hub_observation');
   if(outcome==='stored')stored++;
  }
  for(const [metric,value] of Object.entries({followers:profile.followers,following:profile.following,likes:profile.likes,video_count:profile.posts,sample_size:analytics.sampleSize}))await put('account',key,metric,value);
  for(const [metric,value] of Object.entries({average_views:analytics.averageViews,average_likes:analytics.averageLikes,average_comments:analytics.averageComments,average_shares:analytics.averageShares}))await put('account',key,metric,value,1);
  for(const post of posts){
   for(const [metric,value] of Object.entries({views:post.views,likes:post.likes,comments:post.comments,shares:post.shares,favorites:post.favorites,downloads:post.downloads}))await put('content',key+':'+post.postId,metric,value);
  }
  await c.query(`UPDATE ingest_jobs SET status='succeeded',finished_at=now(),observations=$2 WHERE id=$1`,[runId,stored]);
  await c.query(`UPDATE ingest_sources SET last_attempt_at=now(),last_success_at=now(),last_error=NULL WHERE id=$1`,[sourceId]);
  return stored;
 });
}
