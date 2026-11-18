import {instagramPublicRoutes,instagramAdminRoutes} from './modules/instagram/routes.js';
import {crossPublicRoutes,crossAdminRoutes} from './modules/cross-platform/routes.js';
import {unifiedPublicRoutes,unifiedAdminRoutes} from './modules/unified/routes.js';
import { createServer } from 'node:http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { config } from './lib/config.js';
import { pool } from './lib/db.js';
import { redis, ensureRedis } from './lib/redis.js';
import { logger, requestId, errorMiddleware, HttpError, handler } from './lib/errors.js';
import { publicRoutes } from './modules/creators/public.js';
import { adminRoutes } from './modules/admin/routes.js';
import { adminAuthRoutes, wallAuthRoutes } from './modules/auth/auth.js';
import { attachWall, wallRoutes } from './modules/wall/service.js';
import {boundedLimit} from './lib/redis.js';
import {pseudonym} from './lib/security.js';

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
  app.use('/api/v1',handler(async(req,_res,next)=>{
    const key=`http:global:${pseudonym(req.ip??'unknown')}`;
    if(!await boundedLimit(key,300,60))throw new HttpError(429,'RATE_LIMIT','Request limit exceeded');
    next();
  }));
  app.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');next();});
  app.get('/health/live',(_req,res)=>res.json({status:'alive'}));
  app.get('/health/ready',handler(async(_req,res)=>{
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
  await pool.query('SELECT 1');await ensureRedis();
  const httpServer=createServer(makeApp());
  const io=attachWall(httpServer);
  httpServer.listen(config.PORT,'0.0.0.0',()=>logger.info({port:config.PORT},'API server ready'));
  let shutdownStarted=false;
  const shutdown=async()=>{
    if(shutdownStarted)return;shutdownStarted=true;
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
