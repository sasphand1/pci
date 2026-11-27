import {ensureScrappaSchema} from './modules/scrappa/admin.js';
import {ensureSatelliteSchema} from './lib/satellite-schema.js';
import {ensureSatifySchema} from './lib/satify-schema.js';
import {ensureEventsSchema} from './lib/events-schema.js';
import { ensureRedis,redis } from './lib/redis.js';
import { pool } from './lib/db.js';
import { logger } from './lib/errors.js';
import { ensureUnifiedSchema } from './lib/unified-schema.js';
import { ensureEngineSchema } from './lib/engine-schema.js';
import { ensureRegistrySchema } from './lib/registry-schema.js';
import { ensureObservationsSchema } from './lib/observations-schema.js';
import { ensureCreatorAnalyticsSchema } from './lib/creator-analytics-schema.js';
import {ensureIngestSchema} from './lib/ingest-schema.js';
import {ensureHubSchema} from './lib/hub-schema.js';
import { ensurePublicationSchema } from './lib/publication-schema.js';
import { ensurePublicSchema } from './lib/public-schema.js';
import { startScheduler } from './modules/sync/scheduler.js';

// PCI Update 1: the scheduling logic now lives in modules/sync/scheduler.ts so the API process
// can host it too (RUN_WORKER_IN_API=true). This file remains the standalone worker entry point.
async function main(){
 await pool.query('SELECT 1');await ensureRedis();
 try{await ensureUnifiedSchema();}catch(err){logger.error({err},'Unified schema verification failed in worker');}
 try{await ensureEngineSchema();}catch(err){logger.error({err},'Engine schema verification failed in worker');}
 try{await ensureRegistrySchema();await ensureObservationsSchema();await ensurePublicationSchema();await ensurePublicSchema();}catch(err){logger.error({err},'Registry/observations schema verification failed in worker');}
 try{await ensureCreatorAnalyticsSchema();}catch(err){logger.error({err},'Creator video analytics schema unavailable');}
 try{await ensureIngestSchema();}catch(err){logger.error({err},'PCI Ingest schema unavailable; legacy collection remains active');}
 try{await ensureHubSchema();}catch(err){logger.error({err},'PCI Hub schema unavailable; hub monitoring disabled');}
 try{await ensureScrappaSchema();}catch(err){logger.warn({err},'Scrappa schema unavailable in worker');}
 try{await ensureSatelliteSchema();}catch(err){logger.error({err},'Satellite schema initialization failed in worker');}
 try{await ensureSatifySchema();}catch(err){logger.error({err},'Satify Hub schema initialization failed in worker');}
 try{await ensureEventsSchema();}catch(err){logger.error({err},'Event sources schema initialization failed in worker');}
 const scheduler=await startScheduler({embedded:false});
 logger.info({workerId:scheduler.workerId},'Worker ready');
 const stop=async()=>{scheduler.stop();await redis.quit();await pool.end();process.exit(0);};
 process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
}
main().catch(e=>{logger.fatal({err:e},'worker startup failed');process.exit(1);});
