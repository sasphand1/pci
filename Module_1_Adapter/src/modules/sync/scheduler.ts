import {syncApprovedEventSources} from '../events/service.js';
import {classifyPendingEvents} from '../events/intelligence.js';
import cron from 'node-cron';
import {satelliteTick} from '../satellite/service.js';
import os from 'node:os';
import {syncInstagramProfiles} from '../instagram/service.js';
import {bustPublicCache} from '../../lib/redis.js';
import {config} from '../../lib/config.js';
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {recoverStalledRuns} from '../refresh/service.js';
import {runHubRetention,runRetention} from '../refresh/retention.js';
import {startPipeline} from '../publish/pipeline.js';
import {collectCreatorVideoSnapshots} from '../creator-analytics/videos.js';
import {mirrorVideoSamples} from '../ingest/store.js';
import {runHubCheck} from '../ingest/monitor.js';
import {fillInstagramAvatars} from '../ingest/avatar-fill.js';
import {fillGraphInstagramAvatars} from '../ingest/graph-avatar-fill.js';
import {cacheInstagramAvatars} from '../ingest/avatar-cache.js';
import {collectLocalPlaces} from '../local/collect.js';
import {fillRestaurantHttpPhotos} from '../local/image-autofill.js';
import {pruneRankRuns} from '../publish/service.js';
import {cleanupRetention,enqueueSync,ensureFreshness,recoverStalledJobs,takeNextJob,performSync} from './service.js';

/** PCI Update 1: the scheduler used by BOTH the standalone worker (src/worker.ts) and, when
 * RUN_WORKER_IN_API=true, the API process (for hosts that can only run one Node process).
 * Run exactly one of the two: the existing advisory locks protect against overlap, but a single
 * owner is simpler to operate. Behaviour of the original worker is preserved. */
export type SchedulerHandle={stop:()=>void;workerId:string};
export async function startScheduler(opts:{embedded:boolean}):Promise<SchedulerHandle>{
 const kind=opts.embedded?'embedded':'worker';
 const workerId=`${kind}:${os.hostname()}:${process.pid}`;
 const tasks:Array<{stop:()=>unknown}>=[];
 const timers:NodeJS.Timeout[]=[];
 let running=false,stopped=false;
 // PCI_ZIP_4: the old sync feeds nothing any more. It runs only if PCI_LEGACY_SYNC=true (rollback).
 const legacySync=()=>process.env.PCI_LEGACY_SYNC==='true';
 const syncOn=()=>legacySync()&&config.YOUTUBE_SYNC_ENABLED==='true';
 const scheduleEnabled=async()=>(await query("SELECT value FROM app_settings WHERE key='sync_schedule_enabled'")).rows[0]?.value!==false;

 async function processQueue(){
   if(stopped||running||!syncOn())return;
   running=true;
   try{const job=await takeNextJob();if(job)await performSync(job);}
   catch(e){logger.error({err:e},'worker poll failed');}
   finally{running=false;}
 }
 async function heartbeat(){
   try{
     await query(`INSERT INTO worker_heartbeats(worker_id,kind,last_seen_at,detail) VALUES($1,$2,now(),$3::jsonb)
       ON CONFLICT(worker_id) DO UPDATE SET last_seen_at=now(),detail=EXCLUDED.detail`,
       [workerId,kind,JSON.stringify({syncEnabled:syncOn(),youtubeKeyConfigured:!!config.YOUTUBE_API_KEY,instagramSyncEnabled:process.env.INSTAGRAM_SYNC_ENABLED==='true'})]);
   }catch(e){logger.warn({err:e},'worker heartbeat failed (run migration 091 or restart the API once)');}
 }
 async function freshness(){
   if(!syncOn())return;
   try{
     const r=await ensureFreshness({includeStale:await scheduleEnabled()});
     if(r.queued)logger.info(r,'Freshness check queued a YouTube sync');
   }catch(e){logger.error({err:e},'freshness check failed');}
 }

 await recoverStalledJobs();
 await recoverStalledRuns().catch(e=>logger.warn({err:e},'refresh run recovery skipped (tables may not exist yet)'));
 try{await query("DELETE FROM worker_heartbeats WHERE last_seen_at<now()-interval '7 days'");}catch{/* table may not exist yet */}
 await heartbeat();
 await freshness();
 // Bootstrap the newly enabled video catalogue immediately after deployment,
 // rather than requiring a full day to elapse before a provisional estimate exists.
 // The database freshness check prevents repeated high-quota video collection on restarts.
 async function refreshCreatorVideoSamples(){
   try{
     // Refresh when ANY tracked YouTube account has no recent sample, not merely
     // when the entire catalogue is empty. Keeps partial failures visible/retryable.
     const pending=await query<{missing:number}>(`SELECT count(*)::int AS missing FROM accounts a
       WHERE a.platform='youtube' AND a.external_id ~ '^UC[A-Za-z0-9_-]{22}$'
         AND NOT EXISTS(SELECT 1 FROM creator_video_catalogue v WHERE v.account_id=a.id
           AND v.last_observed_at>now()-interval '20 hours')`);
     if(!(Number(pending.rows[0]?.missing)>0))return;
     const result=await collectCreatorVideoSnapshots();
     try{await mirrorVideoSamples();}catch(err){logger.warn({err},'Ingest video mirror unavailable');}
     logger.info({...result,pendingAccounts:pending.rows[0].missing},'Creator earnings video sample refresh');
   }catch(err){logger.warn({err},'Creator video sample refresh unavailable');}
 }
 void refreshCreatorVideoSamples();
 logger.info({workerId,syncEnabled:syncOn()},'Scheduler started');
 if(!syncOn())logger.warn('YOUTUBE_SYNC_ENABLED is not true: queued syncs will NOT be processed');

 tasks.push(cron.schedule('* * * * *',async()=>{
   try{
     if(!syncOn())return;
     const r=await query("SELECT key,value FROM app_settings WHERE key IN ('sync_schedule_enabled','sync_schedule_time')");
     const values=Object.fromEntries(r.rows.map((x:{key:string,value:unknown})=>[x.key,x.value]));
     const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Karachi'}).format(new Date());
     if(values.sync_schedule_enabled!==false&&time===(values.sync_schedule_time??'09:00'))await enqueueSync('scheduled');
   }catch(e){logger.error({err:e},'schedule failed');}
 },{timezone:'Asia/Karachi'}));
 // Satellite jobs are claimed in PostgreSQL; frequent polling reduces queue latency.
 tasks.push(cron.schedule('* * * * *',()=>void satelliteTick()));
 void satelliteTick();
 tasks.push(cron.schedule('30 7 * * *',()=>{
   void syncApprovedEventSources().catch(err=>
     logger.error({err},'Daily event sync failed')
   );
 },{timezone:'Asia/Karachi'}));
 tasks.push(cron.schedule('20 4 * * *',()=>query("DELETE FROM satellite.observations WHERE observed_at<now()-interval '90 days'").catch(err=>logger.warn({err},'Satellite retention cleanup unavailable')),{timezone:'Asia/Karachi'}));
 tasks.push(cron.schedule('15 */6 * * *',()=>{void classifyPendingEvents(100).catch(err=>logger.warn({err},'Events backfill skipped'));},{timezone:'Asia/Karachi'}));
 tasks.push(cron.schedule('*/10 * * * *',()=>recoverStalledJobs().catch(e=>logger.error({err:e},'stalled job recovery failed'))));
 tasks.push(cron.schedule('*/10 * * * *',()=>recoverStalledRuns().catch(e=>logger.error({err:e},'stalled refresh recovery failed'))));
 tasks.push(cron.schedule('*/15 * * * *',()=>void freshness()));
 // PCI Hub Monitor: source health, freshness, quota and coverage alerts.
 // Web picture fill for Instagram accounts the API left without one: every 2 hours, 5 accounts, off unless enabled.
 tasks.push(cron.schedule('0 */2 * * *',()=>{void fillInstagramAvatars({limit:5}).catch(err=>logger.warn({err},'Avatar fill unavailable'));}));
 // Official Meta picture recovery, optional, serialized by PostgreSQL lock and cooldown.
 // Set PCI_INSTAGRAM_GRAPH_AVATARS_AUTOFILL=true only when the Meta owner/token are configured.
 tasks.push(cron.schedule('30 */2 * * *',()=>{
   if(process.env.PCI_INSTAGRAM_GRAPH_AVATARS_AUTOFILL!=='true')return;
   void fillGraphInstagramAvatars({limit:5}).then(r=>logger.info({status:r.status,reason:r.reason,tried:r.tried,filled:r.filled},'Meta avatar recovery')).catch(err=>logger.warn({err},'Meta avatar recovery unavailable'));
 }));
 // Keep our own copy of Instagram pictures (image servers only, no Meta API quota).
 tasks.push(cron.schedule('10,40 * * * *',()=>{void cacheInstagramAvatars({limit:20}).catch(err=>logger.warn({err},'Avatar cache unavailable'));}));
 // Independent HTTP photo worker: bounded batches, no public visitor triggers.
 const httpPhotos=()=>{if(stopped||process.env.PCI_RESTAURANT_HTTP_AUTOFILL!=='true')return;void fillRestaurantHttpPhotos().then(r=>logger.info(r,'Restaurant HTTP photo collection')).catch(err=>logger.warn({err},'Restaurant HTTP photo collection failed'));};
 tasks.push(cron.schedule('5 */2 * * *',httpPhotos));
 httpPhotos();
 // Weekly Top 20 restaurants for Karachi, Lahore and Islamabad (Google Places). Needs GOOGLE_PLACES_API_KEY; off unless PCI_LOCAL_PLACES_AUTOFILL=true.
 tasks.push(cron.schedule('0 3 * * 1',()=>{if(process.env.PCI_LOCAL_PLACES_AUTOFILL!=='true')return;void collectLocalPlaces().then(r=>logger.info(r,'Local places collection')).catch(err=>logger.warn({err},'Local places collection unavailable'));},{timezone:'Asia/Karachi'}));
 tasks.push(cron.schedule('*/15 * * * *',()=>{void runHubCheck().catch(err=>logger.warn({err},'Hub check unavailable'));}));
 tasks.push(cron.schedule('15 */6 * * *',()=>{void refreshCreatorVideoSamples();},{timezone:'Asia/Karachi'}));
 tasks.push(cron.schedule('30 4 * * *',()=>runRetention().then(r=>logger.info(r,'Observation retention done')).then(()=>runHubRetention()).then(r=>logger.info(r,'Hub retention done')).then(()=>pruneRankRuns()).catch(e=>logger.error({err:e},'observation retention failed')),{timezone:'Asia/Karachi'}));
 // PCI_ZIP_3: the daily pipeline (refresh, rank, publish) with no approval step. Set PCI_PIPELINE_DAILY=false to switch it off.
 tasks.push(cron.schedule('0 9 * * *',async()=>{
   if(process.env.PCI_PIPELINE_DAILY==='false')return;
   try{const r=await startPipeline('scheduled',null);logger.info(r,'Daily pipeline requested');}
   catch(err){logger.error({err},'Daily pipeline failed to start');}
 },{timezone:'Asia/Karachi'}));
 tasks.push(cron.schedule('0 4 * * *',()=>cleanupRetention().catch(e=>logger.error({err:e},'retention failed')),{timezone:'Asia/Karachi'}));
 // Instagram sync is independent of YouTube's enable switch and schedule.
 tasks.push(cron.schedule('0 9,21 * * *',async()=>{
   if(!legacySync()||process.env.INSTAGRAM_SYNC_ENABLED!=='true')return;
   try{await syncInstagramProfiles();await bustPublicCache();}
   catch(err){logger.error({err},'Instagram sync failed');}
 },{timezone:'Asia/Karachi'}));

 await cleanupRetention().catch(e=>logger.error({err:e},'retention failed'));
 await processQueue();
 timers.push(setInterval(()=>void processQueue(),10000));
 timers.push(setInterval(()=>void heartbeat(),15000));
 return {workerId,stop:()=>{stopped=true;tasks.forEach(t=>t.stop());timers.forEach(clearInterval);}};
}
