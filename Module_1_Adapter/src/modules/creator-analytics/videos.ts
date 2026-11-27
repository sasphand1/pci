import {pool,query,transaction} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {YoutubeClient,chunks,countOrNull,dateOrNull,thumbUrl} from '../youtube/client.js';
import type {ObservationPoint} from './engine.js';
import {videoMilestones,velocityPerHour,breakoutFactor} from './engine.js';
import {recordObservation} from '../ingest/store.js';
import {safeChannelBanner} from '../creators-bucket/profile-analytics.mjs';

const MAX_CHANNELS=150;
// Each page costs at most two requests; global soft quota still enforced by YoutubeClient.
// This is a per-run budget, NOT a per-channel or per-catalogue limit.
const MAX_PAGES_PER_RUN=400;
type ChannelAccount={id:string;external_id:string;playlist_id:string|null;page_token:string|null;scan_started_at:Date|string|null};
type ScanTask={account:ChannelAccount;playlist:string;token:string|undefined;startedAt:string;count:string|null};

/** Read-only public catalogue collector. Persist the cursor in the same transaction as the page.
 * Round-robin pages, resume after quota/errors; never delete a catalogue based on a partial scan.
 */
export async function collectCreatorVideoSnapshots():Promise<{channels:number;videos:number;failed:number}> {
 const lockClient=await pool.connect();let locked=false;
 try{
  const gate=await lockClient.query('SELECT pg_try_advisory_lock(712325) AS locked');
  if(!gate.rows[0]?.locked)return {channels:0,videos:0,failed:0};
  locked=true;
  const accounts=(await query<ChannelAccount>(`SELECT a.id,a.external_id,s.playlist_id,s.page_token,s.scan_started_at FROM accounts a
   LEFT JOIN creator_catalogue_scan s ON s.account_id=a.id
   WHERE a.platform='youtube' AND a.external_id ~ '^UC[A-Za-z0-9_-]{22}$'
   AND (s.completed_at IS NULL OR s.scan_started_at IS NOT NULL OR s.completed_at<now()-interval '20 hours')
   ORDER BY s.last_attempt_at NULLS FIRST,a.id LIMIT $1`,[MAX_CHANNELS])).rows;
  const yt=new YoutubeClient();let failed=0,seen=0,pages=0;const tasks:ScanTask[]=[];
  for(const channelGroup of chunks(accounts,50)){
   let channelDetails;
   try{channelDetails=await yt.channels(channelGroup.map(c=>c.external_id));}
   catch(err){failed+=channelGroup.length;logger.warn({err},'Creator video channel batch unavailable');continue;}
   const byId=new Map(channelDetails.map(c=>[c.id,c]));
   for(const account of channelGroup){
    const channel=byId.get(account.external_id),observedAt=new Date().toISOString();
    const rawCount=countOrNull(channel?.statistics?.videoCount);
    if(rawCount!==null&&Number.isSafeInteger(Number(rawCount))&&Number(rawCount)>=0){
     try{await recordObservation({sourceId:'youtube.api',sourceRunRef:'channel-video-count:'+observedAt,accountId:account.id,entityKind:'account',entityId:'youtube:'+account.external_id,metric:'video_count',valueNumeric:Number(rawCount),valueText:null,accuracy:'exact',observedAt,metadata:{origin:'youtube-channel-statistics'}});}
     catch(err){logger.warn({err,accountId:account.id},'Creators Bucket channel video count unavailable');}
    }
    if(channel&&/^UC[A-Za-z0-9_-]{22}$/.test(account.external_id)){
     try{await recordObservation({sourceId:'youtube.api',sourceRunRef:'video-worker-banner:'+observedAt,accountId:account.id,entityKind:'account',entityId:'youtube:'+account.external_id,metric:'channel_banner_url',valueNumeric:null,valueText:safeChannelBanner(channel.brandingSettings?.image?.bannerExternalUrl)??'unavailable',accuracy:'exact',observedAt,metadata:{origin:'youtube-branding-settings'}});}
     catch{logger.warn({accountId:account.id},'Creators Bucket channel banner unavailable');}
    }
    const uploads=channel?.contentDetails?.relatedPlaylists?.uploads;
    if(!uploads){failed++;continue;}
    const resume=account.playlist_id===uploads&&account.scan_started_at!==null&&account.page_token!==null;
    tasks.push({account,playlist:uploads,token:resume?account.page_token!:undefined,startedAt:resume?new Date(account.scan_started_at!).toISOString():observedAt,count:rawCount});
   }
  }
  while(tasks.length&&pages<MAX_PAGES_PER_RUN){
   const task=tasks.shift()!;const {account,playlist,startedAt}=task;pages++;
   try{
    // Record the attempt even if the provider rejects a page, for fair rotation.
    await query(`INSERT INTO creator_catalogue_scan(account_id,last_attempt_at) VALUES($1,now())
      ON CONFLICT(account_id) DO UPDATE SET last_attempt_at=EXCLUDED.last_attempt_at`,[account.id]);
    const page=await yt.cataloguePage(playlist,task.token);
    if(page.next&&page.next===task.token)throw new Error('YOUTUBE_REPEATED_PAGE_TOKEN');
    const details=await yt.catalogueVideos(page.ids);
    const wanted=new Set(page.ids),unique=new Map(details.filter(v=>wanted.has(v.id)&&v.snippet?.channelId===account.external_id&&v.status?.privacyStatus==='public').map(v=>[v.id,v]));
    const observedAt=new Date().toISOString();
    await transaction(async tx=>{
     for(const video of unique.values()){
      const views=countOrNull(video.statistics?.viewCount),likes=countOrNull(video.statistics?.likeCount),comments=countOrNull(video.statistics?.commentCount);
      await tx.query(`INSERT INTO creator_video_catalogue
       (video_id,account_id,title,description,published_at,thumbnail_url,duration_iso,view_count,like_count,comment_count,last_observed_at,catalogue_scan_at,catalogue_public)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
       ON CONFLICT(video_id) DO UPDATE SET account_id=EXCLUDED.account_id,title=EXCLUDED.title,description=EXCLUDED.description,
       published_at=EXCLUDED.published_at,thumbnail_url=EXCLUDED.thumbnail_url,duration_iso=EXCLUDED.duration_iso,
       view_count=EXCLUDED.view_count,like_count=EXCLUDED.like_count,comment_count=EXCLUDED.comment_count,
       last_observed_at=EXCLUDED.last_observed_at,catalogue_scan_at=EXCLUDED.catalogue_scan_at,catalogue_public=true`,
       [video.id,account.id,(video.snippet?.title??'Untitled video').slice(0,500),(video.snippet?.description??'').slice(0,10000),dateOrNull(video.snippet?.publishedAt),thumbUrl(video.snippet),video.contentDetails?.duration??null,views,likes,comments,observedAt,startedAt]);
      if(views!==null)await tx.query(`INSERT INTO creator_video_view_observations(video_id,observed_at,view_count) VALUES($1,$2,$3) ON CONFLICT(video_id,observed_at) DO NOTHING`,[video.id,observedAt,views]);
     }
     // Only after the last page may absent entries leave the current public catalogue.
     // Historical observations remain subject to the existing retention policy.
     if(!page.next)await tx.query(`UPDATE creator_video_catalogue SET catalogue_public=false WHERE account_id=$1 AND catalogue_scan_at IS DISTINCT FROM $2::timestamptz`,[account.id,startedAt]);
     await tx.query(`INSERT INTO creator_catalogue_scan(account_id,playlist_id,page_token,scan_started_at,completed_at,last_attempt_at,public_video_count,last_error)
      VALUES($1,$2,$3,$4,$5,now(),$6,NULL)
      ON CONFLICT(account_id) DO UPDATE SET playlist_id=EXCLUDED.playlist_id,page_token=EXCLUDED.page_token,
      scan_started_at=EXCLUDED.scan_started_at,completed_at=COALESCE(EXCLUDED.completed_at,creator_catalogue_scan.completed_at),
      last_attempt_at=EXCLUDED.last_attempt_at,public_video_count=EXCLUDED.public_video_count,last_error=NULL`,
      [account.id,playlist,page.next??null,page.next?startedAt:null,page.next?null:observedAt,task.count]);
    });
    seen+=unique.size;
    if(page.next){task.token=page.next;tasks.push(task);}
   }catch(err){
    failed++;const code=err instanceof Error?err.message:'CATALOGUE_ERROR';
    // A changed playlist can invalidate a cursor; restart that scan next round.
    if(/invalidPageToken|pageTokenInvalid|REPEATED_PAGE_TOKEN/i.test(code))await query(`UPDATE creator_catalogue_scan SET page_token=NULL,scan_started_at=NULL,completed_at=NULL,last_error=$2 WHERE account_id=$1`,[account.id,code.slice(0,120)]);
    else await query('UPDATE creator_catalogue_scan SET last_error=$2 WHERE account_id=$1',[account.id,code.slice(0,120)]);
    logger.warn({accountId:account.id,code},'Creator catalogue page unavailable; committed pages preserved');
    if(/SOFT_QUOTA|quotaExceeded|dailyLimitExceeded/i.test(code))break;
   }
  }
  await query("DELETE FROM creator_video_view_observations WHERE observed_at < now() - interval '29 days'");
  await query("DELETE FROM creator_video_catalogue WHERE last_observed_at < now() - interval '29 days'");
  return {channels:accounts.length,videos:seen,failed};
 }finally{
  try{if(locked)await lockClient.query('SELECT pg_advisory_unlock(712325)');}finally{lockClient.release();}
 }
}

type VideoRow={videoId:string;title:string;publishedAt:Date|string|null;thumbnailUrl:string|null;durationIso:string|null;viewCount:string|null;lastObservedAt:Date|string};
type ViewRow={videoId:string;observedAt:Date|string;viewCount:string};
export type CreatorVideoSummary={
  sampledVideos:number;averageViews:number|null;
  topVideos:Array<{videoId:string;title:string;views:number;publishedAt:string|null}>;
  videos:Array<{videoId:string;title:string;publishedAt:string|null;thumbnailUrl:string|null;
    currentViews:number|null;views24h:number|null;views7d:number|null;views30d:number|null;
    velocityPerHour:number|null;breakoutFactor:number|null}>;
};

export async function creatorVideoSummary(accountIds:string[]):Promise<CreatorVideoSummary>{
  const empty:CreatorVideoSummary={sampledVideos:0,averageViews:null,topVideos:[],videos:[]};
  if(!accountIds.length)return empty;
  const videos=(await query<VideoRow>(`SELECT video_id AS "videoId",title,published_at AS "publishedAt",
    thumbnail_url AS "thumbnailUrl",duration_iso AS "durationIso",view_count::text AS "viewCount",
    last_observed_at AS "lastObservedAt" FROM creator_video_catalogue
    WHERE account_id=ANY($1::uuid[]) AND last_observed_at>now()-interval '3 days'
    ORDER BY published_at DESC NULLS LAST,video_id LIMIT 100`,[accountIds])).rows;
  if(!videos.length)return empty;
  const history=(await query<ViewRow>(`SELECT video_id AS "videoId",observed_at AS "observedAt",view_count::text AS "viewCount"
    FROM creator_video_view_observations WHERE video_id=ANY($1::text[]) ORDER BY video_id,observed_at`,[videos.map(v=>v.videoId)])).rows;
  const byVideo=new Map<string,ObservationPoint[]>();
  for(const h of history){const value=Number(h.viewCount);if(!Number.isSafeInteger(value)||value<0)continue;
    const values=byVideo.get(h.videoId)??[];values.push({at:new Date(h.observedAt).toISOString(),value});byVideo.set(h.videoId,values);}
  const enriched=videos.map(v=>{
    const samples=byVideo.get(v.videoId)??[];
    const publishedAt=v.publishedAt?new Date(v.publishedAt).toISOString():null;
    const milestones=publishedAt?videoMilestones(samples,publishedAt):{'24h':null,'7d':null,'30d':null};
    const currentViews=v.viewCount===null?null:Number(v.viewCount);
    return {videoId:v.videoId,title:v.title,publishedAt,thumbnailUrl:v.thumbnailUrl,
      currentViews:currentViews!==null&&Number.isSafeInteger(currentViews)?currentViews:null,
      views24h:milestones['24h'],views7d:milestones['7d'],views30d:milestones['30d'],
      velocityPerHour:velocityPerHour(samples),breakoutFactor:null as number|null};
  });
  for(const v of enriched){if(v.views24h===null||!v.publishedAt)continue;
    const peers=enriched.filter(p=>p.videoId!==v.videoId&&p.publishedAt&&p.publishedAt<v.publishedAt!&&p.views24h!==null)
      .map(p=>p.views24h!);v.breakoutFactor=breakoutFactor(v.views24h,peers);}
  const known=enriched.filter(v=>v.currentViews!==null);
  const averageViews=known.length?Math.round(known.reduce((s,v)=>s+v.currentViews!,0)/known.length):null;
  const topVideos=[...known].sort((a,b)=>b.currentViews!-a.currentViews!).slice(0,5)
    .map(v=>({videoId:v.videoId,title:v.title,views:v.currentViews!,publishedAt:v.publishedAt}));
  return {sampledVideos:known.length,averageViews,topVideos,videos:enriched.slice(0,15)};
}
