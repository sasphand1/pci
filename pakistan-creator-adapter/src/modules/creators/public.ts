import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../lib/db.js';
import { cacheRead,cacheKey } from '../../lib/redis.js';
import { config } from '../../lib/config.js';
import { handler,HttpError } from '../../lib/errors.js';
import { rankedRows,sumCounts } from '../ranking/rank.mjs';
import { roundedMean } from '../youtube/normalizers.mjs';

export const publicRoutes=Router();
const pageQuery=z.object({page:z.coerce.number().int().min(1).max(10000).default(1),limit:z.coerce.number().int().min(1).max(100).default(25),
  sort:z.enum(['subscribers','views','videos']).optional(),category:z.string().regex(/^[a-z0-9-]{2,60}$/).optional(),search:z.string().trim().max(100).optional()});
const cached=async<T>(key:string,work:()=>Promise<T>)=>cacheRead(await cacheKey(key),work,config.PUBLIC_CACHE_TTL_SECONDS);
async function defaultSort():Promise<'subscribers'|'views'|'videos'>{
 const r=await query("SELECT value FROM app_settings WHERE key='ranking_default'");
 const candidate=r.rows[0]?.value;
 return candidate==='views'||candidate==='videos'?candidate:'subscribers';
}
async function getCreators(){
 const r=await query(`SELECT c.id,c.channel_id AS "channelId",c.slug,c.display_name AS "displayName",c.description,c.featured,
   s.subscriber_count::text AS "subscriberCount",s.subscriber_hidden AS "subscriberHidden",s.view_count::text AS "viewCount",
   s.video_count::text AS "videoCount",s.youtube_title AS "youtubeTitle",s.thumbnail_url AS "thumbnailUrl",
   s.fetched_at AS "fetchedAt",
   COALESCE(json_agg(json_build_object('slug',ca.slug,'label',ca.label)) FILTER (WHERE ca.id IS NOT NULL),'[]'::json) AS categories
   FROM creators c LEFT JOIN channel_stats_latest s ON s.creator_id=c.id
   LEFT JOIN creator_categories cc ON cc.creator_id=c.id LEFT JOIN categories ca ON ca.id=cc.category_id AND ca.active=true
   WHERE c.enabled=true GROUP BY c.id,s.creator_id ORDER BY c.id`);
 return r.rows as any[];
}
publicRoutes.get('/meta',handler(async(_req,res)=>res.json({data:{app:'Pakistan Creator Index',apiVersion:'v1',
 metrics:['subscribers','views','videos'],rankingMethod:'Raw YouTube metrics, descending; equal counts share a rank',
 userGeneratedWall:true,advancedAnalytics:false,source:'YouTube Data API v3',youtubeAffiliation:false}})));
publicRoutes.get('/site-config',handler(async(_req,res)=>{
 const data=await cached('site-config',async()=>{
   const r=await query("SELECT key,value FROM app_settings WHERE key IN ('ranking_default','homepage_announcement','wall_enabled')");
   const result=Object.fromEntries(r.rows.map((x:any)=>[x.key,x.value]));
   const featured=(await query("SELECT slug,display_name AS \"displayName\" FROM creators WHERE featured=true AND enabled=true ORDER BY display_name LIMIT 20")).rows;
   return {...result,featured};
 });res.json({data});
}));
publicRoutes.get('/categories',handler(async(_req,res)=>{
 const data=await cached('categories',async()=> (await query('SELECT id,slug,label,description,display_order AS "displayOrder" FROM categories WHERE active=true ORDER BY display_order,slug')).rows);
 res.json({data});
}));
publicRoutes.get('/creators',handler(async(req,res)=>{
 const q=pageQuery.parse(req.query);
 const sort=q.sort??await defaultSort();
 const result=await cached(`creators:${JSON.stringify({...q,sort})}`,async()=>{
   const all=await getCreators();
   const found=all.filter(c=>(!q.category||c.categories.some((p:any)=>p.slug===q.category))&&(!q.search||[c.displayName,c.youtubeTitle,c.channelId].some((v:any)=>String(v??'').toLocaleLowerCase().includes(q.search!.toLocaleLowerCase()))));
   const ordered=rankedRows(found,sort);
   const start=(q.page-1)*q.limit;
   return {data:ordered.slice(start,start+q.limit),pagination:{page:q.page,limit:q.limit,total:found.length,pages:Math.ceil(found.length/q.limit)}};
 });res.json(result);
}));
publicRoutes.get('/rankings',handler(async(req,res)=>{
 const q=pageQuery.parse(req.query);
 const sort=q.sort??await defaultSort();
 const all=await getCreators();
 const found=all.filter(c=>!q.category||c.categories.some((p:any)=>p.slug===q.category));
 const sorted=rankedRows(found,sort).slice((q.page-1)*q.limit,q.page*q.limit);
 res.json({data:sorted,meta:{sort,scope:'curated monitored creators, not all Pakistani channels',total:found.length}});
}));
publicRoutes.get('/overview',handler(async(_req,res)=>{
 const data=await cached('overview',async()=>{
 const creators=await getCreators();const pub=await query('SELECT published_at,sync_run_id FROM publication_state WHERE id=true');
 return {creators:creators.length,channelsWithStatistics:creators.filter(c=>c.fetchedAt).length,
   sumChannelViews:sumCounts(creators,'viewCount'),sumChannelSubscribers:sumCounts(creators,'subscriberCount'),
   note:'Sums are of channel-reported totals; subscribers are rounded and not unique people.',
   publishedAt:pub.rows[0]?.published_at??null,syncRunId:pub.rows[0]?.sync_run_id??null};});res.json({data});
}));
publicRoutes.get('/creators/:slug',handler(async(req,res)=>{
 const slug=z.string().regex(/^[a-z0-9-]{2,100}$/).parse(req.params.slug);
 const data=await cached(`creator:${slug}`,async()=>{
   const rows=await getCreators();const c=rows.find(r=>r.slug===slug);
   if(!c)throw new HttpError(404,'NOT_FOUND','Creator not found');
   const details=await query('SELECT youtube_description AS "youtubeDescription",published_at AS "channelPublishedAt",uploads_playlist_id AS "uploadsPlaylistId" FROM channel_stats_latest WHERE creator_id=$1',[c.id]);
   return {...c,channelUrl:`https://www.youtube.com/channel/${c.channelId}`,source:'YouTube Data API v3',...details.rows[0]};
 });res.json({data});
}));
publicRoutes.get('/creators/:slug/summary',handler(async(req,res)=>{
 const slug=z.string().regex(/^[a-z0-9-]{2,100}$/).parse(req.params.slug);
 const data=await cached(`summary:${slug}`,async()=>{
   const creator=await query('SELECT id FROM creators WHERE slug=$1 AND enabled=true',[slug]);
   if(!creator.rows[0])throw new HttpError(404,'NOT_FOUND','Creator not found');
   const rows=(await query(`SELECT vs.view_count::text AS "viewCount",vs.like_count::text AS "likeCount",
     vs.comment_count::text AS "commentCount",v.published_at AS "publishedAt",vs.fetched_at AS "fetchedAt"
     FROM videos v LEFT JOIN video_stats_latest vs ON vs.video_id=v.video_id WHERE v.creator_id=$1`,[creator.rows[0].id])).rows;
   const metric=(field:'viewCount'|'likeCount'|'commentCount')=>{
     const values=rows.filter((r:any)=>r[field]!==null).map((r:any)=>BigInt(r[field]));
     const total=values.reduce((sum:bigint,v:bigint)=>sum+v,0n);
     return {availableSamples:values.length,total:values.length?total.toString():null,
       mean:roundedMean(total,values.length)};
   };
   return {videosSampled:rows.length,expectedMaxSample:config.SYNC_VIDEOS_PER_CHANNEL,
     views:metric('viewCount'),likes:metric('likeCount'),comments:metric('commentCount'),
     latestUploadedAt:rows.reduce((max:string|null,r:any)=>r.publishedAt&&(!max||new Date(r.publishedAt)>new Date(max))?r.publishedAt:max,null),
     statsFetchedAt:rows.reduce((max:string|null,r:any)=>r.fetchedAt&&(!max||new Date(r.fetchedAt)>new Date(max))?r.fetchedAt:max,null),
     source:'YouTube Data API v3',disclosure:'Calculated only from the latest retrievable video sample; not lifetime channel totals or independent audience sentiment.'};
 });res.json({data});
}));
publicRoutes.get('/creators/:slug/videos',handler(async(req,res)=>{
 const slug=z.string().regex(/^[a-z0-9-]{2,100}$/).parse(req.params.slug);
 const limit=z.coerce.number().int().min(1).max(50).default(25).parse(req.query.limit??25);
 const order=z.enum(['recent','views']).default('recent').parse(req.query.order??'recent');
 const result=await cached(`videos:${slug}:${limit}:${order}`,async()=>{
   const creator=await query('SELECT id FROM creators WHERE slug=$1 AND enabled=true',[slug]);
   if(!creator.rows[0])throw new HttpError(404,'NOT_FOUND','Creator not found');
   const sort=order==='views'?'vs.view_count DESC NULLS LAST,v.video_id':'v.published_at DESC NULLS LAST,v.video_id';
   const rows=await query(`SELECT v.video_id AS "videoId",v.title,v.description,v.published_at AS "publishedAt",v.thumbnail_url AS "thumbnailUrl",
     v.duration_iso AS "durationIso",vs.view_count::text AS "viewCount",vs.like_count::text AS "likeCount",
     vs.comment_count::text AS "commentCount",vs.fetched_at AS "fetchedAt"
     FROM videos v LEFT JOIN video_stats_latest vs ON vs.video_id=v.video_id WHERE v.creator_id=$1 AND v.display_on_site=true ORDER BY ${sort} LIMIT $2`,[creator.rows[0].id,limit]);
   return {data:rows.rows,meta:{sample:'Latest 50 retrievable public uploads per tracked channel',sort:order}};
 });res.json(result);
}));
publicRoutes.get('/status',handler(async(_req,res)=>{
 const r=await query('SELECT published_at,sync_run_id FROM publication_state WHERE id=true');
 const configRows=await query("SELECT key,value FROM app_settings WHERE key IN ('sync_schedule_enabled','sync_schedule_time')");
 const settings=Object.fromEntries(configRows.rows.map((x:any)=>[x.key,x.value]));
 res.json({data:{publishedAt:r.rows[0]?.published_at??null,syncRunId:r.rows[0]?.sync_run_id??null,schedule:{enabled:settings.sync_schedule_enabled??true,time:settings.sync_schedule_time??'09:00',timezone:'Asia/Karachi'},source:'YouTube Data API v3'}});
}));
