import {Router} from 'express';
import {z} from 'zod';
import {query,transaction} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {roles,requireAdmin,audit,type AdminIdentity} from '../auth/auth.js';
import {bustPublicCache} from '../../lib/redis.js';
import {rankCrossPlatform} from './score.mjs';
export const crossPublicRoutes=Router();
export const crossAdminRoutes=Router();crossAdminRoutes.use(requireAdmin);
async function candidates(){
 const r=await query(`SELECT i.id AS "instagramCreatorId",i.youtube_creator_id AS "youtubeCreatorId",i.username,
 i.display_name AS "instagramName",i.eligibility,i.enabled,i.cross_platform_curated AS curated,
 s.followers_count::text AS "followersCount",s.media_count::text AS "mediaCount",s.fetched_at AS "instagramFetchedAt",
 y.slug AS "youtubeSlug",y.display_name AS "displayName",y.channel_id AS "channelId",ys.thumbnail_url AS "thumbnailUrl",
 ys.subscriber_count::text AS "subscriberCount",ys.view_count::text AS "viewCount",ys.fetched_at AS "youtubeFetchedAt"
 FROM instagram_creators i
 JOIN creators y ON y.id=i.youtube_creator_id AND y.enabled=true
 LEFT JOIN instagram_stats_latest s ON s.creator_id=i.id
 LEFT JOIN channel_stats_latest ys ON ys.creator_id=y.id
 ORDER BY i.created_at DESC`);
 return r.rows;
}
const disclosure='Experimental normalized rank fusion of 3 official reported counts within the eligible matched curated cohort; not an influence or audience-quality measurement.';
function output(rows:any[],limit=10){const ranked=rankCrossPlatform(rows,{limit});return {data:ranked,meta:{limit,cohortSize:rankCrossPlatform(rows,{limit:100}).length,method:'Equal platform-weight normalized Borda ranks: YouTube 50% (subscribers 25%, lifetime views 25%), Instagram followers 50%. Competition ranks, exact score ties.',disclosure,tieRule:'A shared rank is represented by one card containing all tied creators; rank 1 shares a split crown.'}};}
crossPublicRoutes.get('/cross-platform/top',handler(async(_req,res)=>{
 if(process.env.CROSS_PLATFORM_PUBLIC_ENABLED!=='true')return res.status(403).json({error:{code:'RESEARCH_ONLY',message:'Unified cross-platform ranking is not authorized for public display'}});
 res.json(output(await candidates()));
}));
crossAdminRoutes.get('/cross-platform/preview',roles('owner','editor'),handler(async(_req,res)=>res.json(output(await candidates()))));
crossAdminRoutes.get('/cross-platform/candidates',roles('owner','editor'),handler(async(_req,res)=>res.json({data:await candidates()})));
crossAdminRoutes.patch('/cross-platform/candidates/:id',roles('owner','editor'),handler(async(req,res)=>{
 const id=z.string().uuid().parse(req.params.id);
 const {curated}=z.object({curated:z.boolean()}).strict().parse(req.body);
 await transaction(async tx=>{
  // Serialize curator changes to enforce the 20-human cap even under concurrent requests.
  await tx.query('SELECT pg_advisory_xact_lock(82931741)');
  const r=await tx.query('SELECT id,eligibility,enabled,youtube_creator_id FROM instagram_creators WHERE id=$1 FOR UPDATE',[id]);
  if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Instagram creator not found');
  const c=r.rows[0];
  if(curated&&(!c.enabled||c.eligibility!=='approved'||!c.youtube_creator_id))throw new HttpError(400,'NOT_ELIGIBLE','Only approved and YouTube-linked humans can be curated');
  const count=await tx.query('SELECT count(*)::int AS n FROM instagram_creators WHERE cross_platform_curated=true AND id<>$1',[id]);
  if(curated&&count.rows[0].n>=20)throw new HttpError(409,'CURATION_FULL','Maximum 20 curated Instagram/YouTube matched humans');
  await tx.query('UPDATE instagram_creators SET cross_platform_curated=$2,updated_at=now() WHERE id=$1',[id,curated]);
 });
 await audit((res.locals.admin as AdminIdentity).id,'cross-platform.curated',id,{curated});await bustPublicCache();
 res.json({data:{id,curated}});
}));
