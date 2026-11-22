import {Router} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {cacheRead,redis} from '../../lib/redis.js';
import {handler,HttpError} from '../../lib/errors.js';
import {requireAdmin,roles,audit,type AdminIdentity} from '../auth/auth.js';
import {providers,configured,satelliteTick} from './service.js';
import {PROVIDERS,CITIES} from './catalog.mjs';
import {gibsDisplayTemplate,gpmWmsURL} from './feeds.mjs';
export const satellitePublicRoutes=Router();
export const satelliteAdminRoutes=Router();
const city=z.enum(Object.keys(CITIES) as [string,...string[]]);
const days=z.coerce.number().int().min(1).max(30).default(7);
const limit=z.coerce.number().int().min(1).max(200).default(100);
const idSchema=z.enum(Object.keys(PROVIDERS) as [string,...string[]]);
const list=async(metric:'fire'|'rainfall'|'solar'|'natural_event'|'scene'|'imagery',location:string,n:number,backDays:number,providerId:string|null=null)=>{
 const epoch=(await redis.get('satellite:epoch'))??'0';
 return cacheRead(`satellite:observations:v1:${epoch}:${metric}:${location}:${n}:${backDays}:${providerId??'all'}`,async()=>{
  const r=await query(`SELECT obs.location,obs.observed_at,obs.payload,obs.provider FROM satellite.observations obs JOIN satellite.providers cfg ON cfg.id=obs.provider AND cfg.enabled=true WHERE metric=$1 AND ($2='all' OR location=$2) AND observed_at>=now()-($3::int*interval '1 day') AND ($5::text IS NULL OR obs.provider=$5) ORDER BY observed_at DESC,obs.id DESC LIMIT $4`,[metric,location,backDays,n,providerId]);
  return r.rows.map(x=>({location:x.location,observedAt:x.observed_at,provider:x.provider,...x.payload}));
 },30);
};
satellitePublicRoutes.use((_req,res,next)=>{res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=180');next();});
satellitePublicRoutes.get('/openapi.json',(_req,res)=>res.json({openapi:'3.0.3',info:{title:'PCI Satellite Intelligence API',version:'0.1.0',description:'Public read-only satellite-derived estimates. NASA POWER rainfall is not GPM; NASA FIRMS anomalies are not confirmed fires.'},servers:[{url:'/api/v1/satellite'}],paths:Object.fromEntries(['/sources','/fires/latest','/fires/history','/rainfall/latest','/rainfall/history','/solar/latest','/solar/history','/natural-events/latest','/scenes/latest','/imagery/latest','/gpm/imagery/latest'].map(p=>[p,{get:{summary:`Satellite data ${p}`,responses:{'200':{description:'Data with provenance, observation time and limitations'},'429':{description:'Rate limit exceeded'}}}}]))}));
satellitePublicRoutes.get('/sources',handler(async(_req,res)=>{res.json({data:(await providers()).map(p=>({id:p.id,label:p.label,kind:p.kind,enabled:p.enabled,implemented:p.implemented,lastSuccessAt:p.last_success_at,lastAttemptAt:p.last_attempt_at,refreshQueued:Boolean(p.refresh_requested_at),available:p.enabled&&p.implemented&&p.configured&&Boolean(p.last_success_at)&&Date.now()-new Date(p.last_success_at!).getTime()<Math.max(172800000,p.refresh_minutes*120000)}))});}));
satellitePublicRoutes.get('/fires/latest',handler(async(req,res)=>{const q=limit.parse(req.query.limit);res.json({data:await list('fire','bounding-box',q,2),meta:{status:'satellite_thermal_detections_not_confirmed_fires',source:'NASA FIRMS',provisional:true}});}));
satellitePublicRoutes.get('/fires/history',handler(async(req,res)=>{const q=days.parse(req.query.days);res.json({data:await list('fire','bounding-box',200,q),meta:{days:q,source:'NASA FIRMS',provisional:true}});}));
satellitePublicRoutes.get('/rainfall/latest',handler(async(req,res)=>{const location=city.parse(req.query.city??'lahore');res.json({data:await list('rainfall',location,1,7),meta:{city:location,source:'NASA POWER PRECTOTCORR',notGpm:true,notRealtime:true}});}));
satellitePublicRoutes.get('/rainfall/history',handler(async(req,res)=>{const location=city.parse(req.query.city??'lahore'),d=days.parse(req.query.days);res.json({data:await list('rainfall',location,30,d),meta:{city:location,source:'NASA POWER PRECTOTCORR',notGpm:true}});}));
satellitePublicRoutes.get('/solar/latest',handler(async(req,res)=>{const location=city.parse(req.query.city??'lahore');res.json({data:await list('solar',location,1,7),meta:{city:location,source:'NASA POWER',notRealtime:true}});}));
satellitePublicRoutes.get('/solar/history',handler(async(req,res)=>{const location=city.parse(req.query.city??'lahore'),d=days.parse(req.query.days);res.json({data:await list('solar',location,30,d),meta:{city:location,source:'NASA POWER'}});}));
// Additional public feeds: observation metadata, not unverified disaster impact calculations.
satellitePublicRoutes.get('/natural-events/latest',handler(async(_req,res)=>{
 res.json({data:await list('natural_event','bounding-box',100,30),meta:{source:'NASA EONET',scope:'Pakistan-region bounding box',notWarning:true}});
}));
satellitePublicRoutes.get('/scenes/latest',handler(async(req,res)=>{
 const mission=z.enum(['sentinel1','sentinel2','sentinel5p']).parse(req.query.mission);
 const data=await list('scene','bounding-box',100,30);
 res.json({data:data.filter((row:{provider:string})=>row.provider===mission).slice(0,30),meta:{source:'Copernicus Data Space',mission,scope:'catalogue_only',notDerivedFloodCropOrPollutionData:true}});
}));
satellitePublicRoutes.get('/imagery/latest',handler(async(_req,res)=>{
 const data=await list('imagery','bounding-box',1,30,'gibs');
 const day=data[0]?.day;
 res.json({data:typeof day==='string'?[{...data[0],tileTemplate:gibsDisplayTemplate(day),maxZoom:9}]:[],meta:{source:'NASA GIBS',type:'raster_visualization',notQuantitativeObservation:true}});
}));
satellitePublicRoutes.get('/gpm/imagery/latest',handler(async(_req,res)=>{
 const data=await list('imagery','bounding-box',1,30,'gpm');
 const day=data[0]?.day;
 res.json({data:typeof day==='string'?[{...data[0],tileTemplate:gpmWmsURL(day,true),maxZoom:6}]:[],meta:{source:'NASA GPM IMERG via NASA GIBS',type:'visualized_precipitation_rate',numericRainfallAvailable:false}});
}));
satelliteAdminRoutes.use(requireAdmin,roles('owner'));
satelliteAdminRoutes.get('/providers',handler(async(_req,res)=>res.json({data:await providers()})));
satelliteAdminRoutes.patch('/providers/:id',handler(async(req,res)=>{
 const id=idSchema.parse(req.params.id);const changes=z.object({enabled:z.boolean(),refreshMinutes:z.number().int().min(60).max(10080)}).strict().parse(req.body);
 const p=(PROVIDERS as Record<string,{implemented:boolean;minMinutes:number}>)[id];if(changes.enabled&&!p.implemented)throw new HttpError(409,'NOT_IMPLEMENTED','This source connector is not implemented yet');
 if(changes.enabled&&!configured(id))throw new HttpError(409,'MISSING_CREDENTIALS','Configure the provider credentials in Hostinger first');
 if(changes.refreshMinutes<p.minMinutes)throw new HttpError(422,'MIN_REFRESH_INTERVAL',`Minimum ${p.minMinutes} minutes for this source`);
 const updated=await query(`UPDATE satellite.providers SET enabled=$2,refresh_minutes=$3,updated_at=now(),
  refresh_requested_at=CASE WHEN $2::boolean AND NOT enabled THEN now() WHEN NOT $2::boolean THEN NULL ELSE refresh_requested_at END
  WHERE id=$1 RETURNING id,enabled,refresh_minutes,refresh_requested_at`,[id,changes.enabled,changes.refreshMinutes]);
 await redis.incr('satellite:epoch').catch(()=>undefined);
 await audit((res.locals.admin as AdminIdentity).id,'satellite.provider.update',id,{enabled:changes.enabled,refreshMinutes:changes.refreshMinutes});res.json({data:updated.rows[0]});
 if(changes.enabled) setImmediate(()=>{void satelliteTick();});
}));
satelliteAdminRoutes.post('/providers/:id/refresh',handler(async(req,res)=>{
 const id=idSchema.parse(req.params.id);if(!(PROVIDERS as Record<string,{implemented:boolean}>)[id].implemented)throw new HttpError(409,'NOT_IMPLEMENTED','Provider is not implemented');
 const changed=await query(`UPDATE satellite.providers SET refresh_requested_at=now() WHERE id=$1 AND enabled=true AND (refresh_requested_at IS NULL) AND (last_attempt_at IS NULL OR last_attempt_at<now()-interval '1 minute') RETURNING id`,[id]);
 if(!changed.rowCount){
  const state=await query<{enabled:boolean;refresh_requested_at:string|null}>('SELECT enabled,refresh_requested_at FROM satellite.providers WHERE id=$1',[id]);
  if(!state.rows[0]?.enabled)throw new HttpError(409,'SOURCE_DISABLED','Enable this source first');
  if(state.rows[0].refresh_requested_at){res.status(202).json({data:{provider:id,queued:true,message:'Refresh already queued or processing.'}});setImmediate(()=>{void satelliteTick();});return;}
  throw new HttpError(409,'REFRESH_COOLDOWN','Source is within its one-minute refresh cooldown');
 }
 await audit((res.locals.admin as AdminIdentity).id,'satellite.provider.refresh_requested',id,{});
 res.status(202).json({data:{provider:id,queued:true,message:'Refresh dispatched to PCI ingestion.'}});
 setImmediate(()=>{void satelliteTick();});
}));
