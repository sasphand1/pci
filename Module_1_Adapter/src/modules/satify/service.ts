/** Satify Hub: collects free sources with backups, derives signals, keeps history and mirrors key numbers
 * into the main PCI hub. Every value carries its badge (measured/official/forecast/estimate), source and time. */
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {writeHubReadings} from '../satellite/hub.js';
import {SIGNALS,SATIFY_CITIES,ROUTES} from './catalog.mjs';
import {metarUrl,parseMetar,FX_SBP_URL,FX_ERAPI_URL,parseFrankfurter,parseErApi,GOLD_XAUS_URL,parseXaus,type SatifyReading} from './sources.mjs';
import {deriveCity,deriveRoutes,type SignalValue,type DerivedReading} from './derive.mjs';

const UA='Satify-Pulsr/1.0 (+https://github.com/sasphand1/pci)';
async function fetchJson(url:string):Promise<unknown>{
 const r=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:'application/json','User-Agent':UA}});
 if(!r.ok)throw Error(`HTTP ${r.status}`);
 const text=await r.text();if(text.length>2_000_000)throw Error('Response too large');
 try{return JSON.parse(text);}catch{throw Error('Malformed JSON from provider');}
}

type SourceRow={id:string;min_minutes:number;enabled:boolean;last_attempt_at:string|null};
async function due(id:string,force:boolean):Promise<boolean>{
 const r=await query<SourceRow>('SELECT id,min_minutes,enabled,last_attempt_at FROM satify.sources WHERE id=$1',[id]);
 const s=r.rows[0];if(!s||!s.enabled)return false;if(force||!s.last_attempt_at)return true;
 return Date.parse(s.last_attempt_at)<=Date.now()-s.min_minutes*60_000;
}
async function report(id:string,ok:boolean,error?:string){
 await query(ok
  ?'UPDATE satify.sources SET last_attempt_at=now(),last_success_at=now(),last_error=NULL,fail_count=0 WHERE id=$1'
  :'UPDATE satify.sources SET last_attempt_at=now(),last_error=$2,fail_count=fail_count+1 WHERE id=$1',ok?[id]:[id,(error??'failed').slice(0,300)]);
}

/** Writes latest + history and mirrors numbers into the main hub (category satify). */
export async function storeReadings(rows:(SatifyReading|(DerivedReading&{observedAt?:string}))[]):Promise<number>{
 const valid=rows.filter(r=>Object.hasOwn(SIGNALS,r.signal)&&r.scope&&(r.value!==null||r.text));
 if(!valid.length)return 0;
 const now=new Date().toISOString();
 const cols={sig:valid.map(r=>r.signal),scope:valid.map(r=>r.scope),val:valid.map(r=>r.value),txt:valid.map(r=>r.text?.slice(0,300)??null),
  badge:valid.map(r=>r.badge),src:valid.map(r=>r.source.slice(0,160)),at:valid.map(r=>r.observedAt??now)};
 await query(`INSERT INTO satify.signals_latest(signal_id,scope,value_numeric,value_text,badge,source,observed_at,fetched_at)
  SELECT DISTINCT ON (t.sig,t.scope) t.sig,t.scope,t.val,t.txt,t.badge,t.src,t.at,now()
  FROM unnest($1::text[],$2::text[],$3::float8[],$4::text[],$5::text[],$6::text[],$7::timestamptz[]) AS t(sig,scope,val,txt,badge,src,at)
  ORDER BY t.sig,t.scope,t.at DESC
  ON CONFLICT (signal_id,scope) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,value_text=EXCLUDED.value_text,badge=EXCLUDED.badge,
   source=EXCLUDED.source,observed_at=EXCLUDED.observed_at,fetched_at=now()
  WHERE EXCLUDED.observed_at>=satify.signals_latest.observed_at`,[cols.sig,cols.scope,cols.val,cols.txt,cols.badge,cols.src,cols.at]);
 await query(`INSERT INTO satify.readings(signal_id,scope,value_numeric,value_text,badge,source,observed_at)
  SELECT * FROM unnest($1::text[],$2::text[],$3::float8[],$4::text[],$5::text[],$6::text[],$7::timestamptz[])
  ON CONFLICT (signal_id,scope,observed_at,source) DO NOTHING`,[cols.sig,cols.scope,cols.val,cols.txt,cols.badge,cols.src,cols.at]);
 const hub=valid.filter(r=>r.value!==null).map(r=>({entityKind:'satify_scope',entityId:r.scope,metric:r.signal,value:r.value,scale:2,text:null,observedAt:r.observedAt??now,meta:{badge:r.badge,source:r.source}}));
 await writeHubReadings('satify.api',hub).catch(err=>logger.warn({err},'Satify readings not mirrored into the main hub'));
 return valid.length;
}

/** Runs a chain of sources for one kind of data: first success wins, the rest are not called. */
async function chain(steps:{id:string;run:()=>Promise<SatifyReading[]>}[],force:boolean){
 for(const step of steps){
  if(!(await due(step.id,force)))return; // the first source decides the rhythm; backups only run when it fails
  try{const rows=await step.run();await storeReadings(rows);await report(step.id,true);return;}
  catch(err){await report(step.id,false,err instanceof Error?err.message:'failed');logger.warn({err,source:step.id},'Satify source failed; trying backup');force=true;}
 }
}

/** Latest satellite payload (weather / air) for a city from the existing satellite tables. */
async function satellitePayload(metric:string,city:string):Promise<any|null>{
 const r=await query(`SELECT payload,observed_at FROM satellite.observations WHERE metric=$1 AND location=$2 ORDER BY observed_at DESC LIMIT 1`,[metric,city]).catch(()=>({rows:[]as any[]}));
 return r.rows[0]?{...r.rows[0].payload,observedAt:r.rows[0].observed_at}:null;
}

async function deriveAll(){
 const vis=await query<{scope:string;value_numeric:number|null}>(`SELECT scope,value_numeric FROM satify.signals_latest WHERE signal_id='visibility_km' AND observed_at>now()-interval '6 hours'`);
 const visibility:Record<string,number|null>=Object.fromEntries(vis.rows.map(r=>[r.scope,r.value_numeric]));
 const clear:Record<string,string|null>={};const out:(DerivedReading&{observedAt:string})[]=[];
 for(const city of Object.keys(SATIFY_CITIES)){
  const [weather,air]=await Promise.all([satellitePayload('weather',city),satellitePayload('air_quality',city)]);
  if(!weather&&!air)continue;
  const rows=deriveCity(city,{weather,air,visibilityKm:visibility[city]??null});
  // Readings inherit the time of the data they were computed from, so freshness stays honest.
  const wAt=weather?.observedAt?new Date(weather.observedAt).toISOString():null,aAt=air?.observedAt?new Date(air.observedAt).toISOString():null;
  for(const r of rows){
   const at=r.signal.startsWith('aqi')||r.signal==='pm25'?aAt:r.signal==='school_closure_chance'?([aAt,wAt].filter(Boolean).sort()[0]??null):wAt;
   if(at)out.push({...r,observedAt:at});
  }
  clear[city]=rows.find(r=>r.signal==='fog_clear_time')?.text??null;
 }
 const nhmp=await activeManual('nhmp_status');
 const at=new Date().toISOString();
 out.push(...deriveRoutes(visibility,clear,Object.fromEntries(Object.entries(nhmp).map(([k,v])=>[k,v.text??'']))).map(r=>({...r,observedAt:at})));
 await storeReadings(out);
}

/** Every minute from the scheduler; each source keeps its own minimum interval. */
export async function collectSatify(force=false){
 await chain([{id:'metar',run:async()=>parseMetar(await fetchJson(metarUrl()))}],force);
 await chain([{id:'fx_sbp',run:async()=>parseFrankfurter(await fetchJson(FX_SBP_URL))},{id:'fx_erapi',run:async()=>parseErApi(await fetchJson(FX_ERAPI_URL))}],force);
 await chain([{id:'gold_xaus',run:async()=>parseXaus(await fetchJson(GOLD_XAUS_URL))}],force);
 if(await due('derived',force)){
  try{await deriveAll();await report('derived',true);}
  catch(err){await report('derived',false,err instanceof Error?err.message:'failed');logger.warn({err},'Satify derived signals failed');}
 }
}

type ManualRow={scope:string;value_numeric:number|null;value_text:string|null;source_url:string|null;created_at:string};
async function activeManual(signal:string):Promise<Record<string,{value:number|null;text:string|null;at:string;url:string|null}>>{
 const r=await query<ManualRow>(`SELECT DISTINCT ON (scope) scope,value_numeric,value_text,source_url,created_at FROM satify.manual_signals
  WHERE signal_id=$1 AND active AND (valid_until IS NULL OR valid_until>now()) ORDER BY scope,created_at DESC`,[signal]);
 return Object.fromEntries(r.rows.map(x=>[x.scope,{value:x.value_numeric,text:x.value_text,at:x.created_at,url:x.source_url}]));
}

/** All signals for a scope (and the national 'pk' scope), with manual official entries taking priority. */
export async function signalsFor(scope:string):Promise<Record<string,SignalValue&{sourceUrl?:string|null}>>{
 const scopes=scope==='pk'?['pk']:[scope,'pk'];
 const auto=await query(`SELECT signal_id,scope,value_numeric,value_text,badge,source,observed_at FROM satify.signals_latest WHERE scope=ANY($1::text[])`,[scopes]);
 const out:Record<string,SignalValue&{sourceUrl?:string|null}>={};
 for(const r of auto.rows){if(r.scope===scope||!out[r.signal_id])out[r.signal_id]={value:r.value_numeric,text:r.value_text,badge:r.badge,source:r.source,observedAt:new Date(r.observed_at).toISOString()};}
 const manual=await query(`SELECT DISTINCT ON (signal_id,scope) signal_id,scope,value_numeric,value_text,source_url,created_at FROM satify.manual_signals
  WHERE active AND (valid_until IS NULL OR valid_until>now()) AND (scope=ANY($1::text[]) OR scope='all') ORDER BY signal_id,scope,created_at DESC`,[scopes]);
 for(const m of manual.rows){
  const def=SIGNALS[m.signal_id];if(!def)continue;
  if(m.scope!==scope&&out[m.signal_id]?.badge==='official'&&m.scope!=='pk')continue;
  out[m.signal_id]={value:m.value_numeric,text:m.value_text,badge:'official',source:m.signal_id==='gold_tola'?'Sarafa association rate (entered by Satify)':def.source,observedAt:new Date(m.created_at).toISOString(),sourceUrl:m.source_url};
 }
 return out;
}
export const validScope=(s:string)=>s==='pk'||Object.hasOwn(SATIFY_CITIES,s)||Object.hasOwn(ROUTES,s);
