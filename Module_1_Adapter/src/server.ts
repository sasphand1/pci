import {ensureBroadcastSchema} from './lib/broadcast-schema.js';
import {ensureProgressSchema} from './lib/progress-schema.js';
import {progressAdminRoutes} from './modules/progress/routes.js';
import {broadcastAdminRoutes,broadcastDispatchRoutes} from './modules/broadcast/routes.js';
import {ensureSatelliteSchema} from './lib/satellite-schema.js';
import {ensureSatifySchema} from './lib/satify-schema.js';
import {satifyPublicRoutes,satifyAdminRoutes,satifyWebhookRoutes} from './modules/satify/routes.js';
import {ensureIngestSchema} from './lib/ingest-schema.js';
import {ensureHubSchema} from './lib/hub-schema.js';
import {ensureEventsSchema} from './lib/events-schema.js';
import {adminEventsRoutes,publicEventsRoutes} from './modules/events/routes.js';
import {SATELLITE_RATE_WINDOW_SECONDS,isPublicSatelliteRead,satellitePermission} from './modules/satellite/guard.mjs';
import {instagramPublicRoutes,instagramAdminRoutes} from './modules/instagram/routes.js';
import {satellitePublicRoutes,satelliteAdminRoutes} from './modules/satellite/routes.js';
import {crossPublicRoutes,crossAdminRoutes} from './modules/cross-platform/routes.js';
import {unifiedPublicRoutes,unifiedAdminRoutes} from './modules/unified/routes.js';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './lib/config.js';
import {ensureUnifiedSchema} from './lib/unified-schema.js';
import {ensureEngineSchema} from './lib/engine-schema.js';
import {ensureRegistrySchema} from './lib/registry-schema.js';
import {bucketAdminRoutes} from './modules/bucket/routes.js';
import {ensureObservationsSchema} from './lib/observations-schema.js';
import {ensureCreatorAnalyticsSchema} from './lib/creator-analytics-schema.js';
import {refreshAdminRoutes} from './modules/refresh/routes.js';
import {ingestAdminRoutes} from './modules/ingest/routes.js';
import {ensurePublicationSchema} from './lib/publication-schema.js';
import {publishAdminRoutes} from './modules/publish/routes.js';
import {ensurePublicSchema} from './lib/public-schema.js';
import {publicRankingRoutes} from './modules/public/routes.js';
import {publicAvatarRoutes} from './modules/public/avatar-routes.js';
import {creatorIndexRoutes} from './modules/public/creator-index.js';
import {publicLocalRoutes} from './modules/local/routes.js';
import {localAdminRoutes} from './modules/local/admin-routes.js';
import {restaurantImageAdminRoutes,restaurantImagePublicRoutes} from './modules/local/image-routes.js';
import {ensureRestaurantImageSchema} from './modules/local/image-schema.js';
import {docsRoutes} from './modules/public/docs.js';
import {shadowAdminRoutes} from './modules/public/shadow-routes.js';
import {legacyGate} from './modules/public/legacy-gate.js';
import {startScheduler,type SchedulerHandle} from './modules/sync/scheduler.js';
import { pool } from './lib/db.js';
import { redis, ensureRedis } from './lib/redis.js';
import { logger, requestId, errorMiddleware, HttpError, handler } from './lib/errors.js';
import { publicRoutes } from './modules/creators/public.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminAuthRoutes, wallAuthRoutes } from './modules/auth/auth.js';
import { attachWall, wallRoutes } from './modules/wall/service.js';
import {boundedLimit} from './lib/redis.js';
import {pseudonym} from './lib/security.js';

// PCI_STARTUP_READY_GATE_V1: report readiness only after dependencies initialize.
let pciStartupReady = false;

export function makeApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.use(requestId);
  app.use(helmet({
    contentSecurityPolicy: false, // API serves JSON only; the frontends set their own CSP.
    crossOriginResourcePolicy: {policy:'cross-origin'},
    referrerPolicy: {policy:'no-referrer'}
  }));
  // The API is for the PCI websites, not for search results: keep every API URL out of Google.
  app.use((_req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); });
  const origins = new Set([config.PUBLIC_ORIGIN,config.ADMIN_ORIGIN]);
  app.use(cors((req,callback)=>{
    // Public satellite reads may be consumed by external Pakistan-focused applications.
    // Never permit cross-origin credentialed writes or admin management access.
    if((req.path.startsWith('/api/v1/satellite/')||(req.path.startsWith('/api/v1/satify/')&&!req.path.startsWith('/api/v1/satify/whatsapp'))) && (req.method==='GET'||req.method==='OPTIONS'))
      return callback(null,{origin:'*',credentials:false,methods:['GET','OPTIONS'],allowedHeaders:['Accept','Content-Type']});
    return callback(null,{origin(origin,cb){if(!origin || origins.has(origin))cb(null,true);else cb(new HttpError(403,'ORIGIN_DENIED','Origin not allowed'));},credentials:true,allowedHeaders:['Content-Type','Authorization','X-CSRF-Token','X-Pci-Background'],methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS']});
  }));
  // Refuse cross-origin browser writes even if a future CORS proxy setting is relaxed.
  app.use((req,res,next)=>{
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      const origin=req.header('origin');
      if(origin && !origins.has(origin))return next(new HttpError(403,'ORIGIN_DENIED','Origin not allowed'));
      const site=req.header('sec-fetch-site');
      if(site==='cross-site' && (!origin||!origins.has(origin)))return next(new HttpError(403,'CROSS_SITE_DENIED','Cross-site request rejected'));
    }
    next();
  });
  // Satify WhatsApp webhook needs the raw body for Meta's signature check; express.json then skips it.
  app.use('/api/v1/satify/whatsapp/webhook',express.raw({type:'*/*',limit:'256kb'}));
  app.use(express.json({limit:'32kb',strict:true}));
  app.use(cookieParser());
  // Avoid requests racing with database/Redis initialization.
  app.use('/api/v1',(_req,res,next)=>{
    if (!pciStartupReady) return res.status(503).json({error:{code:'SERVICE_INITIALIZING',message:'Backend dependencies are initializing'}});
    next();
  });
  app.use('/api/v1',handler(async(req,_res,next)=>{
    const key=`http:global:${pseudonym(req.ip??'unknown')}`;
    // PCI_UPDATE_1: Redis is a disposable helper. If it is down, public reads must keep working,
    // so this global limiter fails open (login/wall limiters elsewhere still fail closed).
    let allowed=true;
    try{allowed=await boundedLimit(key,300,60);}
    catch(err){logger.warn({err},'Global rate limiter unavailable; allowing request');}
    if(!allowed)throw new HttpError(429,'RATE_LIMIT','Request limit exceeded');
    next();
  }));
  // Satellite-specific abuse guard. Unlike the legacy PCI global limiter, satellite
  // public data reads fail closed if Redis becomes unavailable. Other PCI routes
  // retain their existing availability policy, with no behavior change.
  app.use('/api/v1/satellite',handler(async(req,res,next)=>{
    if (!isPublicSatelliteRead(req.originalUrl.split('?')[0],req.method)) return next();
    const key=`http:satellite:${pseudonym(req.ip??'unknown')}`;
    const decision=await satellitePermission(boundedLimit,key);
    if(decision==='rate_limited') {
      res.setHeader('Retry-After',String(SATELLITE_RATE_WINDOW_SECONDS));
      throw new HttpError(429,'SATELLITE_RATE_LIMIT','Satellite API request limit exceeded');
    }
    if(decision==='unavailable') {
      logger.warn('Satellite rate limiter unavailable; protecting API and database');
      throw new HttpError(503,'SATELLITE_UNAVAILABLE','Satellite API temporarily unavailable');
    }
    next();
  }));
  app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.get('/health/live',(_req,res)=>res.json({status:'alive'}));
  app.get('/health/ready',handler(async(_req,res)=>{
    if (!pciStartupReady) return res.status(503).json({status:'initializing'});
    await pool.query('SELECT 1');await redis.ping();
    res.json({status:'ready'});
  }));
  // PCI_ZIP_4: the public site reads only published rankings. Old ranking endpoints answer 410 unless PCI_LEGACY_PUBLIC=true.
  app.use('/api/v1',legacyGate());
  app.use(docsRoutes);
  app.use('/api/v1/public/avatars',publicAvatarRoutes);
  app.use('/api/v1/public/creator-index',creatorIndexRoutes);
  app.use('/api/v1/public/local/images',restaurantImagePublicRoutes);
  app.use('/api/v1/public/local',publicLocalRoutes);
  app.use('/api/v1/public',publicRankingRoutes);
  app.use('/api/v1/public',publicEventsRoutes);
  app.use('/api/v1',publicRoutes);
  app.use('/api/v1',unifiedPublicRoutes);
  app.use('/api/v1',instagramPublicRoutes);
  app.use('/api/v1',crossPublicRoutes);
  app.use('/api/v1/satify/whatsapp/webhook',satifyWebhookRoutes);
  app.use('/api/v1/satify',satifyPublicRoutes);
  app.use('/api/v1/admin/satify',satifyAdminRoutes);
  app.use('/api/v1/satellite',satellitePublicRoutes);
  app.use('/api/v1/admin/satellite',satelliteAdminRoutes);
  app.use('/api/v1/wall/auth',wallAuthRoutes);
  app.use('/api/v1/wall',wallRoutes);
  app.use('/api/v1/admin/auth',adminAuthRoutes);
  app.use('/api/v1/admin',progressAdminRoutes);
  app.use('/api/v1/admin/broadcast',broadcastAdminRoutes);
  app.use('/api/v1/broadcast/dispatch',broadcastDispatchRoutes);
  app.use('/api/v1/admin',adminRoutes);
  app.use('/api/v1/admin/events',adminEventsRoutes);
  app.use('/api/v1/admin',bucketAdminRoutes);
  app.use('/api/v1/admin',refreshAdminRoutes);
  app.use('/api/v1/admin/local/images',restaurantImageAdminRoutes);
  app.use('/api/v1/admin/local',localAdminRoutes);
  app.use('/api/v1/admin',ingestAdminRoutes);
  app.use('/api/v1/admin',publishAdminRoutes);
  app.use('/api/v1/admin',shadowAdminRoutes);
  app.use('/api/v1/admin',unifiedAdminRoutes);
  app.use('/api/v1/admin',instagramAdminRoutes);
  app.use('/api/v1/admin',crossAdminRoutes);
  app.use((_req,_res,next)=>next(new HttpError(404,'NOT_FOUND','Endpoint not found')));
  app.use(errorMiddleware);
  return app;
}

async function main(){
  // Hostinger expects a listening socket promptly. Do NOT block listen() on network I/O.
  const httpServer=createServer(makeApp());
  const io=attachWall(httpServer);
  await new Promise<void>((resolve,reject)=>{
    httpServer.once('error',reject);
    httpServer.listen(config.PORT,'0.0.0.0',()=>{
      httpServer.off('error',reject);
      logger.info({port:config.PORT},'API socket listening');
      resolve();
    });
  });
  let shutdownStarted=false;
  let scheduler:SchedulerHandle|null=null;
  // PCI_UPDATE_1: initialization RETRIES instead of leaving the API in 503 until a manual restart.
  void (async()=>{
    for(let attempt=1;!shutdownStarted;attempt++){
      try {
        await pool.query('SELECT 1');
        try {
          await ensureUnifiedSchema();
          logger.info('Unified creator schema verified');
        } catch(err) {
          logger.error({err},'Unified schema verification failed; inspect unified routes');
          console.error('[PCI_SCHEMA_FAILURE] review-schema initialization failed');
        }
        try {
          await ensureEngineSchema();
          logger.info('Engine diagnostics schema verified');
        } catch(err) {
          logger.error({err},'Engine diagnostics schema verification failed');
          console.error('[PCI_SCHEMA_FAILURE] engine diagnostics schema failed');
        }
        try {
          await ensureRegistrySchema();
          logger.info('Registry (bucket) schema verified');
        } catch(err) {
          logger.error({err},'Registry schema verification failed');
          console.error('[PCI_SCHEMA_FAILURE] registry schema failed');
        }
        try {
          await ensureObservationsSchema();
          logger.info('Observations schema verified');
        } catch(err) {
          logger.error({err},'Observations schema verification failed');
          console.error('[PCI_SCHEMA_FAILURE] observations schema failed');
        }
        try {
          await ensurePublicationSchema();
          await ensurePublicSchema();
          logger.info('Publication schema verified');
        } catch(err) {
          logger.error({err},'Publication schema verification failed');
          console.error('[PCI_SCHEMA_FAILURE] publication schema failed');
        }
        try {await ensureCreatorAnalyticsSchema();logger.info('Creator video analytics schema verified');}
        catch(err){logger.error({err},'Creator video analytics schema unavailable; video analytics will show no data');}
        try {await ensureIngestSchema();logger.info('PCI Ingest schema verified');}
        catch(err){logger.error({err},'PCI Ingest schema unavailable; legacy collection remains active');}
        try {await ensureHubSchema();logger.info('PCI Hub schema verified');
          await ensureRestaurantImageSchema().then(()=>logger.info('PCI restaurant image schema verified')).catch(err=>logger.warn({err},'PCI restaurant image schema unavailable'));}
        catch(err){logger.error({err},'PCI Hub schema unavailable; hub monitoring disabled until it is applied');}
        await ensureRedis();
        try{await ensureEventsSchema();logger.info('Events schema verified');}
        catch(err){logger.error({err},'Events schema unavailable; event endpoints may fail until the migration is applied');}
        try{await ensureSatelliteSchema();logger.info('Satellite schema verified');}
        catch(err){logger.error({err},'Satellite schema unavailable; satellite endpoints may fail until migration is applied');}
        try{await ensureSatifySchema();logger.info('Satify Hub schema verified');}
        catch(err){logger.error({err},'Satify Hub schema unavailable; Satify endpoints may fail until it is applied');}
        try{await ensureProgressSchema();logger.info('Progress boards schema verified');}
        catch(err){logger.error({err},'Progress boards schema unavailable; Progress tab saving disabled until it is applied');}
        try{await ensureBroadcastSchema();logger.info('Broadcast schema verified');}
        catch(err){logger.error({err},'Broadcast schema unavailable; broadcast endpoints may fail until migration is applied');}
        pciStartupReady=true;
        logger.info('API server ready');
        if(config.RUN_WORKER_IN_API==='true'){
          try{scheduler=await startScheduler({embedded:true});}
          catch(err){logger.error({err},'Embedded scheduler failed to start');}
        }
        return;
      } catch(err) {
        logger.error({err,attempt},'Backend dependency initialization failed; retrying');
        console.error(`[PCI_STARTUP_FAILURE] database or Redis connection failed (attempt ${attempt}); retrying`);
        await new Promise<void>(resolve=>setTimeout(resolve,Math.min(30000,2000*attempt)));
      }
    }
  })();
  const shutdown=async()=>{
    if(shutdownStarted)return;shutdownStarted=true;
    pciStartupReady=false;
    scheduler?.stop();
    logger.info('Shutting down API');
    const force=setTimeout(()=>process.exit(1),10_000);force.unref();
    await new Promise<void>(resolve=>io.close(()=>resolve()));
    await new Promise<void>(resolve=>httpServer.close(()=>resolve()));
    await Promise.allSettled([pool.end(),redis.quit()]);
    process.exit(0);
  };
  process.on('SIGINT',()=>void shutdown());process.on('SIGTERM',()=>void shutdown());
}
if(process.env.NODE_ENV!=='test')main().catch(e=>{logger.fatal({err:e},'Server startup failed');process.exit(1);});
