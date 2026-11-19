import {Router} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {requireAdmin,roles,audit,type AdminIdentity} from '../auth/auth.js';
import {bustPublicCache} from '../../lib/redis.js';
import {rankPeople,rankAllRounders,aggregate} from './metrics.mjs';

export const unifiedPublicRoutes=Router();
export const unifiedAdminRoutes=Router();
unifiedAdminRoutes.use(requireAdmin);
const params=z.object({metric:z.enum(['views','subscribers','videos']).default('subscribers'),
 platform:z.enum(['all','youtube','instagram','tiktok']).default('all'),
 limit:z.coerce.number().int().min(1).max(100).default(100),
 category:z.string().regex(/^[a-z0-9-]{2,60}$/).optional()});
const review=z.object({decision:z.enum(['approved','rejected','pending']),
 humanConfirmed:z.boolean().default(false)}).strict();

/** One authoritative person = one YouTube creator record. A matching approved
 * Instagram professional account adds stats/links but never creates a duplicate row.
 * Linked Instagram categories are unioned to preserve existing editor assignments.
 * Existing YouTube data stays available in the legacy endpoints unchanged.
 */
async function listPeople(){
 const result=await query(`SELECT c.id,c.slug,c.display_name AS "displayName",c.enabled,
 c.human_review_status AS "humanReviewStatus", ys.thumbnail_url AS "thumbnailUrl",
 ys.subscriber_count::text AS "ytSubscribers",ys.view_count::text AS "ytViews",
 ys.video_count::text AS "ytVideos",ys.fetched_at AS "ytFetchedAt",c.channel_id AS "channelId",
 ig.id AS "instagramCreatorId",ig.username AS "instagramUsername",
 st.followers_count::text AS "igFollowers",st.media_count::text AS "igPosts",st.fetched_at AS "igFetchedAt",
 COALESCE((SELECT json_agg(DISTINCT jsonb_build_object('slug',ca.slug,'label',ca.label)) ORDER BY jsonb_build_object('slug',ca.slug,'label',ca.label))
    FROM categories ca WHERE ca.active=true AND (
      EXISTS(SELECT 1 FROM creator_categories cc WHERE cc.creator_id=c.id AND cc.category_id=ca.id) OR
      EXISTS(SELECT 1 FROM instagram_creator_categories ic WHERE ic.creator_id=ig.id AND ic.category_id=ca.id)
    )), '[]'::json) AS categories
 FROM creators c LEFT JOIN channel_stats_latest ys ON ys.creator_id=c.id
 LEFT JOIN LATERAL (SELECT i.id,i.username FROM instagram_creators i
   WHERE i.youtube_creator_id=c.id AND i.enabled=true AND i.eligibility='approved'
   ORDER BY i.reviewed_at DESC NULLS LAST,i.id LIMIT 1) ig ON true
 LEFT JOIN instagram_stats_latest st ON st.creator_id=ig.id
 WHERE c.enabled=true ORDER BY c.id`);
 return result.rows.map((r:any)=>({id:r.id,slug:r.slug,displayName:r.displayName,
 humanReviewStatus:r.humanReviewStatus,enabled:r.enabled,thumbnailUrl:r.thumbnailUrl,
 categories:r.categories??[],
 youtube:{url:`https://www.youtube.com/channel/${encodeURIComponent(r.channelId)}`,
 subscribers:r.ytSubscribers,views:r.ytViews,videos:r.ytVideos,fetchedAt:r.ytFetchedAt},
 instagram:r.instagramCreatorId?{url:`https://www.instagram.com/${encodeURIComponent(r.instagramUsername)}/`,
 username:r.instagramUsername,followers:r.igFollowers,posts:r.igPosts,fetchedAt:r.igFetchedAt}:null}));
}
const disclosure={audience:'Summed account follower/subscriber counts; NOT unique people. The same individual may follow a creator on multiple platforms.',
 views:'YouTube lifetime channel views only. Instagram does not provide an equivalent account-wide total through the current connector.',
 activity:'Lifetime reported YouTube video count plus Instagram media count, NOT uploads per week or posting frequency.',
 tiktok:'TikTok integration is not activated. It is a UI and schema placeholder only.',
 eligibility:'Only curator-confirmed individual human YouTubers are eligible; company and generic channel records remain excluded.'};
async function rankings(q:z.infer<typeof params>){
 const all=await listPeople();const r=rankPeople(all,q);
 return {data:r.data,meta:{platform:q.platform,metric:q.metric,total:r.total,known:r.known,
 limit:q.limit,disclosure,rankingMethod:'Descending source-reported counts, BigInt-safe, dense ties; unavailable values unranked.',
 platformCoverage:{youtube:true,instagram:true,tiktok:false}}};
}
// PCI_ALL_ROUNDERS_ROUTE_V1: no fake TikTok data or silent fallback.
unifiedPublicRoutes.get('/unified/all-rounders',handler(async(req,res)=>{
 const q=z.object({limit:z.coerce.number().int().min(1).max(100).default(20),category:z.string().regex(/^[a-z0-9-]{2,60}$/).optional()}).parse(req.query);
 res.json(rankAllRounders(await listPeople(),q));
}));
unifiedPublicRoutes.get('/unified/rankings',handler(async(req,res)=>res.json(await rankings(params.parse(req.query)))));
unifiedPublicRoutes.get('/unified/overview',handler(async(req,res)=>{
 const platform=z.enum(['all','youtube','instagram','tiktok']).default('all').parse(req.query.platform);
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
