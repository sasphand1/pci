import nodemailer from 'nodemailer';
import {query} from '../../lib/db.js';
import {config} from '../../lib/config.js';
import {logger} from '../../lib/errors.js';
import {redis} from '../../lib/redis.js';
import {evaluateCoverage,evaluateQuota,evaluateSource,hubKey,type HubAlert} from './monitor-rules.js';

/** Record the outcome of one collection attempt for a source. Never throws. */
export async function reportSourceResult(sourceId:string,ok:boolean,errorCode?:string):Promise<void> {
  try {
    if(ok){
      await query(`UPDATE ingest_sources SET last_attempt_at=now(),last_success_at=now(),last_error=NULL WHERE id=$1`,[sourceId]);
      await query(`INSERT INTO hub_source_health(source_id,status,consecutive_failures,last_error_code,checked_at)
        VALUES($1,'ok',0,NULL,now()) ON CONFLICT(source_id) DO UPDATE SET consecutive_failures=0,last_error_code=NULL,
        status=CASE WHEN hub_source_health.status='down' THEN 'degraded' ELSE hub_source_health.status END,checked_at=now()`,[sourceId]);
    }else{
      await query(`UPDATE ingest_sources SET last_attempt_at=now(),last_error=$2 WHERE id=$1`,[sourceId,(errorCode??'ERROR').slice(0,80)]);
      await query(`INSERT INTO hub_source_health(source_id,status,consecutive_failures,last_error_code,checked_at)
        VALUES($1,'degraded',1,$2,now()) ON CONFLICT(source_id) DO UPDATE SET
        consecutive_failures=hub_source_health.consecutive_failures+1,last_error_code=EXCLUDED.last_error_code,checked_at=now()`,
        [sourceId,(errorCode??'ERROR').slice(0,80)]);
    }
  } catch(err){logger.warn({err,sourceId},'hub source result not recorded');}
}

async function sendAlertMail(a:HubAlert,scope:string):Promise<void> {
  const to=process.env.HUB_ALERT_EMAIL;
  if(!to||!config.SMTP_HOST)return;
  try {
    const t=nodemailer.createTransport({host:config.SMTP_HOST,port:config.SMTP_PORT,secure:config.SMTP_PORT===465,
      auth:config.SMTP_USER?{user:config.SMTP_USER,pass:config.SMTP_PASS}:undefined});
    await t.sendMail({from:config.SMTP_FROM,to,subject:`[PCI Hub] ${a.severity.toUpperCase()}: ${a.kind} (${scope})`,text:a.message});
  } catch(err){logger.warn({err},'hub alert email failed');}
}

/** Make the open alerts for a scope equal the desired set: open new ones, resolve cleared ones. */
export async function syncAlerts(scope:string,sourceId:string|null,desired:HubAlert[],managedKinds:string[]):Promise<number> {
  let opened=0;
  const wanted=new Set(desired.map(a=>hubKey(scope,a.kind)));
  for(const a of desired){
    const key=hubKey(scope,a.kind);
    const r=await query(`INSERT INTO pipeline_alerts(kind,scope,message,source_id,severity,hub_key)
      SELECT $1,$2,$3,$4,$5,$6 WHERE NOT EXISTS(SELECT 1 FROM pipeline_alerts WHERE hub_key=$6 AND NOT acknowledged) RETURNING id`,
      [`hub_${a.kind}`,scope,a.message.slice(0,500),sourceId,a.severity,key]);
    if(r.rowCount){opened++;if(a.severity==='critical')await sendAlertMail(a,scope);}
  }
  for(const kind of managedKinds){
    const key=hubKey(scope,kind);
    if(wanted.has(key))continue;
    await query(`UPDATE pipeline_alerts SET acknowledged=true,resolved_at=now() WHERE hub_key=$1 AND NOT acknowledged`,[key]);
  }
  return opened;
}
const SOURCE_KINDS=['no_data','stale','endpoint_changed','blocked','quota','source_failing'];

export async function runHubCheck():Promise<{sources:number;alertsOpened:number}> {
  const job=await query<{id:string}>(`INSERT INTO ingest_jobs(source_id,trigger,status,started_at) VALUES('youtube.api','system','running',now()) RETURNING id`);
  const jobId=job.rows[0].id;
  let opened=0,n=0;
  await query(`DELETE FROM ingest_jobs WHERE trigger='system' AND created_at<now()-interval '14 days'`).catch(()=>undefined);
  try {
    const src=await query<{id:string;method:'api'|'http';enabled:boolean;last_success_at:string|null;cf:number|null;code:string|null}>(
      `SELECT s.id,s.method,s.enabled,s.last_success_at,h.consecutive_failures AS cf,h.last_error_code AS code
       FROM ingest_sources s LEFT JOIN hub_source_health h ON h.source_id=s.id ORDER BY s.id`);
    const now=Date.now();
    for(const s of src.rows){
      n++;
      const ev=evaluateSource({id:s.id,method:s.method,enabled:s.enabled,lastSuccessAt:s.last_success_at,
        consecutiveFailures:s.cf??0,lastErrorCode:s.code,now,checkFreshness:s.method==='api'});
      const extra:HubAlert[]=[];
      if(s.id==='youtube.api'&&s.enabled){
        const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
        try{const used=Number(await redis.get(`youtube:daily:${day}`)??0);const q=evaluateQuota(used,config.YOUTUBE_DAILY_SOFT_LIMIT);if(q)extra.push(q);}catch{/* Redis optional */}
      }
      opened+=await syncAlerts(s.id,s.id,[...ev.alerts,...extra],SOURCE_KINDS);
      await query(`INSERT INTO hub_source_health(source_id,status,consecutive_failures,checked_at) VALUES($1,$2,0,now())
        ON CONFLICT(source_id) DO UPDATE SET status=$2,checked_at=now()`,[s.id,ev.status]);
    }
    const cov=await query<{platform:string;registered:number;fresh:number}>(`SELECT a.platform,count(*)::int AS registered,
      count(*) FILTER (WHERE EXISTS(SELECT 1 FROM metric_observations o WHERE o.account_id=a.id AND o.metric='followers'
        AND o.observed_at>now()-interval '48 hours'))::int AS fresh FROM accounts a GROUP BY a.platform`);
    for(const c of cov.rows){
      const a=evaluateCoverage(c.platform,c.registered,c.fresh);
      opened+=await syncAlerts(`coverage:${c.platform}`,`${c.platform}.api`,a?[a]:[],['coverage_low']);
    }
    await query(`UPDATE ingest_jobs SET status='succeeded',finished_at=now(),observations=0 WHERE id=$1`,[jobId]);
  } catch(err){
    await query(`UPDATE ingest_jobs SET status='failed',finished_at=now(),error_code=$2 WHERE id=$1`,[jobId,'MONITOR_ERROR']).catch(()=>undefined);
    throw err;
  }
  return {sources:n,alertsOpened:opened};
}
