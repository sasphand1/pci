import type pg from 'pg';
import {observeArchitecture} from '../../architecture/contracts.js';
import {query,transaction} from '../../lib/db.js';
import {retentionDays} from '../refresh/normalize.js';
import {decideValue,isDiscrepancy,methodOf,validCount,type Precision,type SourceMethod,type Snapshot} from './policy.js';
export {methodOf};

/** Any registered hub source: '<family>.<api|http|manual>' such as youtube.api, google_places.api, commodities.manual. */
export type SourceId=`${string}.${'api'|'http'|'manual'}`;
export type MetricObservation={
  sourceId:SourceId;
  sourceRunRef:string; accountId:string|null;
  /** account, content, comment for creators; place, commodity, trend, city ... for other categories. */
  entityKind:string;
  entityId:string; metric:string; valueNumeric:number|null; valueText:string|null;
  /** Decimal places: real value = valueNumeric / 10^valueScale (0..6, default 0). */
  valueScale?:number;
  accuracy:Precision; observedAt:string; metadata?:Record<string,unknown>;
};
const metricRe=/^[a-z][a-z0-9_]{0,63}$/;
const sourceRe=/^[a-z][a-z0-9_]{1,31}\.(api|http|manual)$/;
const kindRe=/^[a-z][a-z0-9_]{1,31}$/;


/** One canonical writer for API and HTTP fields. Fail-closed input validation. */
export async function recordObservation(input:MetricObservation,client?:pg.PoolClient):Promise<'stored'|'duplicate'|'invalid'> {
  observeArchitecture(input);
  const scale=input.valueScale??0;
  if(!sourceRe.test(input.sourceId)||!kindRe.test(input.entityKind)||!Number.isInteger(scale)||scale<0||scale>6||
    !metricRe.test(input.metric)||!input.entityId||input.entityId.length>300||
    !input.sourceRunRef||input.sourceRunRef.length>200||
    (input.valueNumeric===null&&input.valueText===null)||
    (input.valueNumeric!==null&&!validCount(input.valueNumeric))||
    (input.valueText!==null&&(input.valueText.length===0||input.valueText.length>4000))||
    !Number.isFinite(Date.parse(input.observedAt))||
    Date.parse(input.observedAt)>Date.now()+5*60_000||
    JSON.stringify(input.metadata??{}).length>4000)return 'invalid';
  const write=async(tx:pg.PoolClient):Promise<'stored'|'duplicate'|'invalid'>=>{
    const r=await tx.query(`INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,value_scale,value_text,accuracy,observed_at,raw_metadata)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
      ON CONFLICT(source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING RETURNING id`,[
      input.sourceId,input.sourceRunRef,input.accountId,input.entityKind,input.entityId,input.metric,
      input.valueNumeric,scale,input.valueText,input.accuracy,input.observedAt,JSON.stringify(input.metadata??{})]);
    if(!r.rowCount)return 'duplicate';
    await updateLatest(tx,input);
    return 'stored';
  };
  return client?write(client):transaction(write);
}

async function updateLatest(tx:pg.PoolClient, v:MetricObservation){
  const current=await tx.query(`SELECT l.*,s.method FROM ingest_latest l JOIN ingest_sources s ON s.id=l.source_id
      WHERE l.entity_kind=$1 AND l.entity_id=$2 AND l.metric=$3 FOR UPDATE OF l`,[v.entityKind,v.entityId,v.metric]);
  const last=current.rows[0];
  const candidate:Snapshot={method:methodOf(v.sourceId),
    value:v.valueNumeric??v.valueText!,precision:v.accuracy,observedAt:v.observedAt};
  const prior:Snapshot|null=last?{method:last.method==='http'?'http':'api',
    value:last.value_numeric!==null?Number(last.value_numeric):last.value_text,
    precision:last.accuracy,observedAt:new Date(last.observed_at).toISOString()}:null;
  // Health of the API source for this platform decides whether HTTP may fill in. Fail open to "healthy"
  // (API wins) if the hub tables are not there yet.
  let apiHealthy=true;
  if(candidate.method==='http'&&prior?.method==='api'){
    const platform=v.entityId.split(':')[0];
    try{
      await tx.query('SAVEPOINT hub_health');
      const h=await tx.query<{status:string}>('SELECT status FROM hub_source_health WHERE source_id=$1',[`${platform}.api`]);
      apiHealthy=h.rows[0]?.status!=='down';
      await tx.query('RELEASE SAVEPOINT hub_health');
    }catch{await tx.query('ROLLBACK TO SAVEPOINT hub_health');}
  }
  const decision=decideValue(prior,candidate,Date.now(),{apiHealthy});
  if(decision==='reject_lower_priority'&&prior&&typeof prior.value==='number'&&typeof candidate.value==='number'&&
    isDiscrepancy(prior.value,candidate.value)){
    try{
      await tx.query('SAVEPOINT hub_disc');
      await tx.query('INSERT INTO hub_discrepancies(entity_kind,entity_id,metric,api_value,http_value) VALUES($1,$2,$3,$4,$5)',
        [v.entityKind,v.entityId,v.metric,prior.value,candidate.value]);
      await tx.query('RELEASE SAVEPOINT hub_disc');
    }catch{await tx.query('ROLLBACK TO SAVEPOINT hub_disc');}
  }
  if(decision!=='accept')return;
  await tx.query(`INSERT INTO ingest_latest(entity_kind,entity_id,metric,source_id,value_numeric,value_scale,value_text,accuracy,observed_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
    ON CONFLICT(entity_kind,entity_id,metric) DO UPDATE SET
    source_id=EXCLUDED.source_id,value_numeric=EXCLUDED.value_numeric,value_scale=EXCLUDED.value_scale,value_text=EXCLUDED.value_text,
    accuracy=EXCLUDED.accuracy,observed_at=EXCLUDED.observed_at,updated_at=now()`,[
    v.entityKind,v.entityId,v.metric,v.sourceId,v.valueNumeric,v.valueScale??0,v.valueText,v.accuracy,v.observedAt]);
}

/** Compatibility bridge: set-based mirror, no upstream network calls.
 * Existing metric_observations remain the authoritative ranking inputs until cutover. */
export async function mirrorApiRefresh(runId:string):Promise<{processed:number;stored:number;invalid:number}>{
  return transaction(async tx=>{
    const saved=await tx.query(`INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
      SELECT a.platform||'.api',$1::text,o.account_id,'account',a.platform||':'||a.external_id,
        o.metric,o.value,CASE WHEN o.accuracy='exact' THEN 'exact' ELSE 'rounded' END,
        o.observed_at,'{"origin":"legacy-refresh-bridge"}'::jsonb
      FROM metric_observations o JOIN accounts a ON a.id=o.account_id
      WHERE o.run_id=$1::uuid AND a.platform IN ('youtube','instagram')
      ON CONFLICT(source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING RETURNING id`,[runId]);
    await tx.query(`INSERT INTO ingest_latest
      (entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at)
      SELECT entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at
      FROM ingest_observations WHERE source_run_ref=$1::text AND source_id IN ('youtube.api','instagram.api')
      ON CONFLICT(entity_kind,entity_id,metric) DO UPDATE SET
        source_id=EXCLUDED.source_id,value_numeric=EXCLUDED.value_numeric,value_text=NULL,
        accuracy=EXCLUDED.accuracy,observed_at=EXCLUDED.observed_at,updated_at=now()
      WHERE EXCLUDED.observed_at>=ingest_latest.observed_at`,[runId]);
    await tx.query(`UPDATE ingest_sources s SET last_attempt_at=now(),
       last_success_at=(SELECT max(observed_at) FROM ingest_observations WHERE source_id=s.id AND source_run_ref=$1::text),
       last_error=NULL WHERE s.id IN ('youtube.api','instagram.api')
       AND EXISTS(SELECT 1 FROM ingest_observations WHERE source_id=s.id AND source_run_ref=$1::text)`,[runId]);
    const total=await tx.query<{n:number}>(`SELECT count(*)::int AS n FROM metric_observations
       WHERE run_id=$1::uuid`,[runId]);
    return {processed:total.rows[0]?.n??0,stored:saved.rowCount??0,invalid:0};
  });
}

/** One-time migration bridge: seed the new latest projection from existing recent API
 * observations without consuming additional upstream quota. Idempotent per source run. */
export async function backfillRecentMetrics(days=7):Promise<{processed:number;stored:number}>{
  if(!Number.isSafeInteger(days)||days<1||days>7)throw new Error('INVALID_BACKFILL_DAYS');
  return transaction(async tx=>{
    const added=await tx.query(`INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
      SELECT a.platform||'.api',COALESCE(o.run_id::text,'history:'||o.id::text),o.account_id,'account',
        a.platform||':'||a.external_id,o.metric,o.value,
        CASE WHEN o.accuracy='exact' THEN 'exact' ELSE 'rounded' END,o.observed_at,
        '{"origin":"historical-api-backfill"}'::jsonb
      FROM metric_observations o JOIN accounts a ON a.id=o.account_id
      WHERE a.platform IN ('youtube','instagram') AND o.observed_at>now()-make_interval(days => $1)
      ON CONFLICT(source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING RETURNING id`,[days]);
    await tx.query(`INSERT INTO ingest_latest
      (entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at)
      SELECT DISTINCT ON (entity_kind,entity_id,metric)
        entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at
      FROM ingest_observations WHERE entity_kind='account'
        AND source_id IN ('youtube.api','instagram.api') AND observed_at>now()-make_interval(days => $1)
      ORDER BY entity_kind,entity_id,metric,observed_at DESC
      ON CONFLICT(entity_kind,entity_id,metric) DO UPDATE SET
        source_id=EXCLUDED.source_id,value_numeric=EXCLUDED.value_numeric,value_text=NULL,
        accuracy=EXCLUDED.accuracy,observed_at=EXCLUDED.observed_at,updated_at=now()
      WHERE EXCLUDED.observed_at>=ingest_latest.observed_at`,[days]);
    const processed=await tx.query<{n:number}>(`SELECT count(*)::int AS n FROM metric_observations o
      JOIN accounts a ON a.id=o.account_id
      WHERE a.platform IN ('youtube','instagram') AND o.observed_at>now()-make_interval(days => $1)`,[days]);
    return {processed:processed.rows[0]?.n??0,stored:added.rowCount??0};
  });
}

/** Bulk-project existing YouTube API video snapshots without another YouTube call.
 * Safe to retry: deduplicated observations, timestamp-guarded content updates. */
export async function mirrorVideoSamples():Promise<{processed:number;stored:number}>{
  return transaction(async tx=>{
    // Creators Bucket bootstrap: preserve original timestamps of real, retained API readings.
    // No replay of synthetic data and no extension of the configured YouTube retention.
    const keepDays=Math.min(29,retentionDays('youtube'));
    await tx.query(`INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
      SELECT 'youtube.api','video:'||v.video_id||':'||to_char(h.observed_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS.US'),
      v.account_id,'content','youtube:'||v.video_id,'views',h.view_count,'exact',h.observed_at,
      '{"origin":"retained-video-observation-bridge"}'::jsonb
      FROM creator_video_view_observations h JOIN creator_video_catalogue v ON v.video_id=h.video_id JOIN accounts a ON a.id=v.account_id
      WHERE a.platform='youtube' AND h.observed_at BETWEEN now()-make_interval(days => $1) AND now()
      ON CONFLICT(source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING`,[keepDays]);
    // Legacy channel counts, where genuinely available and fresh, enter the same Hub before reads.
    await tx.query(`INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
      SELECT 'youtube.api','legacy-channel-video-count:'||to_char(s.fetched_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS.US'),
      a.id,'account','youtube:'||a.external_id,'video_count',s.video_count,'exact',s.fetched_at,
      '{"origin":"retained-channel-statistics-bridge"}'::jsonb
      FROM channel_stats_latest s JOIN creators c ON c.id=s.creator_id JOIN accounts a ON a.platform='youtube' AND a.external_id=c.channel_id
      WHERE s.video_count IS NOT NULL AND s.fetched_at BETWEEN now()-interval '7 days' AND now()
      ON CONFLICT(source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING`);
    await tx.query(`INSERT INTO ingest_latest(entity_kind,entity_id,metric,source_id,account_id,value_numeric,accuracy,observed_at)
      SELECT DISTINCT ON(entity_id,metric) entity_kind,entity_id,metric,source_id,account_id,value_numeric,accuracy,observed_at
      FROM ingest_observations WHERE entity_kind='account' AND source_id='youtube.api' AND metric='video_count'
      AND value_numeric IS NOT NULL AND accuracy='exact' AND value_scale=0 AND observed_at BETWEEN now()-interval '7 days' AND now()
      ORDER BY entity_id,metric,observed_at DESC,id DESC
      ON CONFLICT(entity_kind,entity_id,metric) DO UPDATE SET source_id=EXCLUDED.source_id,account_id=EXCLUDED.account_id,
      value_numeric=EXCLUDED.value_numeric,value_text=NULL,value_scale=0,accuracy=EXCLUDED.accuracy,observed_at=EXCLUDED.observed_at,updated_at=now()
      WHERE EXCLUDED.observed_at>=ingest_latest.observed_at`);
    const source=`FROM creator_video_catalogue v JOIN accounts a ON a.id=v.account_id`;
    const filter=`a.platform='youtube' AND v.last_observed_at>now()-interval '48 hours'`;
    const total=await tx.query<{n:number}>(`SELECT count(*)::int AS n ${source} WHERE ${filter}`);
    await tx.query(`INSERT INTO ingest_content
      (platform,content_id,account_id,content_type,title,caption,duration_iso,url,thumbnail_url,published_at,source_id,last_observed_at)
      SELECT 'youtube',v.video_id,v.account_id,'video',v.title,v.description,v.duration_iso,
      'https://www.youtube.com/watch?v='||v.video_id,v.thumbnail_url,v.published_at,
      'youtube.api',v.last_observed_at ${source} WHERE ${filter}
      ON CONFLICT(platform,content_id) DO UPDATE SET
      account_id=EXCLUDED.account_id,title=EXCLUDED.title,
      caption=EXCLUDED.caption,duration_iso=EXCLUDED.duration_iso,url=EXCLUDED.url,
      thumbnail_url=COALESCE(EXCLUDED.thumbnail_url,ingest_content.thumbnail_url),
      published_at=COALESCE(EXCLUDED.published_at,ingest_content.published_at),
      last_observed_at=EXCLUDED.last_observed_at
      WHERE EXCLUDED.last_observed_at >= ingest_content.last_observed_at`);
    const inserted=await tx.query(`INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
      SELECT 'youtube.api','video:'||v.video_id||':'||to_char(v.last_observed_at AT TIME ZONE 'UTC','YYYYMMDDHH24MISS.US'),
      v.account_id,'content','youtube:'||v.video_id,metric.field,metric.metric_value,'exact',v.last_observed_at,
      '{"origin":"legacy-video-bridge"}'::jsonb ${source}
      CROSS JOIN LATERAL (VALUES ('views',v.view_count),('likes',v.like_count),('comments',v.comment_count)) AS metric(field,metric_value)
      WHERE ${filter} AND metric.metric_value IS NOT NULL
      ON CONFLICT(source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING RETURNING id`);
    await tx.query(`INSERT INTO ingest_latest
      (entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at)
      SELECT DISTINCT ON (entity_kind,entity_id,metric) entity_kind,entity_id,metric,source_id,
        value_numeric,accuracy,observed_at FROM ingest_observations
      WHERE source_id='youtube.api' AND entity_kind='content' AND metric IN ('views','likes','comments') AND observed_at>now()-interval '48 hours'
      ORDER BY entity_kind,entity_id,metric,observed_at DESC
      ON CONFLICT(entity_kind,entity_id,metric) DO UPDATE SET
      source_id=EXCLUDED.source_id,value_numeric=EXCLUDED.value_numeric,value_text=NULL,
      accuracy=EXCLUDED.accuracy,observed_at=EXCLUDED.observed_at,updated_at=now()
      WHERE EXCLUDED.observed_at>=ingest_latest.observed_at`);
    if(inserted.rowCount)await tx.query(`UPDATE ingest_sources SET last_attempt_at=now(),last_success_at=now(),last_error=NULL WHERE id='youtube.api'`);
    return {processed:total.rows[0]?.n??0,stored:inserted.rowCount??0};
  });
}

export async function ingestStatus(){
  const [sources,counts,coverage]=await Promise.all([
    query(`SELECT id,platform,method,enabled,last_success_at AS "lastSuccessAt",last_error AS "lastError" FROM ingest_sources ORDER BY id`),
    query(`SELECT (SELECT count(*)::int FROM ingest_observations) AS observations,
      (SELECT count(*)::int FROM ingest_latest) AS latest,
      (SELECT count(*)::int FROM ingest_content) AS content`),
    query(`SELECT platform,count(*)::int AS accounts FROM accounts GROUP BY platform ORDER BY platform`)
  ]);
  return {sources:sources.rows,counts:counts.rows[0],registeredAccounts:coverage.rows,
    note:'Historical observations and verified latest values; HTTP adapters disabled until validated and permitted.'};
}
