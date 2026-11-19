import cron from 'node-cron';
import {syncInstagramProfiles} from './modules/instagram/service.js';
import {bustPublicCache} from './lib/redis.js';
import { config } from './lib/config.js';
import { pool } from './lib/db.js';
import { ensureRedis,redis } from './lib/redis.js';
import { cleanupRetention,enqueueSync,recoverStalledJobs,takeNextJob,performSync } from './modules/sync/service.js';
import { logger } from './lib/errors.js';

let running=false;
async function processQueue(){
 if(running || config.YOUTUBE_SYNC_ENABLED!=='true')return;
 running=true;
 try{const job=await takeNextJob();if(job)await performSync(job);}catch(e){logger.error({err:e},'worker poll failed');}finally{running=false;}
}
async function main(){
 await pool.query('SELECT 1');await ensureRedis();await recoverStalledJobs();
 logger.info('Worker ready');
 // PCI_BACKFILL_UNSYNCED_V2: one startup job if any enabled channel lacks snapshots.
 if(config.YOUTUBE_SYNC_ENABLED==='true'){
   const gaps=await pool.query(`SELECT count(*)::int AS n FROM creators c
     LEFT JOIN channel_stats_latest s ON s.creator_id=c.id
     WHERE c.enabled=true AND s.creator_id IS NULL`);
   const missing=Number(gaps.rows[0]?.n??0);
   if(missing>0){await enqueueSync('scheduled');logger.info({missing},'Queued missing channel snapshot backfill');}
 }
 if(config.YOUTUBE_SYNC_ENABLED==='true' && (await pool.query("SELECT value FROM app_settings WHERE key='sync_schedule_enabled'")).rows[0]?.value!==false){
   const state=await pool.query("SELECT published_at FROM publication_state WHERE id=true");
   const published=state.rows[0]?.published_at ? new Date(state.rows[0].published_at).getTime() : 0;
   if(Date.now()-published>24*60*60*1000)await enqueueSync('scheduled');
 }
 cron.schedule('* * * * *',async()=>{
   try{
     if(config.YOUTUBE_SYNC_ENABLED!=='true')return;
     const r=await pool.query("SELECT key,value FROM app_settings WHERE key IN ('sync_schedule_enabled','sync_schedule_time')");
     const values=Object.fromEntries(r.rows.map((x:{key:string,value:unknown})=>[x.key,x.value]));
     const now=new Date();const time=new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'Asia/Karachi'}).format(now);
     if(values.sync_schedule_enabled!==false && time===(values.sync_schedule_time??'09:00'))await enqueueSync('scheduled');
   }catch(e){logger.error({err:e},'schedule failed');}
 },{timezone:'Asia/Karachi'});
 cron.schedule('*/10 * * * *',()=>recoverStalledJobs().catch(e=>logger.error({err:e},'stalled job recovery failed')));
 cron.schedule('0 4 * * *',()=>cleanupRetention().catch(e=>logger.error({err:e},'retention failed')),{timezone:'Asia/Karachi'});
 // Instagram sync is independent of YouTube's enable switch and schedule.
 cron.schedule('0 9,21 * * *',async()=>{
  if(process.env.INSTAGRAM_SYNC_ENABLED!=='true')return;
  try{await syncInstagramProfiles();await bustPublicCache();}
  catch(err){logger.error({err},'Instagram sync failed');}
 },{timezone:'Asia/Karachi'});
 await cleanupRetention();
 await processQueue();
 const timer=setInterval(()=>void processQueue(),10000);
 const stop=async()=>{clearInterval(timer);await redis.quit();await pool.end();process.exit(0);};
 process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
}
main().catch(e=>{logger.fatal({err:e},'worker startup failed');process.exit(1);});
