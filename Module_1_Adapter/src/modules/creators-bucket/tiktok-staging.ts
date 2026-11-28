import { inspectProfileAvatar } from '../../providers/avatar.js';
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
export async function storeTikTokCandidate(runId:string, result:Awaited<ReturnType<typeof collect>>,promotePending=false){
 return transaction(async c=>{
  const {profile,posts,analytics,observedAt}=result;
  const lease=await c.query("SELECT 1 FROM ingest_jobs WHERE id=$1 AND source_id='scrappa.api' AND status='running' AND started_at>now()-interval '5 minutes' FOR UPDATE",[runId]);
  if(!lease.rowCount)throw Error('collection_lease_expired');
  if(promotePending){
   const pending=(await c.query<{person_name:string|null;niche:string|null}>('SELECT person_name,niche FROM scrappa_pending_accounts WHERE handle=$1 FOR UPDATE',[profile.handle])).rows[0];
   if(!pending)throw Error('pending_changed');
   if((await c.query('SELECT 1 FROM scrappa_candidates WHERE external_id=$1 OR handle=$2',[profile.accountId,profile.handle])).rowCount)throw Error('candidate_identity_conflict');
   await c.query('INSERT INTO scrappa_candidates(external_id,handle,display_name,person_name,niche,checked_at,last_attempt_at) VALUES($1,$2,$3,$4,$5,$6,$6)',[profile.accountId,profile.handle,profile.name,pending.person_name,pending.niche,observedAt]);
   await c.query('DELETE FROM scrappa_pending_accounts WHERE handle=$1',[profile.handle]);
  }
  const candidate=await c.query('SELECT 1 FROM scrappa_candidates WHERE external_id=$1 AND handle=$2 FOR UPDATE',[profile.accountId,profile.handle]);
  if(!candidate.rowCount)throw Error('candidate_changed');
  const key='tiktok_candidate:'+profile.accountId;
  // Replace only the current projection; observations remain historical. Null never becomes zero or an old value.
  await c.query("DELETE FROM ingest_latest WHERE source_id=$1 AND ((entity_kind='account' AND entity_id=$2) OR (entity_kind='content' AND left(entity_id,length($2)+1)=$2||':'))",[sourceId,key]);
  let stored=0;
  async function put(entityKind:'account'|'content',entityId:string,metric:string,value:number|null,scale=0){
   if(value===null)return;
   const outcome=await recordObservation({sourceId,sourceRunRef:runId,accountId:null,entityKind,entityId,metric,valueNumeric:Math.round(value*10**scale),valueText:null,valueScale:scale,accuracy:scale?'rounded':'exact',observedAt,metadata:{candidateId:profile.accountId,stage:'candidate'}},c);
   if(outcome==='invalid')throw Error('invalid_hub_observation');
   if(outcome==='stored')stored++;
  }
  for(const [metric,value] of Object.entries({followers:profile.followers,following:profile.following,likes:profile.likes,video_count:profile.posts,sample_size:analytics.sampleSize}))await put('account',key,metric,value);
  for(const [metric,value] of Object.entries({average_views:analytics.averageViews,average_likes:analytics.averageLikes,average_comments:analytics.averageComments,average_shares:analytics.averageShares}))await put('account',key,metric,value,1);
  for(const post of posts){
   for(const [metric,value] of Object.entries({views:post.views,likes:post.likes,comments:post.comments,shares:post.shares,favorites:post.favorites,downloads:post.downloads}))await put('content',key+':'+post.postId,metric,value);
  }
  // Store the coherent sampled cohort (including nulls and publication timestamps).
  const {avatar: rawAvatar,bio: _bio,...safeProfile}=profile;
  const avatar=inspectProfileAvatar(rawAvatar).avatarUrl??null;
  await c.query('INSERT INTO scrappa_snapshots(run_id,external_id,observed_at,profile,posts,analytics) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb)',[runId,profile.accountId,observedAt,JSON.stringify({...safeProfile,avatar}),JSON.stringify(posts),JSON.stringify(analytics)]);
  await c.query('UPDATE scrappa_candidates SET last_success_at=$2,last_error=NULL WHERE external_id=$1',[profile.accountId,observedAt]);
  const complete=profile.followers!==null&&analytics.sampleSize===10&&analytics.averageViews!==null&&analytics.averageLikes!==null&&analytics.averageComments!==null&&analytics.averageShares!==null;
  await c.query(`UPDATE ingest_jobs SET status=$3,finished_at=now(),observations=$2 WHERE id=$1`,[runId,stored,complete?'succeeded':'partial']);
  await c.query(`UPDATE ingest_sources SET last_attempt_at=now(),last_success_at=now(),last_error=NULL WHERE id=$1`,[sourceId]);
  await c.query(`INSERT INTO hub_source_health(source_id,status,consecutive_failures,last_error_code,checked_at) VALUES('scrappa.api','ok',0,NULL,now()) ON CONFLICT(source_id) DO UPDATE SET consecutive_failures=0,last_error_code=NULL,checked_at=now(),status='ok'`);
  return stored;
 });
}
