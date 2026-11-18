import {Router} from 'express';
import {z} from 'zod';
import {query,transaction} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {roles,requireAdmin,audit,type AdminIdentity} from '../auth/auth.js';
import {bustPublicCache} from '../../lib/redis.js';
import {rankInstagram,type InstagramRankingRecord} from './ranking.mjs';
import {syncInstagramProfiles} from './service.js';

export const instagramPublicRoutes=Router();
export const instagramAdminRoutes=Router();
instagramAdminRoutes.use(requireAdmin);
const uuid=z.string().uuid();
const username=z.string().trim().toLowerCase().regex(/^[a-z0-9._]{1,30}$/);
const schema=z.object({
 username,youtubeCreatorId:uuid.nullable().default(null),displayName:z.string().trim().min(2).max(150),
 slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(100),
 biography:z.string().max(3000).default(''),categoryIds:z.array(uuid).max(7).default([]),
 enabled:z.boolean().default(true)
}).strict();
const bulkSchema=z.array(schema).min(1).max(100);
const page=z.object({
 page:z.coerce.number().int().min(1).default(1),
 limit:z.coerce.number().int().min(1).max(100).default(25),
 sort:z.enum(['followers','posts']).default('followers'),
 category:z.string().trim().optional()
});
const rowsQuery=`SELECT c.id,c.username,c.display_name AS "displayName",c.slug,c.biography,c.eligibility,c.enabled,
 s.followers_count::text AS "followersCount",s.media_count::text AS "mediaCount",s.fetched_at AS "fetchedAt",
 COALESCE(json_agg(json_build_object('id',cat.id,'slug',cat.slug,'label',cat.label)) FILTER(WHERE cat.id IS NOT NULL),'[]'::json) AS categories
 FROM instagram_creators c LEFT JOIN instagram_stats_latest s ON s.creator_id=c.id
 LEFT JOIN instagram_creator_categories cc ON cc.creator_id=c.id
 LEFT JOIN categories cat ON cat.id=cc.category_id AND cat.active=true`;
async function listCreators(onlyPublic:boolean){
 const r=await query(`${rowsQuery} ${onlyPublic?"WHERE c.enabled=true AND c.eligibility='approved'":''}
 GROUP BY c.id,s.creator_id ORDER BY c.created_at DESC`);
 return r.rows;
}
instagramPublicRoutes.get('/instagram/rankings',handler(async(req,res)=>{
 const opts=page.parse(req.query);
 const all=await listCreators(true);
 const relevant=opts.category?all.filter(c=>c.categories.some((x:any)=>x.slug===opts.category)):all;
 const ranked=rankInstagram(relevant as InstagramRankingRecord[],opts.sort);
 res.json({data:ranked.slice((opts.page-1)*opts.limit,opts.page*opts.limit),
 meta:{platform:'instagram',metric:opts.sort,total:ranked.length,scope:'approved individual human professional Instagram creators',
 method:'Descending raw Meta Business Discovery count; ties share dense ranks',asOf:ranked.reduce<string|null>((max,c)=>c.fetchedAt&&(!max||c.fetchedAt>max)?c.fetchedAt:max,null),
 coverage:{known:ranked.filter(x=>x[opts.sort==='followers'?'followersCount':'mediaCount']!=null).length,total:ranked.length},
 page:opts.page,limit:opts.limit}});
}));
instagramAdminRoutes.get('/instagram/creators',roles('owner','editor'),handler(async(_req,res)=>{
 const r=await query(`SELECT c.*,COALESCE(array_agg(cc.category_id) FILTER(WHERE cc.category_id IS NOT NULL),ARRAY[]::uuid[]) AS category_ids,
 s.followers_count::text AS followers_count,s.media_count::text AS media_count,s.fetched_at,s.error_code
 FROM instagram_creators c LEFT JOIN instagram_creator_categories cc ON cc.creator_id=c.id
 LEFT JOIN instagram_stats_latest s ON s.creator_id=c.id
 GROUP BY c.id,s.creator_id ORDER BY c.created_at DESC LIMIT 500`);
 res.json({data:r.rows});
}));
async function insertBatch(records:z.infer<typeof schema>[],res:any){
 if(new Set(records.map(x=>x.username)).size!==records.length||new Set(records.map(x=>x.slug)).size!==records.length)throw new HttpError(400,'DUPLICATE_IN_BATCH','Duplicate usernames or slugs');
 try{
 const result=await transaction(async tx=>{
  for(const c of records){
   const found=await tx.query(`INSERT INTO instagram_creators(username,display_name,slug,biography,enabled,youtube_creator_id)
   VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,[c.username,c.displayName,c.slug,c.biography,c.enabled,c.youtubeCreatorId]);
   for(const categoryId of c.categoryIds)await tx.query('INSERT INTO instagram_creator_categories(creator_id,category_id) VALUES($1,$2)',[found.rows[0].id,categoryId]);
  }
  return records.length;
 });
 await audit((res.locals.admin as AdminIdentity).id,'instagram.creators.import',null,{count:result});
 await bustPublicCache();
 return result;
 }catch(e:any){
 if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Instagram username or slug already registered');
 if(e.code==='23503')throw new HttpError(400,'INVALID_REFERENCE','YouTube creator or category does not exist');
 throw e;
 }
}
instagramAdminRoutes.post('/instagram/creators',roles('owner','editor'),handler(async(req,res)=>{
 const count=await insertBatch([schema.parse(req.body)],res);res.status(201).json({data:{created:count,status:'pending_review'}});
}));
instagramAdminRoutes.post('/instagram/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{
 const input=bulkSchema.parse(req.body?.creators);
 const count=await insertBatch(input,res);res.status(201).json({data:{created:count,status:'pending_review'}});
}));
instagramAdminRoutes.patch('/instagram/creators/:id',roles('owner','editor'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id),b=schema.partial().parse(req.body);
 if(!Object.keys(b).length)throw new HttpError(400,'EMPTY_PATCH','No changes submitted');
 try{
 await transaction(async tx=>{
 const found=await tx.query('SELECT id FROM instagram_creators WHERE id=$1 FOR UPDATE',[id]);
 if(!found.rowCount)throw new HttpError(404,'NOT_FOUND','Instagram creator not found');
 await tx.query(`UPDATE instagram_creators SET username=COALESCE($2,username),display_name=COALESCE($3,display_name),
 slug=COALESCE($4,slug),biography=COALESCE($5,biography),enabled=COALESCE($6,enabled),youtube_creator_id=COALESCE($7,youtube_creator_id),
 eligibility=CASE WHEN $2 IS NOT NULL OR $7 IS NOT NULL THEN 'pending' ELSE eligibility END,
 human_attested=CASE WHEN $2 IS NOT NULL OR $7 IS NOT NULL THEN false ELSE human_attested END,
 reviewed_by=CASE WHEN $2 IS NOT NULL OR $7 IS NOT NULL THEN NULL ELSE reviewed_by END,
 reviewed_at=CASE WHEN $2 IS NOT NULL OR $7 IS NOT NULL THEN NULL ELSE reviewed_at END,
 updated_at=now() WHERE id=$1`,
 [id,b.username??null,b.displayName??null,b.slug??null,b.biography??null,b.enabled??null,b.youtubeCreatorId??null]);
 if(b.categoryIds){
 await tx.query('DELETE FROM instagram_creator_categories WHERE creator_id=$1',[id]);
 for(const cid of b.categoryIds)await tx.query('INSERT INTO instagram_creator_categories(creator_id,category_id) VALUES($1,$2)',[id,cid]);
 }
 });await audit((res.locals.admin as AdminIdentity).id,'instagram.creator.update',id,{fields:Object.keys(b)});
 await bustPublicCache();res.json({data:{updated:true}});
 }catch(e:any){if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Username or slug exists');if(e.code==='23503')throw new HttpError(400,'INVALID_CATEGORY','Unknown category');throw e;}
}));
instagramAdminRoutes.post('/instagram/creators/:id/review',roles('owner','editor'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);
 const b=z.object({decision:z.enum(['approved','rejected']),humanAttested:z.boolean(),note:z.string().max(300).optional()}).parse(req.body);
 if(b.decision==='approved'&&!b.humanAttested)throw new HttpError(400,'HUMAN_REQUIRED','Confirm this profile represents a real individual human creator, not a brand, company, collective or generic channel');
 if(b.decision==='approved'){
  const linked=await query('SELECT c.id FROM instagram_creators i JOIN creators c ON c.id=i.youtube_creator_id WHERE i.id=$1',[id]);
  if(!linked.rowCount)throw new HttpError(400,'YOUTUBER_LINK_REQUIRED','Link the Instagram profile to a verified YouTube creator in PCI before approving');
 }
 const reviewer=(res.locals.admin as AdminIdentity).id;
 const r=await query(`UPDATE instagram_creators SET eligibility=$2,human_attested=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now()
 WHERE id=$1 RETURNING id`,[id,b.decision,b.decision==='approved'&&b.humanAttested,reviewer]);
 if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Creator not found');
 await audit(reviewer,'instagram.creator.review',id,{decision:b.decision,note:b.note??''});
 await bustPublicCache();res.json({data:{eligibility:b.decision}});
}));
let busy=false;
instagramAdminRoutes.post('/instagram/sync',roles('owner','editor'),handler(async(_req,res)=>{
 if(busy)throw new HttpError(409,'SYNC_IN_PROGRESS','Instagram sync already running');
 busy=true;
 try{const results=await syncInstagramProfiles();await audit((res.locals.admin as AdminIdentity).id,'instagram.sync',null,results);await bustPublicCache();res.json({data:results});}
 finally{busy=false;}
}));
