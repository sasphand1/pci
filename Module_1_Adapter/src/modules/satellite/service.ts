import {buildObservationBatch,SATELLITE_BATCH_SIZE} from './bulk.mjs';
import {readLimitedText} from './guard.mjs';
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {redis} from '../../lib/redis.js';
import {PROVIDERS,CITIES,parseFirmsCsv,parsePower} from './catalog.mjs';
import {COPERNICUS_IDS,eonetUrl,copernicusUrl,parseEonet,parseCopernicus,gibsTileURL,gpmWmsURL} from './feeds.mjs';
const allowed=PROVIDERS as Record<string,{label:string;implemented:boolean;auth:string|null;minMinutes:number;kind:string}>;
type ProviderRow={id:string;enabled:boolean;refresh_minutes:number;last_attempt_at:string|null;last_success_at:string|null;last_error:string|null;refresh_requested_at:string|null};
let running=false;
export function configured(id:string){return id==='firms'?Boolean(process.env.NASA_FIRMS_MAP_KEY):Boolean(allowed[id]?.implemented);}
export async function providers(){const rows=await query<ProviderRow>('SELECT id,enabled,refresh_minutes,last_attempt_at,last_success_at,last_error,refresh_requested_at FROM satellite.providers ORDER BY id');return rows.rows.map(p=>({...p,label:allowed[p.id]?.label,kind:allowed[p.id]?.kind,implemented:Boolean(allowed[p.id]?.implemented),configured:configured(p.id),authLocation:allowed[p.id]?.auth?'server environment':'not required'}));}
async function fetchText(url:string){const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'text/csv, application/json'}});return readLimitedText(response);}
async function storeBatch(provider:'firms'|'power'|'eonet'|'gibs'|'gpm'|'sentinel1'|'sentinel2'|'sentinel5p',observations:Array<{metric:'fire'|'rainfall'|'solar'|'natural_event'|'scene'|'imagery';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown>}>) {
 let written=0;
 for(let i=0;i<observations.length;i+=SATELLITE_BATCH_SIZE){
  const batch=buildObservationBatch(provider,observations.slice(i,i+SATELLITE_BATCH_SIZE));
  const result=await query(batch.sql,batch.values);
  written+=result.rowCount??0;
 }
 return written;
}
async function ingestFirms(){const key=process.env.NASA_FIRMS_MAP_KEY;if(!key||!/^[A-Za-z0-9_-]{6,150}$/.test(key))throw Error('FIRMS server credential is missing or invalid');
 const csv=await fetchText(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/VIIRS_SNPP_NRT/60,23,78,38/1`);
 const rows=parseFirmsCsv(csv);return storeBatch('firms',rows.map(obs=>({...obs,metric:'fire' as const})));
}
async function ingestPower(){let inserted=0;let successfulCities=0;const failures:string[]=[];const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10).replace(/-/g,'');const start=new Date(Date.now()-12*86400000).toISOString().slice(0,10).replace(/-/g,'');
 for(const [location,coords] of Object.entries(CITIES)){
  const [longitude,latitude]=coords;
  const url=new URL('https://power.larc.nasa.gov/api/temporal/daily/point');url.searchParams.set('parameters','PRECTOTCORR,ALLSKY_SFC_SW_DWN');url.searchParams.set('community','RE');url.searchParams.set('longitude',String(longitude));url.searchParams.set('latitude',String(latitude));url.searchParams.set('start',start);url.searchParams.set('end',yesterday);url.searchParams.set('format','JSON');
  try {
   const data=JSON.parse(await fetchText(url.toString()));const rows=parsePower(data,location);
   if(!rows.length)throw Error('No valid meteorological measurements');
   inserted+=await storeBatch('power',rows);successfulCities++;
  }catch(e){failures.push(`${location}: ${e instanceof Error?e.message:'unknown error'}`);}
 }
 if(successfulCities!==Object.keys(CITIES).length)throw Error(`POWER incomplete (${successfulCities}/${Object.keys(CITIES).length} cities): ${failures.slice(0,3).join('; ')}`);
 return inserted;
}

async function ingestEonet(){
 const body=JSON.parse(await fetchText(eonetUrl()));
 return storeBatch('eonet',parseEonet(body));
}
async function ingestCopernicus(id:'sentinel1'|'sentinel2'|'sentinel5p'){
 const body=JSON.parse(await fetchText(copernicusUrl(id)));
 return storeBatch(id,parseCopernicus(body,id));
}
async function verifiedNASAImage(url:string){
 const r=await fetch(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(12000)});
 try{
  const type=r.headers.get('content-type')||'';
  const size=Number(r.headers.get('content-length')||0);
  if(!r.ok||!type.startsWith('image/')||(size>0&&size>600000))return false;
  // A single raster tile is bounded; do not buffer arbitrary NASA responses.
  const reader=r.body?.getReader();if(!reader)return false;
  try{let bytes=0;while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>600000)return false;}return bytes>0;}
  finally{await reader.cancel().catch(()=>undefined);}
 }finally{await r.body?.cancel().catch(()=>undefined);}
}
async function ingestGibs(){
 for(const offset of [2,3,4,5,6,7]){
  const day=new Date(Date.now()-offset*86400000).toISOString().slice(0,10);
  if(await verifiedNASAImage(gibsTileURL(day))){
   return storeBatch('gibs',[{metric:'imagery',location:'bounding-box',observationKey:day,observedAt:day+'T00:00:00Z',payload:{day,layer:'MODIS_Terra_CorrectedReflectance_TrueColor',source:'NASA GIBS',kind:'imagery_only_not_derived_measurement'}}]);
  }
 }
 throw Error('NASA GIBS imagery unavailable for recent dates');
}
async function ingestGpm(){
 // Visualized IMERG precipitation only; no numeric rainfall is inferred from image colors.
 for(const offset of [2,3,4,5,6,7]){
  const day=new Date(Date.now()-offset*86400000).toISOString().slice(0,10);
  if(await verifiedNASAImage(gpmWmsURL(day))){
   return storeBatch('gpm',[{metric:'imagery',location:'bounding-box',observationKey:day,observedAt:day+'T00:00:00Z',payload:{day,layer:'IMERG_Precipitation_Rate',source:'NASA GIBS / GPM IMERG',kind:'visualized_precipitation_rate_only',numericRainfallAvailable:false}}]);
  }
 }
 throw Error('NASA GPM IMERG visualization unavailable for recent dates');
}
export async function ingest(id:string){if(!allowed[id]?.implemented)throw Error('Provider connector has not been implemented');if(!configured(id))throw Error('Provider server credentials are not configured');
 try{const count=id==='firms'?await ingestFirms():id==='power'?await ingestPower():id==='eonet'?await ingestEonet():id==='gibs'?await ingestGibs():id==='gpm'?await ingestGpm():id in COPERNICUS_IDS?await ingestCopernicus(id as 'sentinel1'|'sentinel2'|'sentinel5p'):(()=>{throw Error('Unsupported connector')})();await query('UPDATE satellite.providers SET last_attempt_at=now(),last_success_at=now(),refresh_requested_at=NULL,last_error=NULL WHERE id=$1',[id]);await redis.incr('satellite:epoch').catch(()=>undefined);return count;}
 catch(e){const message=e instanceof Error?e.message:'Unknown provider error';await query('UPDATE satellite.providers SET last_attempt_at=now(),refresh_requested_at=NULL,last_error=$2 WHERE id=$1',[id,message.slice(0,200)]);throw e;}
}
// Database claim prevents concurrent API/worker refresh, even across processes.
export async function satelliteTick(){if(running)return;running=true;try{
 const due=await query<ProviderRow>(`SELECT * FROM satellite.providers WHERE enabled=true AND ((refresh_requested_at IS NOT NULL AND (last_attempt_at IS NULL OR last_attempt_at<refresh_requested_at OR last_attempt_at < now()-interval '5 minutes')) OR (refresh_requested_at IS NULL AND (last_attempt_at IS NULL OR last_attempt_at < now()-make_interval(mins=>refresh_minutes)))) ORDER BY id`);
 for(const p of due.rows){if(!allowed[p.id]?.implemented||!configured(p.id))continue;
  const claimed=await query(`UPDATE satellite.providers SET last_attempt_at=now() WHERE id=$1 AND enabled=true AND ((refresh_requested_at IS NOT NULL AND (last_attempt_at IS NULL OR last_attempt_at<refresh_requested_at OR last_attempt_at < now()-interval '5 minutes')) OR (refresh_requested_at IS NULL AND (last_attempt_at IS NULL OR last_attempt_at < now()-make_interval(mins=>refresh_minutes)))) RETURNING id`,[p.id]);
  if(!claimed.rowCount)continue;
  try{await ingest(p.id);}catch(e){logger.warn({provider:p.id,reason:e instanceof Error?e.message:'unavailable'},'Satellite ingestion failed');}
 }
 }catch(e){logger.warn({err:e},'Satellite scheduler unavailable');}finally{running=false;}}
