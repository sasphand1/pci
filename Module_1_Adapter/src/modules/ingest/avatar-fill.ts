import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {boundedLimit} from '../../lib/redis.js';
import {probeInstagramAvatar,type AvatarProbe} from './http.js';
import {recordObservation} from './store.js';
import {reportSourceResult} from './monitor.js';
import {avatarRetryHours,shouldPauseSource} from './monitor-rules.js';

export type FillResult={status:'skipped'|'done';reason?:string;tried:number;filled:number;failed:number;stoppedEarly:boolean};
const skip=(reason:string):FillResult=>({status:'skipped',reason,tried:0,filled:0,failed:0,stoppedEarly:false});
type Deps={probe?:(handle:string)=>Promise<AvatarProbe>;sleep?:(ms:number)=>Promise<void>};

/** Fills missing Instagram pictures from public pages. The official API always wins: only accounts
 * without a stored picture are touched, and a later API refresh may replace what is stored here.
 * Slow by design: few accounts per run, a pause between requests, one retry window per account,
 * and a circuit breaker that rests the source after repeated failures. */
export async function fillInstagramAvatars(opts:{limit?:number}&Deps={}):Promise<FillResult> {
  if(process.env.PCI_INSTAGRAM_HTTP_AVATARS!=='true')return skip('env_flag_off');
  const src=await query<{enabled:boolean;cf:number|null;checked_at:string|null}>(
    `SELECT s.enabled,h.consecutive_failures AS cf,h.checked_at FROM ingest_sources s
     LEFT JOIN hub_source_health h ON h.source_id=s.id WHERE s.id='instagram.http'`);
  const row=src.rows[0];
  if(!row?.enabled)return skip('source_disabled');
  if(shouldPauseSource(row.cf??0,row.checked_at,Date.now()))return skip('paused_after_failures');
  const limit=Math.min(10,Math.max(1,Math.trunc(opts.limit??5)));
  const probe=opts.probe??((h:string)=>probeInstagramAvatar(h));
  const sleep=opts.sleep??((ms:number)=>new Promise<void>(r=>setTimeout(r,ms)));
  const cand=await query<{id:string;handle:string;external_id:string;attempts:number|null}>(
    `SELECT a.id,a.handle,a.external_id,t.attempts FROM accounts a
     LEFT JOIN hub_avatar_attempts t ON t.account_id=a.id
     WHERE a.platform='instagram' AND a.avatar_url IS NULL
       AND (t.last_attempt_at IS NULL OR t.last_attempt_at < now() - make_interval(hours => CASE WHEN t.attempts>=3 THEN 168 ELSE 24 END))
     ORDER BY t.last_attempt_at NULLS FIRST, a.id LIMIT $1`,[limit]);
  const out:FillResult={status:'done',tried:0,filled:0,failed:0,stoppedEarly:false};
  let streak=0;
  for(const a of cand.rows){
    try{if(!(await boundedLimit(`ingest:igavatar:${a.id}`,2,86400)))continue;}
    catch{return {...out,status:'skipped',reason:'limiter_unavailable'};}
    if(out.tried>0)await sleep(3000+Math.floor(Math.random()*3000));
    out.tried++;
    const r=await probe(a.handle);
    if(r.error==='DISABLED'){out.tried--;return {...out,status:'skipped',reason:'env_flag_off'};}
    await query(`INSERT INTO hub_avatar_attempts(account_id,attempts,last_attempt_at,last_result) VALUES($1,1,now(),$2)
      ON CONFLICT(account_id) DO UPDATE SET attempts=hub_avatar_attempts.attempts+1,last_attempt_at=now(),last_result=EXCLUDED.last_result`,
      [a.id,r.url?'ok':(r.error??'none')]);
    if(r.url){
      const u=await query(`UPDATE accounts SET avatar_url=$2 WHERE id=$1 AND avatar_url IS NULL RETURNING id`,[a.id,r.url]);
      if(u.rowCount){
        out.filled++;
        await recordObservation({sourceId:'instagram.http',sourceRunRef:`avatar:${a.id}:${new Date().toISOString()}`,
          accountId:a.id,entityKind:'account',entityId:`instagram:${a.external_id}`,metric:'avatar_url',
          valueNumeric:null,valueText:r.url,accuracy:'exact',observedAt:new Date().toISOString(),
          metadata:{method:'public-og-image',identityMatch:true}}).catch(err=>logger.warn({err},'avatar observation not recorded'));
      }
      await reportSourceResult('instagram.http',true);
      streak=0;
      continue;
    }
    if(r.error==='INVALID')continue; // bad handle in our registry: not the source's fault
    out.failed++;streak++;
    await reportSourceResult('instagram.http',false,r.error??'UNAVAILABLE');
    if(streak>=2){out.stoppedEarly=true;break;}
  }
  return out;
}
