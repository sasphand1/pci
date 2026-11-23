import {Router} from 'express';
import {z} from 'zod';
import {handler,HttpError} from '../../lib/errors.js';
import {query} from '../../lib/db.js';
import {boundedLimit} from '../../lib/redis.js';
import {requireAdmin,roles,type AdminIdentity} from '../auth/auth.js';
import {backfillRecentMetrics,ingestStatus,mirrorApiRefresh,mirrorVideoSamples,recordObservation} from './store.js';
import {boundedResponseText,requestPublicInstagramAvatar} from './http.js';
import {POLICY} from './policy.js';
import {reportSourceResult} from './monitor.js';
import {classifyHttpFailure} from './monitor-rules.js';
import {registerHubReadRoutes} from './read-routes.js';

export const ingestAdminRoutes=Router();
ingestAdminRoutes.use('/ingest',requireAdmin);
const actor=(res:{locals:Record<string,unknown>})=>(res.locals.admin as AdminIdentity|undefined)?.id??null;
async function enabled(id:string){
  const r=await query<{enabled:boolean}>('SELECT enabled FROM ingest_sources WHERE id=$1',[id]);
  return r.rows[0]?.enabled===true;
}
async function budget(key:string,max:number){
  try {if(!(await boundedLimit(`ingest:${key}`,max,86400)))throw new HttpError(429,'INGEST_DAILY_LIMIT','Daily request budget reached');}
  catch(e){if(e instanceof HttpError)throw e;throw new HttpError(503,'INGEST_LIMITER_UNAVAILABLE','Collection rate limiter unavailable');}
}

ingestAdminRoutes.get('/ingest/status',handler(async(_req,res)=>res.json({data:await ingestStatus()})));
ingestAdminRoutes.get('/ingest/policies',handler(async(_req,res)=>res.json({data:{platforms:POLICY,httpDefaultEnabled:false}})));

/** Run compatibility backfill without additional platform requests or reranking. */
ingestAdminRoutes.post('/ingest/backfill',roles('owner','editor'),handler(async(req,res)=>{
  const body=z.object({refreshRunId:z.string().uuid().optional(),videos:z.boolean().default(false),historyDays:z.number().int().min(1).max(7).optional()}).strict().parse(req.body??{});
  if(!body.refreshRunId&&!body.videos&&!body.historyDays)throw new HttpError(400,'EMPTY_BACKFILL','Select refreshRunId, historyDays or videos');
  let api=null,video=null,history=null;
  if(body.refreshRunId){
    const r=await query<{status:string}>('SELECT status FROM refresh_runs WHERE id=$1',[body.refreshRunId]);
    if(!r.rows.length)throw new HttpError(404,'RUN_NOT_FOUND','Refresh run not found');
    if(!['succeeded','partial'].includes(r.rows[0].status))throw new HttpError(409,'RUN_NOT_READY','Cannot backfill an unfinished run');
    api=await mirrorApiRefresh(body.refreshRunId);
  }
  if(body.historyDays)history=await backfillRecentMetrics(body.historyDays);
  if(body.videos)video=await mirrorVideoSamples();
  await query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',
    [actor(res),'ingest.backfill',body.refreshRunId??'videos',JSON.stringify({api,video,history})]);
  res.json({data:{api,video,history}});
}));

/** Runtime switch affects HTTP candidates only; collector still requires env opt-in. */
ingestAdminRoutes.patch('/ingest/sources/:id',roles('owner'),handler(async(req,res)=>{
  const id=z.enum(['youtube.http','instagram.http','tiktok.http']).parse(req.params.id);
  const {enabled}=z.object({enabled:z.boolean()}).strict().parse(req.body);
  const r=await query(`UPDATE ingest_sources SET enabled=$2 WHERE id=$1 RETURNING id,enabled`,[id,enabled]);
  await query('INSERT INTO admin_audit_logs(actor_id,action,subject,metadata) VALUES($1,$2,$3,$4::jsonb)',
    [actor(res),'ingest.source_switch',id,JSON.stringify({enabled})]);
  res.json({data:r.rows[0]});
}));

/** Optional Instagram picture fallback; no login, no proxy or anti-bot circumvention. */
ingestAdminRoutes.post('/ingest/instagram/avatar/:accountId',roles('owner','editor'),handler(async(req,res)=>{
  const id=z.string().uuid().parse(req.params.accountId);
  if(process.env.PCI_INSTAGRAM_HTTP_AVATARS!=='true'||!(await enabled('instagram.http')))
    throw new HttpError(409,'HTTP_SOURCE_DISABLED','Instagram public HTTP source is not approved/enabled');
  const account=await query<{id:string;handle:string;external_id:string;avatar_url:string|null}>(
    "SELECT id,handle,external_id,avatar_url FROM accounts WHERE id=$1 AND platform='instagram'",[id]);
  const a=account.rows[0];if(!a)throw new HttpError(404,'ACCOUNT_NOT_FOUND','Instagram account not found');
  if(a.avatar_url)return res.json({data:{status:'already_present'}});
  await budget(`igavatar:${id}`,2);
  let url:string|null=null;
  try{url=await requestPublicInstagramAvatar(a.handle);}
  catch{await reportSourceResult('instagram.http',false,'UNAVAILABLE');/* no bad URL or transient error is promoted */}
  if(!url)return res.json({data:{status:'unavailable',avatarUrl:null}});
  // Do not replace a newer API image obtained while the HTTP request was in flight.
  const r=await query(`UPDATE accounts SET avatar_url=$2 WHERE id=$1 AND avatar_url IS NULL RETURNING id`,[a.id,url]);
  if(r.rowCount){
    await recordObservation({sourceId:'instagram.http',sourceRunRef:`avatar:${id}:${new Date().toISOString()}`,
      accountId:id,entityKind:'account',entityId:`instagram:${a.external_id}`,metric:'avatar_url',
      valueNumeric:null,valueText:url,accuracy:'exact',observedAt:new Date().toISOString(),
      metadata:{method:'public-og-image',identityMatch:true}});
  }
  if(r.rowCount)await reportSourceResult('instagram.http',true);
  res.json({data:{status:r.rowCount?'updated':'already_present',avatarUrl:r.rowCount?url:null}});
}));

/** TikTok key-free official embed metadata: identity/thumbnail only, NOT engagement counts. */
ingestAdminRoutes.post('/ingest/tiktok/embed',roles('owner','editor'),handler(async(req,res)=>{
  const {url}=z.object({url:z.string().url().max(250)}).strict().parse(req.body);
  const match=/^https:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{2,30})\/video\/(\d{12,25})\/?(?:\?.*)?$/.exec(url);
  if(!match)throw new HttpError(400,'BAD_VIDEO_URL','Expected a public tiktok.com/@user/video/ID URL');
  if(!(await enabled('tiktok.http')))throw new HttpError(409,'SOURCE_DISABLED','TikTok oEmbed collection disabled');
  await budget('tiktok-oembed',100);
  const clean=`https://www.tiktok.com/@${match[1]}/video/${match[2]}`;
  const endpoint=`https://www.tiktok.com/oembed?url=${encodeURIComponent(clean)}`;
  let data:Record<string,unknown>;
  let httpStatus:number|null=null;
  try {
    const r=await fetch(endpoint,{headers:{accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(8000)});
    httpStatus=r.status;
    if(!r.ok||!r.headers.get('content-type')?.includes('json')||Number(r.headers.get('content-length')??0)>30_000)
      throw new Error('unavailable');
    const text=await boundedResponseText(r,30_000);if(!text)throw new Error('oversized response');
    const json=JSON.parse(text) as unknown;if(!json||typeof json!=='object'||Array.isArray(json))throw new Error('bad response');
    data=json as Record<string,unknown>;
  }catch{
    await reportSourceResult('tiktok.http',false,classifyHttpFailure(httpStatus));
    throw new HttpError(502,'TIKTOK_OEMBED_UNAVAILABLE','Public TikTok embed metadata unavailable');
  }
  const title=typeof data.title==='string'?data.title.slice(0,500):null;
  const thumb=typeof data.thumbnail_url==='string'&&/^https:\/\//.test(data.thumbnail_url)?data.thumbnail_url.slice(0,2000):null;
  const author=typeof data.author_url==='string'?data.author_url:'';
  let exactAuthor=false;
  try{const a=new URL(author);exactAuthor=a.protocol==='https:'&&['www.tiktok.com','tiktok.com'].includes(a.hostname)&&
    a.pathname.replace(/\/$/,'').toLowerCase()===`/@${match[1].toLowerCase()}`;}
  catch{/* invalid source identity */}
  if(!exactAuthor){await reportSourceResult('tiktok.http',false,'SHAPE_CHANGED');throw new HttpError(502,'IDENTITY_MISMATCH','TikTok embed creator identity did not match requested URL');}
  await query(`INSERT INTO ingest_content(platform,content_id,content_type,title,url,thumbnail_url,source_id)
    VALUES('tiktok',$1,'video',$2,$3,$4,'tiktok.http')
    ON CONFLICT(platform,content_id) DO UPDATE SET title=EXCLUDED.title,url=EXCLUDED.url,
      thumbnail_url=COALESCE(EXCLUDED.thumbnail_url,ingest_content.thumbnail_url),last_observed_at=now()`,
    [match[2],title,clean,thumb]);
  await reportSourceResult('tiktok.http',true);
  res.json({data:{status:'stored',platform:'tiktok',contentId:match[2],title,thumbnailUrl:thumb,
    engagement:'not available from public oEmbed'}});
}));

registerHubReadRoutes(ingestAdminRoutes);
