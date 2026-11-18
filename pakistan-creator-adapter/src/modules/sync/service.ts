import { pool,query,transaction } from '../../lib/db.js';
import { bustPublicCache } from '../../lib/redis.js';
import { config } from '../../lib/config.js';
import { YoutubeClient,chunks,countOrNull,dateOrNull,thumbUrl,type YoutubeChannel,type YoutubeVideo } from '../youtube/client.js';
import { logger } from '../../lib/errors.js';

export async function enqueueSync(source:'scheduled'|'manual',requestedBy:string|null=null) {
 return transaction(async tx=>{
   // Transaction advisory lock makes manual and scheduled enqueue operations idempotent.
   await tx.query('SELECT pg_advisory_xact_lock(712003)');
   const existing=await tx.query("SELECT id FROM sync_runs WHERE status IN ('queued','running') ORDER BY created_at LIMIT 1");
   if(existing.rows[0])return {id:existing.rows[0].id,alreadyQueued:true};
   const r=await tx.query('INSERT INTO sync_runs(source,requested_by) VALUES($1,$2) RETURNING id',[source,requestedBy]);
   return {id:r.rows[0].id,alreadyQueued:false};
 });
}
export async function takeNextJob() {
 return transaction(async c=>{
   // Keep manual retries from launching duplicate work while another job is active.
   const active=await c.query("SELECT 1 FROM sync_runs WHERE status='running' LIMIT 1");
   if(active.rowCount)return null;
   const r=await c.query("SELECT id FROM sync_runs WHERE status='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1");
   if(!r.rowCount)return null;
   await c.query("UPDATE sync_runs SET status='running',started_at=now() WHERE id=$1",[r.rows[0].id]);
   return r.rows[0].id as string;
 });
}
export async function recoverStalledJobs(){
 await query("UPDATE sync_runs SET status='failed',finished_at=now(),error_code='WORKER_INTERRUPTED',error_message='Job interrupted; manual retry available' WHERE status='running' AND started_at<now()-interval '120 minutes'");
}
export async function performSync(runId:string){
 const client=await pool.connect();const yt=new YoutubeClient();let hasLock=false;
 try {
   const lock=await client.query('SELECT pg_try_advisory_lock(712002) AS locked');
   if(!lock.rows[0].locked)throw new Error('SYNC_ALREADY_RUNNING');
   hasLock=true;
   const creators=(await query("SELECT id,channel_id FROM creators WHERE enabled=true ORDER BY channel_id")).rows as Array<{id:string,channel_id:string}>;
   if(creators.length===0)throw new Error('NO_ACTIVE_CREATORS');
   const channelResults:YoutubeChannel[]=[];
   for(const group of chunks(creators.map(c=>c.channel_id),50))channelResults.push(...await yt.channels(group));
   const lookup=new Map(channelResults.map(c=>[c.id,c]));
   const missing=creators.filter(c=>!lookup.has(c.channel_id));
   // If most channels disappear from one response, treat it as upstream failure, not a new truth.
   if(missing.length===creators.length || missing.length>Math.max(2,Math.floor(creators.length*0.1)))
     throw new Error('YOUTUBE_CHANNEL_RESULTS_INCOMPLETE: suspiciously many missing channels');
   const available=creators.filter(c=>lookup.has(c.channel_id));
   const warnings:string[]=[];
   if(missing.length)warnings.push(`${missing.length} unavailable channels retained their previous statistics`);

   const videoIdsByChannel=new Map<string,string[]>();
   const uploadFailures=new Set<string>();
   for(const creator of available){
     const uploads=lookup.get(creator.channel_id)!.contentDetails?.relatedPlaylists?.uploads;
     // A playlist failure must not erase previously retrieved videos for that creator.
     try {
       const ids=uploads?await yt.uploads(uploads,config.SYNC_VIDEOS_PER_CHANNEL):[];
       videoIdsByChannel.set(creator.channel_id,ids);
     } catch (e) {
       uploadFailures.add(creator.channel_id);
       warnings.push(`Uploads unavailable for channel ${creator.channel_id}; previous video window retained`);
     }
   }
   const allIds=[...new Set([...videoIdsByChannel.values()].flat())];
   const videoResults:YoutubeVideo[]=[];
   for(const group of chunks(allIds,50))videoResults.push(...await yt.videos(group));
   const videoLookup=new Map(videoResults.map(v=>[v.id,v]));
   const fetchTime=new Date().toISOString();
   await transaction(async tx=>{
     for(const creator of available){
       const channel=lookup.get(creator.channel_id)!;
       const stats=channel.statistics??{};
       const hidden=stats.hiddenSubscriberCount===true || stats.subscriberCount===undefined;
       const subscriberCount=hidden?null:countOrNull(stats.subscriberCount);
       await tx.query(`INSERT INTO channel_stats_latest
         (creator_id,subscriber_count,subscriber_hidden,view_count,video_count,youtube_title,youtube_description,thumbnail_url,published_at,uploads_playlist_id,fetched_at,sync_run_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT(creator_id) DO UPDATE SET
         subscriber_count=EXCLUDED.subscriber_count,subscriber_hidden=EXCLUDED.subscriber_hidden,
         view_count=EXCLUDED.view_count,video_count=EXCLUDED.video_count,youtube_title=EXCLUDED.youtube_title,
         youtube_description=EXCLUDED.youtube_description,thumbnail_url=EXCLUDED.thumbnail_url,
         published_at=EXCLUDED.published_at,uploads_playlist_id=EXCLUDED.uploads_playlist_id,
         fetched_at=EXCLUDED.fetched_at,sync_run_id=EXCLUDED.sync_run_id`,[
           creator.id,subscriberCount,hidden,countOrNull(stats.viewCount),countOrNull(stats.videoCount),
           channel.snippet?.title??null,channel.snippet?.description??null,thumbUrl(channel.snippet),
           dateOrNull(channel.snippet?.publishedAt),channel.contentDetails?.relatedPlaylists?.uploads??null,fetchTime,runId
         ]);
       const present:string[]=[];
       for(const id of videoIdsByChannel.get(creator.channel_id)??[]){
         const video=videoLookup.get(id);
         if(!video || video.snippet?.channelId!==creator.channel_id)continue;
         present.push(id);
         await tx.query(`INSERT INTO videos(video_id,creator_id,title,description,published_at,thumbnail_url,duration_iso,fetched_at,last_seen_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) ON CONFLICT(video_id) DO UPDATE SET
           creator_id=EXCLUDED.creator_id,title=EXCLUDED.title,description=EXCLUDED.description,
           published_at=EXCLUDED.published_at,thumbnail_url=EXCLUDED.thumbnail_url,duration_iso=EXCLUDED.duration_iso,
           fetched_at=EXCLUDED.fetched_at,last_seen_at=EXCLUDED.last_seen_at`,[
             id,creator.id,video.snippet?.title??'[Unavailable title]',video.snippet?.description??'',
             dateOrNull(video.snippet?.publishedAt),thumbUrl(video.snippet),video.contentDetails?.duration??null,fetchTime
           ]);
         await tx.query(`INSERT INTO video_stats_latest(video_id,view_count,like_count,comment_count,fetched_at)
           VALUES($1,$2,$3,$4,$5) ON CONFLICT(video_id) DO UPDATE SET
           view_count=EXCLUDED.view_count,like_count=EXCLUDED.like_count,
           comment_count=EXCLUDED.comment_count,fetched_at=EXCLUDED.fetched_at`,[
             id,countOrNull(video.statistics?.viewCount),countOrNull(video.statistics?.likeCount),
             countOrNull(video.statistics?.commentCount),fetchTime
           ]);
       }
       // Latest-50 window only; old records disappear from active catalogue.
       if(!uploadFailures.has(creator.channel_id))await tx.query('DELETE FROM videos WHERE creator_id=$1 AND NOT (video_id=ANY($2::text[]))',[creator.id,present]);
     }
     await tx.query('UPDATE publication_state SET sync_run_id=$1,published_at=$2 WHERE id=true',[runId,fetchTime]);
     await tx.query("UPDATE sync_runs SET status=$2,finished_at=now(),quota_used=$3,channel_count=$4,video_count=$5,error_code=$6,error_message=$7 WHERE id=$1",[runId,warnings.length?'partial':'succeeded',yt.calls,available.length,videoResults.length,warnings.length?'PARTIAL_SYNC':null,warnings.length?warnings.join('; ').slice(0,250):null]);
   });
   await bustPublicCache();
   logger.info({runId,quotaUsed:yt.calls,channelCount:available.length,videoCount:videoResults.length,warnings},'YouTube sync completed');
 }catch(e){
   const message=e instanceof Error?e.message:'Unknown sync failure';
   await query("UPDATE sync_runs SET status='failed',finished_at=now(),quota_used=$2,error_code=$3,error_message=$4 WHERE id=$1",[runId,yt.calls,message.split(':')[0].slice(0,80),message.slice(0,250)]);
   logger.error({runId,reason:message},'YouTube sync failed; latest published statistics retained');
 } finally {
   if(hasLock){try{await client.query('SELECT pg_advisory_unlock(712002)');}catch{}}client.release();
 }
}
export async function cleanupRetention(){
  const n=config.WALL_MESSAGE_RETENTION_DAYS;
  await query(`DELETE FROM wall_messages WHERE created_at<now()-($1::int * interval '1 day')`,[n]);
  await query("DELETE FROM email_verifications WHERE expires_at < now() - interval '1 day'");
  await query("DELETE FROM password_resets WHERE expires_at < now() - interval '1 day'");
  await query("DELETE FROM sync_runs WHERE finished_at < now() - interval '29 days' AND status IN ('succeeded','partial','failed')");
  await query("DELETE FROM videos WHERE last_seen_at < now() - interval '29 days'");
}
