/** Satellite / Earth data goes into the one PCI hub as its own sub-bucket (category 'satellite').
 * The satellite tables keep the full detail for the Satellite page; the hub keeps the comparable
 * numbers (city readings, river flow, alerts, indices) next to creators, places and everything else.
 * A hub write never fails a satellite collection: it is logged and retried on the next run. */
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {reportSourceResult} from '../ingest/monitor.js';
import type {SatelliteBatchObservation} from './bulk.mjs';
import {hubReadings,hubSourceId,KIND,METRIC,type HubReading} from './hub-map.js';
export {hubReadings,hubSourceId};

/** Batched insert into the hub (observations + latest), deduplicated per source/run/entity/metric. */
export async function writeHub(provider:string,rows:SatelliteBatchObservation[]):Promise<number>{
 return writeHubReadings(hubSourceId(provider),hubReadings(provider,rows));
}
/** Writes already-mapped readings (also used for the combined scores source). */
export async function writeHubReadings(source:string,all:HubReading[]):Promise<number>{
 const readings=all.filter(x=>KIND.test(x.entityKind)&&METRIC.test(x.metric)&&x.entityId.length<=300&&(x.value!==null||x.text!==null)&&Number.isFinite(Date.parse(x.observedAt))&&x.scale>=0&&x.scale<=6);
 if(!readings.length)return 0;
 let written=0;
 for(let i=0;i<readings.length;i+=500){
  const b=readings.slice(i,i+500);
  const cols={kind:b.map(x=>x.entityKind),id:b.map(x=>x.entityId),metric:b.map(x=>x.metric),
   value:b.map(x=>x.value===null?null:String(Math.round(x.value*10**x.scale))),scale:b.map(x=>x.scale),text:b.map(x=>x.text),
   at:b.map(x=>new Date(x.observedAt).toISOString()),meta:b.map(x=>JSON.stringify(x.meta??{}))};
  const res=await query(`INSERT INTO ingest_observations(source_id,source_run_ref,entity_kind,entity_id,metric,value_numeric,value_scale,value_text,accuracy,observed_at,raw_metadata)
   SELECT $1,'at:'||to_char(t.at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI'),t.kind,t.id,t.metric,t.value,t.scale,t.text,'exact',t.at,t.meta::jsonb
   FROM unnest($2::text[],$3::text[],$4::text[],$5::bigint[],$6::smallint[],$7::text[],$8::timestamptz[],$9::text[]) AS t(kind,id,metric,value,scale,text,at,meta)
   ON CONFLICT (source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING`,
   [source,cols.kind,cols.id,cols.metric,cols.value,cols.scale,cols.text,cols.at,cols.meta]);
  written+=res.rowCount??0;
  await query(`INSERT INTO ingest_latest(entity_kind,entity_id,metric,source_id,value_numeric,value_scale,value_text,accuracy,observed_at)
   SELECT DISTINCT ON (t.kind,t.id,t.metric) t.kind,t.id,t.metric,$1,t.value,t.scale,t.text,'exact',t.at
   FROM unnest($2::text[],$3::text[],$4::text[],$5::bigint[],$6::smallint[],$7::text[],$8::timestamptz[]) AS t(kind,id,metric,value,scale,text,at)
   ORDER BY t.kind,t.id,t.metric,t.at DESC
   ON CONFLICT (entity_kind,entity_id,metric) DO UPDATE SET source_id=EXCLUDED.source_id,value_numeric=EXCLUDED.value_numeric,
    value_scale=EXCLUDED.value_scale,value_text=EXCLUDED.value_text,accuracy=EXCLUDED.accuracy,observed_at=EXCLUDED.observed_at,updated_at=now()
   WHERE EXCLUDED.observed_at>=ingest_latest.observed_at`,
   [source,cols.kind,cols.id,cols.metric,cols.value,cols.scale,cols.text,cols.at]);
 }
 return written;
}

/** Health in the hub follows each satellite collection; disabled satellite sources are not monitored. */
export async function reportHub(provider:string,ok:boolean,error?:string){
 try{
  if(ok)await query('UPDATE ingest_sources SET enabled=true WHERE id=$1 AND NOT enabled',[hubSourceId(provider)]);
  await reportSourceResult(hubSourceId(provider),ok,ok?undefined:hubErrorCode(error));
 }catch(err){logger.warn({err,provider},'Hub health for satellite source not recorded');}
}
export async function setHubEnabled(provider:string,enabled:boolean){
 await query('UPDATE ingest_sources SET enabled=$2 WHERE id=$1',[hubSourceId(provider),enabled]).catch(()=>undefined);
}
function hubErrorCode(message?:string){
 const m=message??'';
 return /HTTP 429/.test(m)?'QUOTA':/HTTP 40[13]/.test(m)?'BLOCKED':/timeout|abort/i.test(m)?'TIMEOUT':/Malformed|without|HTTP 404|HTTP 410/i.test(m)?'SHAPE_CHANGED':'UNAVAILABLE';
}
