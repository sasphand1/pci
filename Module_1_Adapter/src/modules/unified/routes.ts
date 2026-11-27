import {Router} from 'express';
import {z} from 'zod';
import {query,transaction} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {requireAdmin,roles,audit,type AdminIdentity} from '../auth/auth.js';
import {bustPublicCache} from '../../lib/redis.js';
import {rankPeople,rankAllRounders,aggregate} from './metrics.mjs';
import {summarize} from '../engine/status.mjs';
import {config} from '../../lib/config.js';

export const unifiedPublicRoutes=Router();
export const unifiedAdminRoutes=Router();
unifiedAdminRoutes.use(requireAdmin);
const params=z.object({metric:z.enum(['views','subscribers','videos']).default('subscribers'),
 platform:z.enum(['all','youtube','instagram']).default('all'),
 limit:z.coerce.number().int().min(1).max(100).default(100),
 category:z.string().regex(/^[a-z0-9-]{2,60}$/).optional()});
const review=z.object({decision:z.enum(['approved','rejected','pending']),
 humanConfirmed:z.boolean().default(false)}).strict();

/** One authoritative person = one YouTube creator record. A matching approved
 * Instagram professional account adds stats/links but never creates a duplicate row.
 * Linked Instagram categories are unioned to preserve existing editor assignments.
 * Existing YouTube data stays available in the legacy endpoints unchanged.
 */
// PCI_UNIFIED_ISOLATED_QUERIES_V2: one stable YouTube registry query, optional IG read.
// No IG migration should be able to take down the YouTube/combined ranking API.
async function listPeople(){
 const base=await query(`SELECT c.id,c.slug,c.display_name AS "displayName",c.enabled,
   c.human_review_status AS "humanReviewStatus",c.channel_id AS "channelId",
   ys.thumbnail_url AS "thumbnailUrl",ys.subscriber_count::text AS "ytSubscribers",
   ys.view_count::text AS "ytViews",ys.video_count::text AS "ytVideos",ys.fetched_at AS "ytFetchedAt"
   FROM creators c LEFT JOIN channel_stats_latest ys ON ys.creator_id=c.id
   WHERE c.enabled=true ORDER BY c.id`);
 const ids=base.rows.map((r:any)=>r.id);
 if(!ids.length)return [];
 const categories=await query(`SELECT cc.creator_id AS "creatorId",ca.slug,ca.label
   FROM creator_categories cc JOIN categories ca ON ca.id=cc.category_id
   WHERE cc.creator_id=ANY($1::uuid[]) AND ca.active=true ORDER BY ca.slug`,[ids]);
 const categoryMap=new Map<string,{slug:string;label:string}[]>();
 for(const c of categories.rows){const xs=categoryMap.get(c.creatorId)??[];xs.push({slug:c.slug,label:c.label});categoryMap.set(c.creatorId,xs);}
 const people=base.rows.map((r:any)=>({id:r.id,slug:r.slug,displayName:r.displayName,enabled:r.enabled,
   humanReviewStatus:r.humanReviewStatus,thumbnailUrl:r.thumbnailUrl,
   categories:categoryMap.get(r.id)??[],
   youtube:{url:`https://www.youtube.com/channel/${encodeURIComponent(r.channelId)}`,subscribers:r.ytSubscribers,views:r.ytViews,videos:r.ytVideos,fetchedAt:r.ytFetchedAt},
   instagram:null as null|{url:string;username:string;followers:string|null;posts:string|null;fetchedAt:string|null}}));
 const byId=new Map(people.map(p=>[p.id,p]));
 try{
   const ig=await query(`SELECT i.id AS "instagramId",i.youtube_creator_id AS "creatorId",i.username,
     st.followers_count::text AS "followers",st.media_count::text AS "posts",st.fetched_at AS "fetchedAt"
     FROM instagram_creators i LEFT JOIN instagram_stats_latest st ON st.creator_id=i.id
     WHERE i.enabled=true AND i.eligibility='approved' AND i.youtube_creator_id=ANY($1::uuid[])
     ORDER BY i.youtube_creator_id,i.id`,[ids]);
   const igIds:string[]=[];const selected=new Set<string>();
   for(const r of ig.rows){
     const p=byId.get(r.creatorId);if(!p||selected.has(r.creatorId))continue;
     selected.add(r.creatorId);igIds.push(r.instagramId);
     p.instagram={url:`https://www.instagram.com/${encodeURIComponent(r.username)}/`,username:r.username,followers:r.followers,posts:r.posts,fetchedAt:r.fetchedAt};
   }
   if(igIds.length){
     const linked=await query(`SELECT i.youtube_creator_id AS "creatorId",ca.slug,ca.label
       FROM instagram_creator_categories ic JOIN instagram_creators i ON i.id=ic.creator_id
       JOIN categories ca ON ca.id=ic.category_id
       WHERE ic.creator_id=ANY($1::uuid[]) AND ca.active=true`,[igIds]);
     for(const c of linked.rows){const p=byId.get(c.creatorId);if(p&&!p.categories.some(x=>x.slug===c.slug))p.categories.push({slug:c.slug,label:c.label});}
   }
 }catch(err){
   // Only optional IG schema mismatches degrade gracefully. All other DB errors propagate.
   const code=(err as {code?:string}).code;
   if(code!=='42P01'&&code!=='42703')throw err;
   console.error('[PCI_IG_SCHEMA_UNAVAILABLE] Unified YouTube rankings served without Instagram; complete Instagram migration',code);
 }
 return people;
}
const disclosure={audience:'Summed account follower/subscriber counts; NOT unique people. The same individual may follow a creator on multiple platforms.',
 views:'YouTube lifetime channel views only. Instagram does not provide an equivalent account-wide total through the current connector.',
 activity:'Lifetime reported YouTube video count plus Instagram media count, NOT uploads per week or posting frequency.',
 eligibility:'Only curator-confirmed individual human YouTubers are eligible; company and generic channel records remain excluded.'};
async function rankings(q:z.infer<typeof params>){
 const all=await listPeople();const r=rankPeople(all,q);
 return {data:r.data,meta:{platform:q.platform,metric:q.metric,total:r.total,known:r.known,
 limit:q.limit,disclosure,rankingMethod:'Descending source-reported counts, BigInt-safe, dense ties; unavailable values unranked.',
 platformCoverage:{youtube:true,instagram:true}}};
}
// PCI_ALL_ROUNDERS_ROUTE_V1: no silent fallback.
unifiedPublicRoutes.get('/unified/all-rounders',handler(async(req,res)=>{
 const q=z.object({limit:z.coerce.number().int().min(1).max(100).default(20),category:z.string().regex(/^[a-z0-9-]{2,60}$/).optional()}).parse(req.query);
 res.json(rankAllRounders(await listPeople(),q));
}));
unifiedPublicRoutes.get('/unified/rankings',handler(async(req,res)=>res.json(await rankings(params.parse(req.query)))));
unifiedPublicRoutes.get('/unified/overview',handler(async(req,res)=>{
 const platform=z.enum(['all','youtube','instagram']).default('all').parse(req.query.platform);
 res.json({data:{...aggregate(await listPeople(),platform),platform,disclosure}});
}));
unifiedAdminRoutes.get('/unified/creators',roles('owner','editor'),handler(async(_req,res)=>{
 const r=await query(`SELECT c.id,c.display_name AS "displayName",c.channel_id AS "channelId",c.human_review_status AS "humanReviewStatus",
 c.human_reviewed_at AS "humanReviewedAt",c.enabled,
 COALESCE(array_agg(cc.category_id) FILTER(WHERE cc.category_id IS NOT NULL),ARRAY[]::uuid[]) AS "categoryIds"
 FROM creators c LEFT JOIN creator_categories cc ON cc.creator_id=c.id
 GROUP BY c.id ORDER BY c.display_name LIMIT 2000`);
 res.json({data:r.rows});
}));
unifiedAdminRoutes.patch('/unified/creators/:id/review',roles('owner','editor'),handler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id);
 const body=review.parse(req.body);
 if(body.decision==='approved'&&!body.humanConfirmed)
   throw new HttpError(400,'HUMAN_CONFIRMATION_REQUIRED','Explicitly verify that this is an individual human creator, not a brand, company, team or generic channel.');
 const actor=(res.locals.admin as AdminIdentity).id;
 const r=await query(`UPDATE creators SET human_review_status=$2,human_reviewed_at=now(),human_reviewed_by=$3,updated_at=now()
 WHERE id=$1 RETURNING id`,[id,body.decision,actor]);
 if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Creator not found');
 await audit(actor,'unified.human_review',id,{decision:body.decision});
 await bustPublicCache();res.json({data:{id,status:body.decision}});
}));

// PCI_UPDATE_1_BULK_REVIEW: a human administrator reviews a selected set and confirms explicitly.
// Never runs automatically; approval still requires humanConfirmed=true and a matching count.
const bulkReview=z.object({ids:z.array(z.string().uuid()).min(1).max(250),decision:z.enum(['approved','rejected','pending']),
 humanConfirmed:z.boolean().default(false),expectedCount:z.number().int().min(1).max(250)}).strict();
unifiedAdminRoutes.post('/unified/creators/bulk-review',roles('owner','editor'),handler(async(req,res)=>{
 const body=bulkReview.parse(req.body);
 const ids=[...new Set(body.ids)];
 if(ids.length!==body.expectedCount)throw new HttpError(409,'SELECTION_CHANGED','Selection changed. Reload and select again.');
 if(body.decision==='approved'&&!body.humanConfirmed)
   throw new HttpError(400,'HUMAN_CONFIRMATION_REQUIRED','Explicitly verify that every selected creator is an individual human, not a brand, company, team or generic channel.');
 const actor=(res.locals.admin as AdminIdentity).id;
 const updated=await transaction(async tx=>{
   const r=await tx.query(`UPDATE creators SET human_review_status=$2,human_reviewed_at=now(),human_reviewed_by=$3,updated_at=now()
     WHERE id=ANY($1::uuid[]) RETURNING id`,[ids,body.decision,actor]);
   await tx.query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',
     [actor,'unified.human_review_bulk',null,JSON.stringify({decision:body.decision,selected:ids.length,updated:r.rowCount??0})]);
   return r.rowCount??0;
 });
 await bustPublicCache();
 res.json({data:{decision:body.decision,selected:ids.length,updated}});
}));

// PCI_UPDATE_1_ENGINE_STATUS: read-only diagnostics. Explains why each enabled creator is or is
// not eligible for the subscriber rankings, and whether the sync worker is actually alive.
async function optional<T>(work:()=>Promise<T>,fallback:T):Promise<T>{
 try{return await work();}catch(err){
   const code=(err as {code?:string}).code;
   if(code==='42P01'||code==='42703')return fallback;
   throw err;
 }
}
unifiedAdminRoutes.get('/engine/status',roles('owner','editor'),handler(async(_req,res)=>{
 const base=await query(`SELECT c.id,c.display_name AS "displayName",c.channel_id AS "channelId",c.enabled,
   c.human_review_status AS "humanReviewStatus",s.subscriber_count::text AS "subscriberCount",
   s.subscriber_hidden AS "subscriberHidden",s.fetched_at AS "fetchedAt"
   FROM creators c LEFT JOIN channel_stats_latest s ON s.creator_id=c.id WHERE c.enabled=true ORDER BY c.display_name LIMIT 2000`);
 const outcomes=await optional(async()=>(await query(`SELECT DISTINCT ON (creator_id) creator_id AS "creatorId",outcome,detail,created_at AS "at"
   FROM sync_account_results WHERE platform='youtube' ORDER BY creator_id,created_at DESC`)).rows as Array<{creatorId:string;outcome:string;detail:string|null;at:string}>,[]);
 const lastOutcome=new Map(outcomes.map(o=>[o.creatorId,o]));
 const summary=summarize(base.rows.map((r:any)=>({...r,lastOutcome:lastOutcome.get(r.id)?.outcome??null,lastDetail:lastOutcome.get(r.id)?.detail??null})),{maxAgeHours:36});
 const workers=await optional(async()=>(await query(`SELECT worker_id AS "workerId",kind,last_seen_at AS "lastSeenAt",detail,
   (last_seen_at>now()-interval '90 seconds') AS alive FROM worker_heartbeats ORDER BY last_seen_at DESC LIMIT 5`)).rows,[] as any[]);
 const runs=(await query('SELECT status,created_at AS "createdAt",started_at AS "startedAt",finished_at AS "finishedAt",channel_count AS "channelCount",error_code AS "errorCode",error_message AS "errorMessage" FROM sync_runs ORDER BY created_at DESC LIMIT 5')).rows;
 const published=(await query('SELECT published_at AS "publishedAt" FROM publication_state WHERE id=true')).rows[0]?.publishedAt??null;
 res.json({data:{
   summary:{total:summary.total,eligible:summary.eligible,ineligible:summary.ineligible,byReason:summary.byReason,byPrimaryReason:summary.byPrimaryReason},
   creators:summary.creators.map(c=>({id:c.id,reasons:c.reasons,lastOutcome:c.lastOutcome,lastDetail:c.lastDetail})),
   worker:{anyAlive:workers.some((w:any)=>w.alive),heartbeats:workers,apiSyncEnabled:config.YOUTUBE_SYNC_ENABLED==='true',youtubeKeyConfigured:!!config.YOUTUBE_API_KEY,embeddedScheduler:config.RUN_WORKER_IN_API==='true'},
   recentRuns:runs,publishedAt:published,
   note:'Eligibility reasons describe the subscriber-based rankings. A creator can have several reasons at once.'
 }});
}));
