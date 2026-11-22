import { Router } from 'express';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { query,transaction } from '../../lib/db.js';
import { config } from '../../lib/config.js';
import { redis,bustPublicCache } from '../../lib/redis.js';
import { handler,HttpError } from '../../lib/errors.js';
import { roles,requireAdmin,audit,type AdminIdentity } from '../auth/auth.js';
import { YoutubeClient,chunks } from '../youtube/client.js';
import { enqueueSync } from '../sync/service.js';
import { emitWall } from '../wall/service.js';
import { hashPassword,newTotpSecret,encryptSecret,authTotpUri } from '../../lib/security.js';
import { rankedRows,metricCoverage } from '../ranking/rank.mjs';

export const adminRoutes=Router();
adminRoutes.use(requireAdmin);
const safeSlug=z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(100);
const uuid=z.string().uuid();
const catIds=z.array(uuid).max(7).default([]);
const channelId=z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
const creator=z.object({channelId,slug:safeSlug,displayName:z.string().trim().min(1).max(150),description:z.string().max(5000).default(''),featured:z.boolean().default(false),enabled:z.boolean().default(true),categoryIds:catIds});
const categorySchema=z.object({slug:safeSlug,label:z.string().trim().min(2).max(100),description:z.string().max(1000).default(''),displayOrder:z.number().int().min(0).max(999).default(0),active:z.boolean().default(true)});
const auditAs=(res:any,action:string,subject:string|null,metadata:object={})=>audit((res.locals.admin as AdminIdentity).id,action,subject,metadata);
const adminId=(res:any)=>(res.locals.admin as AdminIdentity).id;

adminRoutes.get('/dashboard',handler(async(_req,res)=>{
 const [creators,stats,videos,jobs,reports,admins,wall]=await Promise.all([
 query('SELECT count(*)::int AS total,count(*) FILTER(WHERE enabled)::int AS enabled FROM creators'),
 query('SELECT count(*)::int AS total,max(fetched_at) AS newest FROM channel_stats_latest'),
 query('SELECT count(*)::int AS total FROM videos'),
 query('SELECT status,created_at,started_at,finished_at,quota_used,channel_count,video_count,error_code FROM sync_runs ORDER BY created_at DESC LIMIT 5'),
 query("SELECT count(*)::int AS total FROM wall_reports WHERE status='pending'"),
 query('SELECT count(*)::int AS total FROM admin_users WHERE active=true'),
 query("SELECT count(*)::int AS total FROM wall_messages WHERE deleted_at IS NULL AND created_at>now()-interval '24 hours'")
 ]);
 res.json({data:{creators:creators.rows[0],statistics:stats.rows[0],videos:videos.rows[0],recentSyncRuns:jobs.rows,
 pendingReports:reports.rows[0].total,activeAdmins:admins.rows[0].total,wallMessages24h:wall.rows[0].total}});
}));

adminRoutes.post('/creators/validate',roles('owner','editor'),handler(async(req,res)=>{
 const id=channelId.parse(req.body?.channelId);
 if(!config.YOUTUBE_API_KEY)throw new HttpError(503,'YOUTUBE_UNCONFIGURED','Configure YouTube API key');
 const yt=new YoutubeClient(),result=await yt.channels([id]);
 if(!result[0])throw new HttpError(404,'CHANNEL_NOT_FOUND','Channel unavailable through YouTube API');
 res.json({data:{channelId:result[0].id,title:result[0].snippet?.title??null,thumbnail:result[0].snippet?.thumbnails?.default?.url??null}});
}));
adminRoutes.get('/creators',roles('owner','editor'),handler(async(req,res)=>{
 const q=z.object({limit:z.coerce.number().int().min(1).max(250).default(100),offset:z.coerce.number().int().min(0).default(0)}).parse(req.query);
 const r=await query(`SELECT c.*,COALESCE(array_agg(cc.category_id) FILTER(WHERE cc.category_id IS NOT NULL),ARRAY[]::uuid[]) AS category_ids
 FROM creators c LEFT JOIN creator_categories cc ON cc.creator_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT $1 OFFSET $2`,[q.limit,q.offset]);
 res.json({data:r.rows});
}));
adminRoutes.post('/creators',roles('owner','editor'),handler(async(req,res)=>{
 const b=creator.parse(req.body);
 if(!config.YOUTUBE_API_KEY)throw new HttpError(503,'YOUTUBE_UNCONFIGURED','Configure YouTube API key');
 const yt=new YoutubeClient();const remote=await yt.channels([b.channelId]);
 if(!remote.length)throw new HttpError(404,'CHANNEL_NOT_FOUND','Channel not verified on YouTube');
 try{const id=await transaction(async tx=>{
   const r=await tx.query('INSERT INTO creators(channel_id,slug,display_name,description,featured,enabled) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
      [b.channelId,b.slug,b.displayName,b.description,b.featured,b.enabled]);
   for(const cid of b.categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[r.rows[0].id,cid]);
   return r.rows[0].id;
 });await auditAs(res,'creator.create',id);await bustPublicCache();res.status(201).json({data:{id}});
 }catch(e:any){if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Channel ID or slug already exists');if(e.code==='23503')throw new HttpError(400,'CATEGORY_MISSING','Unknown category ID');throw e;}
}));
// PCI_SMART_BULK_IMPORT_V1: Existing channels are never modified or revalidated.
// All new channel IDs are verified BEFORE an atomic insert of the new subset.
adminRoutes.post('/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{
 const input=z.array(creator).min(1).max(100).parse(req.body?.creators);
 const unique=new Map<string,typeof input[number]>();
 const duplicatedInFile:string[]=[];
 for(const item of input){
   if(unique.has(item.channelId)){duplicatedInFile.push(item.channelId);continue;}
   unique.set(item.channelId,item);
 }
 const items=[...unique.values()];
 const ids=items.map(x=>x.channelId);
 const existing=await query<{channel_id:string;slug:string}>(
  'SELECT channel_id,slug FROM creators WHERE channel_id = ANY($1::text[]) OR slug = ANY($2::text[])',
  [ids,items.map(x=>x.slug)]);
 const byChannel=new Set(existing.rows.map(x=>x.channel_id));
 const skipped=items.filter(x=>byChannel.has(x.channelId)).map(x=>x.channelId);
 const fresh=items.filter(x=>!byChannel.has(x.channelId));
 const claimedSlugs=new Map(existing.rows.map(x=>[x.slug,x.channel_id]));
 const seenSlugs=new Map<string,string>();
 const conflicts:{channelId:string;slug:string;existingChannelId:string}[]=[];
 const safeFresh:typeof fresh=[];
 for(const item of fresh){
  const owner=claimedSlugs.get(item.slug)??seenSlugs.get(item.slug);
  if(owner && owner!==item.channelId){
   conflicts.push({channelId:item.channelId,slug:item.slug,existingChannelId:owner});
   continue;
  }
  seenSlugs.set(item.slug,item.channelId);
  safeFresh.push(item);
 }
 if(safeFresh.length && !config.YOUTUBE_API_KEY)throw new HttpError(503,'YOUTUBE_UNCONFIGURED','Configure YouTube API key');
 if(safeFresh.length){
  const yt=new YoutubeClient(),valid=new Set<string>();
  for(const batch of chunks(safeFresh.map(x=>x.channelId),50))
   for(const c of await yt.channels(batch))valid.add(c.id);
  const invalid=safeFresh.filter(x=>!valid.has(x.channelId)).map(x=>x.channelId);
  if(invalid.length)throw new HttpError(400,'CHANNEL_NOT_FOUND',
   `Unverified YouTube IDs: ${invalid.join(', ')}. No records imported`);
 }
 let created=0;
 try{
  await transaction(async tx=>{
   for(const item of safeFresh){
    const r=await tx.query(`INSERT INTO creators(channel_id,slug,display_name,description,featured,enabled)
      VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING id`,
      [item.channelId,item.slug,item.displayName,item.description,item.featured,item.enabled]);
    if(!r.rowCount){skipped.push(item.channelId);continue;}
    created++;
    for(const cid of item.categoryIds)await tx.query(
      'INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[r.rows[0].id,cid]);
   }
  });
 }catch(e:any){if(e.code==='23503')throw new HttpError(400,'CATEGORY_MISSING','Unknown category');throw e;}
 await auditAs(res,'creator.bulk_smart_import',null,{created,skipped:skipped.length,duplicatesInFile:duplicatedInFile.length,conflicts:conflicts.length});
 if(created)await bustPublicCache();
 res.status(200).json({data:{created,skipped:skipped.length,duplicatesInFile:duplicatedInFile.length,
  skippedChannelIds:skipped,duplicateChannelIds:duplicatedInFile,conflicts}});
}));
adminRoutes.patch('/creators/:id',roles('owner','editor'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);
 const b=creator.omit({channelId:true}).partial().parse(req.body);
 if(!Object.keys(b).length)throw new HttpError(400,'EMPTY_PATCH','No update fields');
 try{await transaction(async tx=>{
   const found=await tx.query('SELECT id FROM creators WHERE id=$1 FOR UPDATE',[id]);if(!found.rowCount)throw new HttpError(404,'NOT_FOUND','Creator not found');
   await tx.query(`UPDATE creators SET slug=COALESCE($2,slug),display_name=COALESCE($3,display_name),
     description=COALESCE($4,description),featured=COALESCE($5,featured),enabled=COALESCE($6,enabled),updated_at=now() WHERE id=$1`,
     [id,b.slug??null,b.displayName??null,b.description??null,b.featured??null,b.enabled??null]);
   if(b.categoryIds){await tx.query('DELETE FROM creator_categories WHERE creator_id=$1',[id]);for(const cid of b.categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[id,cid]);}
 });await auditAs(res,'creator.update',id,{fields:Object.keys(b)});await bustPublicCache();res.json({data:{updated:true}});
 }catch(e:any){if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Slug already in use');if(e.code==='23503')throw new HttpError(400,'CATEGORY_MISSING','Unknown category');throw e;}
}));
adminRoutes.delete('/creators/:id',roles('owner','editor'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);const r=await query('UPDATE creators SET enabled=false,updated_at=now() WHERE id=$1 RETURNING id',[id]);
 if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Creator not found');await auditAs(res,'creator.disable',id);await bustPublicCache();res.json({data:{disabled:true}});
}));

adminRoutes.get('/categories',handler(async(_req,res)=>res.json({data:(await query('SELECT * FROM categories ORDER BY display_order,slug')).rows})));
adminRoutes.post('/categories',roles('owner','editor'),handler(async(req,res)=>{
 const b=categorySchema.parse(req.body);
 try{const r=await query('INSERT INTO categories(slug,label,description,display_order,active) VALUES($1,$2,$3,$4,$5) RETURNING id',
 [b.slug,b.label,b.description,b.displayOrder,b.active]);await auditAs(res,'category.create',r.rows[0].id);await bustPublicCache();res.status(201).json({data:r.rows[0]});}
 catch(e:any){if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Category slug exists');throw e;}
}));
adminRoutes.patch('/categories/:id',roles('owner','editor'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);const b=categorySchema.partial().parse(req.body);
 if(!Object.keys(b).length)throw new HttpError(400,'EMPTY_PATCH','No fields');
 try{const r=await query(`UPDATE categories SET slug=COALESCE($2,slug),label=COALESCE($3,label),description=COALESCE($4,description),
   display_order=COALESCE($5,display_order),active=COALESCE($6,active) WHERE id=$1 RETURNING id`,
   [id,b.slug??null,b.label??null,b.description??null,b.displayOrder??null,b.active??null]);
 if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Category not found');await auditAs(res,'category.update',id,{fields:Object.keys(b)});await bustPublicCache();res.json({data:{updated:true}});}
 catch(e:any){if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Category slug exists');throw e;}
}));

adminRoutes.get('/sync-runs',roles('owner','editor'),handler(async(req,res)=>{
 const limit=z.coerce.number().int().min(1).max(100).default(25).parse(req.query.limit??25);
 res.json({data:(await query('SELECT * FROM sync_runs ORDER BY created_at DESC LIMIT $1',[limit])).rows});
}));
adminRoutes.post('/sync-runs',roles('owner','editor'),handler(async(_req,res)=>{
 if(config.YOUTUBE_SYNC_ENABLED!=='true'||!config.YOUTUBE_API_KEY)throw new HttpError(503,'SYNC_DISABLED','YouTube sync disabled or not configured');
 const result=await enqueueSync('manual',adminId(res));await auditAs(res,'sync.request',result.id);
 res.status(202).json({data:result});
}));
adminRoutes.get('/system-health',roles('owner'),handler(async(_req,res)=>{
 const db=await query('SELECT now() AS time');
 let redisHealthy=false;try{redisHealthy=(await redis.ping())==='PONG';}catch{}
 const quota=await query("SELECT COALESCE(sum(quota_used),0)::int AS units FROM sync_runs WHERE created_at>now()-interval '24 hours'");
 res.json({data:{database:'ok',databaseTime:db.rows[0].time,redis:redisHealthy?'ok':'unavailable',syncEnabled:config.YOUTUBE_SYNC_ENABLED==='true',quotaEstimatedLast24h:quota.rows[0].units,youtubeKeyConfigured:!!config.YOUTUBE_API_KEY}});
}));

const settingsSchema=z.discriminatedUnion('key',[
 z.object({key:z.literal('wall_enabled'),value:z.boolean()}),
 z.object({key:z.literal('wall_read_only'),value:z.boolean()}),
 z.object({key:z.literal('wall_slow_mode_seconds'),value:z.number().int().min(0).max(60)}),
 z.object({key:z.literal('wall_blocked_terms'),value:z.array(z.string().trim().min(2).max(60)).max(100)}),
 z.object({key:z.literal('ranking_default'),value:z.enum(['subscribers','views','videos'])}),
 z.object({key:z.literal('sync_schedule_enabled'),value:z.boolean()}),
 z.object({key:z.literal('sync_schedule_time'),value:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)}),
 z.object({key:z.literal('homepage_announcement'),value:z.string().max(500)})
]);
adminRoutes.get('/settings',roles('owner','editor','moderator'),handler(async(_req,res)=>{
 const settings=await query('SELECT key,value FROM app_settings ORDER BY key');
 res.json({data:settings.rows});
}));
adminRoutes.patch('/settings',roles('owner'),handler(async(req,res)=>{
 const b=settingsSchema.parse(req.body);
 await query('INSERT INTO app_settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=now()',
 [b.key,JSON.stringify(b.value)]);
 await auditAs(res,'settings.update',b.key,{value:b.key==='wall_blocked_terms'?'[redacted]':b.value});
 await bustPublicCache();
 if(b.key==='wall_enabled'||b.key==='wall_read_only')emitWall('wall:status_changed',{key:b.key,value:b.value});
 res.json({data:{updated:true}});
}));
adminRoutes.get('/ranking-preview',roles('owner','editor'),handler(async(req,res)=>{
 const sort=z.enum(['subscribers','views','videos']).default('subscribers').parse(req.query.sort??'subscribers');
 const r=await query(`SELECT c.id,c.channel_id AS "channelId",c.display_name AS "displayName",s.subscriber_count::text AS "subscriberCount",
 s.view_count::text AS "viewCount",s.video_count::text AS "videoCount" FROM creators c LEFT JOIN channel_stats_latest s ON s.creator_id=c.id WHERE c.enabled=true`);
 res.json({data:rankedRows(r.rows,sort),meta:{algorithm:'Direct raw YouTube metric descending; dense ties',notPublishedScore:true,coverage:metricCoverage(r.rows,sort)}});
}));
adminRoutes.get('/videos',roles('owner','editor'),handler(async(req,res)=>{
 const limit=z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit??50);
 const r=await query(`SELECT v.video_id,v.title,v.published_at,v.fetched_at,v.display_on_site,c.display_name,vs.view_count::text AS views
 FROM videos v JOIN creators c ON c.id=v.creator_id LEFT JOIN video_stats_latest vs ON vs.video_id=v.video_id
 ORDER BY v.published_at DESC NULLS LAST LIMIT $1`,[limit]);res.json({data:r.rows});
}));
adminRoutes.patch('/videos/:id',roles('owner','editor'),handler(async(req,res)=>{
 const id=z.string().regex(/^[A-Za-z0-9_-]{11}$/).parse(req.params.id);
 const b=z.object({displayOnSite:z.boolean()}).parse(req.body);
 const r=await query('UPDATE videos SET display_on_site=$2 WHERE video_id=$1 RETURNING video_id',[id,b.displayOnSite]);
 if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Video missing from current collection');
 await auditAs(res,'video.visibility',id,{displayOnSite:b.displayOnSite});await bustPublicCache();
 res.json({data:{updated:true,displayOnSite:b.displayOnSite}});
}));
adminRoutes.get('/wall/reports',roles('owner','moderator'),handler(async(req,res)=>{
 const status=z.enum(['pending','resolved','dismissed']).default('pending').parse(req.query.status??'pending');
 const r=await query('SELECT r.*,m.nickname,m.body,m.deleted_at FROM wall_reports r JOIN wall_messages m ON m.id=r.message_id WHERE r.status=$1 ORDER BY r.created_at DESC LIMIT 150',[status]);res.json({data:r.rows});
}));
adminRoutes.patch('/wall/reports/:id',roles('owner','moderator'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id),b=z.object({status:z.enum(['resolved','dismissed'])}).parse(req.body);
 const r=await query('UPDATE wall_reports SET status=$2 WHERE id=$1 RETURNING id',[id,b.status]);if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Report missing');
 await auditAs(res,'wall.report_review',id,{status:b.status});res.json({data:{updated:true}});
}));
adminRoutes.delete('/wall/messages/:id',roles('owner','moderator'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);
 const r=await query('UPDATE wall_messages SET deleted_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id',[id]);
 if(!r.rowCount)throw new HttpError(404,'NOT_FOUND','Message missing');
 await query("UPDATE wall_reports SET status='resolved' WHERE message_id=$1 AND status='pending'",[id]);
 await auditAs(res,'wall.message_delete',id);emitWall('wall:message_removed',{id});res.json({data:{deleted:true}});
}));
adminRoutes.post('/wall/bans',roles('owner','moderator'),handler(async(req,res)=>{
 const b=z.object({authorType:z.enum(['guest','user']),authorRef:uuid,reason:z.string().trim().min(3).max(250),durationMinutes:z.number().int().min(1).max(525600).nullable()}).parse(req.body);
 const key=`${b.authorType}:${b.authorRef}`;
 await query(`INSERT INTO wall_bans(subject_key,reason,expires_at,created_by)
 VALUES($1,$2,CASE WHEN $3::int IS NULL THEN NULL ELSE now()+($3::int * interval '1 minute') END,$4)
 ON CONFLICT(subject_key) DO UPDATE SET reason=EXCLUDED.reason,expires_at=EXCLUDED.expires_at,created_by=EXCLUDED.created_by,created_at=now()`,
 [key,b.reason,b.durationMinutes,adminId(res)]);
 await auditAs(res,'wall.ban',key,{durationMinutes:b.durationMinutes});res.status(201).json({data:{banned:true}});
}));
adminRoutes.delete('/wall/bans/:type/:id',roles('owner','moderator'),handler(async(req,res)=>{
 const type=z.enum(['guest','user']).parse(req.params.type),id=uuid.parse(req.params.id);const key=`${type}:${id}`;
 await query('DELETE FROM wall_bans WHERE subject_key=$1',[key]);await auditAs(res,'wall.unban',key);res.json({data:{unbanned:true}});
}));
adminRoutes.get('/wall/messages',roles('owner','moderator'),handler(async(_req,res)=>{
 res.json({data:(await query('SELECT * FROM wall_messages ORDER BY created_at DESC LIMIT 200')).rows});
}));

adminRoutes.get('/admins',roles('owner'),handler(async(_req,res)=>{
 res.json({data:(await query('SELECT id,email,role,active,created_at,last_login_at FROM admin_users ORDER BY created_at')).rows});
}));
adminRoutes.post('/admins',roles('owner'),handler(async(req,res)=>{
 const b=z.object({email:z.string().trim().toLowerCase().email().max(254),role:z.enum(['owner','editor','moderator'])}).parse(req.body);
 const temporaryPassword=randomBytes(24).toString('base64url'),secret=newTotpSecret();
 try {const r=await query('INSERT INTO admin_users(email,role,password_hash,totp_secret_enc) VALUES($1,$2,$3,$4) RETURNING id',
 [b.email,b.role,await hashPassword(temporaryPassword),encryptSecret(secret)]);
 await auditAs(res,'admin.create',r.rows[0].id,{role:b.role});
 res.status(201).json({data:{id:r.rows[0].id,email:b.email,role:b.role,temporaryPassword,totpUri:authTotpUri(b.email,secret),warning:'One-time credentials. Deliver only via a secure channel.'}});
 }catch(e:any){if(e.code==='23505')throw new HttpError(409,'DUPLICATE','Admin email exists');throw e;}
}));
adminRoutes.patch('/admins/:id',roles('owner'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id),b=z.object({role:z.enum(['owner','editor','moderator']).optional(),active:z.boolean().optional()}).parse(req.body);
 if(!Object.keys(b).length)throw new HttpError(400,'EMPTY_PATCH','No fields');
 if(id===adminId(res) && (b.active===false||b.role&&b.role!=='owner'))throw new HttpError(400,'SELF_LOCKOUT','Cannot remove own owner access');
 await transaction(async tx=>{
   const existing=await tx.query('SELECT id,role FROM admin_users WHERE id=$1 FOR UPDATE',[id]);if(!existing.rowCount)throw new HttpError(404,'NOT_FOUND','Admin missing');
   if(existing.rows[0].role==='owner' && (b.active===false || b.role&&b.role!=='owner')){
     const cnt=await tx.query("SELECT COUNT(*)::int AS n FROM admin_users WHERE role='owner' AND active=true");
     if(cnt.rows[0].n<=1)throw new HttpError(409,'LAST_OWNER','Cannot disable last owner');
   }
   await tx.query('UPDATE admin_users SET role=COALESCE($2,role),active=COALESCE($3,active),session_version=session_version+1 WHERE id=$1',[id,b.role??null,b.active??null]);
 });await auditAs(res,'admin.update',id,{fields:Object.keys(b)});res.json({data:{updated:true}});
}));
adminRoutes.post('/admin-password',roles('owner','editor','moderator'),handler(async(req,res)=>{
 const b=z.object({currentPassword:z.string(),newPassword:z.string().min(12).max(128),totp:z.string().regex(/^\d{6}$/)}).parse(req.body);
 const id=adminId(res),r=await query('SELECT password_hash,totp_secret_enc FROM admin_users WHERE id=$1',[id]);
 const {verifyPassword,decryptSecret,validTotp}=await import('../../lib/security.js');
 if(!await verifyPassword(r.rows[0].password_hash,b.currentPassword)||!validTotp(decryptSecret(r.rows[0].totp_secret_enc),b.totp))throw new HttpError(403,'BAD_CREDENTIALS','Password or MFA invalid');
 await query('UPDATE admin_users SET password_hash=$2,session_version=session_version+1 WHERE id=$1',[id,await hashPassword(b.newPassword)]);
 await auditAs(res,'admin.password_change',id);res.json({data:{changed:true,reloginRequired:true}});
}));
adminRoutes.get('/audit-logs',roles('owner'),handler(async(req,res)=>{
 const limit=z.coerce.number().int().min(1).max(200).default(100).parse(req.query.limit??100);
 res.json({data:(await query('SELECT * FROM admin_audit_logs ORDER BY id DESC LIMIT $1',[limit])).rows});
}));
