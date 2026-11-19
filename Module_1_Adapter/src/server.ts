import {instagramPublicRoutes,instagramAdminRoutes} from './modules/instagram/routes.js';
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
  const origins = new Set([config.PUBLIC_ORIGIN,config.ADMIN_ORIGIN]);
  app.use(cors({origin(origin,cb){if(!origin || origins.has(origin)) cb(null,true);else cb(new HttpError(403,'ORIGIN_DENIED','Origin not allowed'));},credentials:true,allowedHeaders:['Content-Type','Authorization','X-CSRF-Token'],methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS']}));
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
  app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.get('/health/live',(_req,res)=>res.json({status:'alive'}));
  app.get('/health/ready',handler(async(_req,res)=>{
    if (!pciStartupReady) return res.status(503).json({status:'initializing'});
    await pool.query('SELECT 1');await redis.ping();
    res.json({status:'ready'});
  }));
  app.use('/api/v1',publicRoutes);
  app.use('/api/v1',unifiedPublicRoutes);
  app.use('/api/v1',instagramPublicRoutes);
  app.use('/api/v1',crossPublicRoutes);
  app.use('/api/v1/wall/auth',wallAuthRoutes);
  app.use('/api/v1/wall',wallRoutes);
  app.use('/api/v1/admin/auth',adminAuthRoutes);
  app.use('/api/v1/admin',adminRoutes);
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
        await ensureRedis();
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
