import {pool,query,transaction} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {YoutubeClient,chunks,countOrNull,dateOrNull,thumbUrl} from '../youtube/client.js';
import type {ObservationPoint} from './engine.js';
import {videoMilestones,velocityPerHour,breakoutFactor} from './engine.js';
import {recordObservation} from '../ingest/store.js';
import {safeChannelBanner} from '../creators-bucket/profile-analytics.mjs';

const MAX_CHANNELS=150;
const VIDEOS_PER_CHANNEL=50;
type ChannelAccount={id:string;external_id:string};
type Sample={videoId:string;accountId:string;title:string;description:string;publishedAt:string|null;thumbnailUrl:string|null;durationIso:string|null;views:string|null;likes:string|null;comments:string|null};

/** Read-only video observation collector; does not modify any rankings or legacy video records.
 * Runs after the daily pipeline; only real YouTube Data API cumulative counts are stored.
 */
export async function collectCreatorVideoSnapshots():Promise<{channels:number;videos:number;failed:number}> {
  const lockClient=await pool.connect();
  let locked=false;
  try {
  const gate=await lockClient.query('SELECT pg_try_advisory_lock(712325) AS locked');
  if(!gate.rows[0]?.locked)return {channels:0,videos:0,failed:0};
  locked=true;
  const accounts=(await query<ChannelAccount>(`SELECT id,external_id FROM accounts
    WHERE platform='youtube' AND external_id ~ '^UC[A-Za-z0-9_-]{22}$'
    ORDER BY (SELECT max(v.last_observed_at) FROM creator_video_catalogue v WHERE v.account_id=accounts.id) NULLS FIRST,id LIMIT $1`,[MAX_CHANNELS])).rows;
  const yt=new YoutubeClient();
  let failed=0,seen=0;
  const observedAt=new Date().toISOString();
  for(const channelGroup of chunks(accounts,50)) {
    let channelDetails;
    try{channelDetails=await yt.channels(channelGroup.map(c=>c.external_id));}
    catch(err){failed+=channelGroup.length;logger.warn({err},'Creator video channel batch unavailable');continue;}
    const byId=new Map(channelDetails.map(c=>[c.id,c]));
    for(const account of channelGroup) {
      try {
        const channel=byId.get(account.external_id);
        // Reuse the already-fetched channels.list response: zero additional upstream calls.
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
        const ids=await yt.uploads(uploads,VIDEOS_PER_CHANNEL);
        const samples:Sample[]=[];
        for(const videoIds of chunks(ids,50)) {
          for(const video of await yt.videos(videoIds)) {
            if(video.snippet?.channelId!==account.external_id)continue;
            samples.push({videoId:video.id,accountId:account.id,
              title:(video.snippet?.title??'Untitled video').slice(0,500),
              description:(video.snippet?.description??'').slice(0,10000),
              publishedAt:dateOrNull(video.snippet?.publishedAt),
              thumbnailUrl:thumbUrl(video.snippet),durationIso:video.contentDetails?.duration??null,
              views:countOrNull(video.statistics?.viewCount),likes:countOrNull(video.statistics?.likeCount),
              comments:countOrNull(video.statistics?.commentCount)});
          }
        }
        if(!samples.length)continue;
        await transaction(async tx=>{
          for(const s of samples) {
            await tx.query(`INSERT INTO creator_video_catalogue
              (video_id,account_id,title,description,published_at,thumbnail_url,duration_iso,view_count,like_count,comment_count,last_observed_at)
              VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
              ON CONFLICT(video_id) DO UPDATE SET account_id=EXCLUDED.account_id,title=EXCLUDED.title,
              description=EXCLUDED.description,published_at=EXCLUDED.published_at,thumbnail_url=EXCLUDED.thumbnail_url,
              duration_iso=EXCLUDED.duration_iso,view_count=EXCLUDED.view_count,
              like_count=EXCLUDED.like_count,
              comment_count=EXCLUDED.comment_count,
              last_observed_at=EXCLUDED.last_observed_at`,
              [s.videoId,s.accountId,s.title,s.description,s.publishedAt,s.thumbnailUrl,s.durationIso,
                s.views,s.likes,s.comments,observedAt]);
            if(s.views!==null)await tx.query(`INSERT INTO creator_video_view_observations(video_id,observed_at,view_count)
              VALUES($1,$2,$3) ON CONFLICT(video_id,observed_at) DO NOTHING`,[s.videoId,observedAt,s.views]);
          }
        });
        seen+=samples.length;
      }catch(err){failed++;logger.warn({err,accountId:account.id},'Creator video sample skipped; previously collected observations preserved');}
    }
  }
  // Safe default: keep no more than 30 days of public YouTube video samples.
  await query("DELETE FROM creator_video_view_observations WHERE observed_at < now() - interval '29 days'");
  await query("DELETE FROM creator_video_catalogue WHERE last_observed_at < now() - interval '29 days'");
  return {channels:accounts.length,videos:seen,failed};
  } finally {
    try{if(locked)await lockClient.query('SELECT pg_advisory_unlock(712325)');}
    finally{lockClient.release();}
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
