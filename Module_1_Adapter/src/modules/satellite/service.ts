import {buildObservationBatch,SATELLITE_BATCH_SIZE,type SatelliteBatchObservation,type SatelliteProviderId} from './bulk.mjs';
import {writeHub,reportHub} from './hub.js';
import {publishInsights} from './insights-service.js';
import {airQualityUrl,parseAirQuality,weatherUrl,parseWeather,RIVER_POINTS,floodUrl,parseFlood,gdacsUrl,parseGdacs,SWPC_KP_URL,parseKp,CELESTRAK_STATIONS_URL,parseCelestrak,OPENAQ_LOCATIONS_URL,openaqLatestUrl,parseOpenaqLocations,parseOpenaqLatest,GIBS_EXTRA_LAYERS,gibsLayerProbeUrl} from './open-data.mjs';
import {metnoUrl,metnoUserAgent,parseMetno} from './metno.mjs';
import {minimumIntervalMinutes,effectiveIntervalMinutes} from './policy.mjs';
import {readLimitedText} from './guard.mjs';
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {redis} from '../../lib/redis.js';
import {PROVIDERS,CITIES,parseFirmsCsv,parsePower} from './catalog.mjs';
import {eonetUrl,parseEonet,gibsTileURL,gpmWmsURL,usgsUrl,parseUsgs} from './feeds.mjs';
const allowed=PROVIDERS as Record<string,{label:string;implemented:boolean;auth:string|null;minMinutes:number;kind:string}>;
type ProviderRow={id:string;enabled:boolean;refresh_minutes:number;last_attempt_at:string|null;last_success_at:string|null;last_error:string|null;refresh_requested_at:string|null};
let running=false;
export function configured(id:string){return id==='firms'?Boolean(process.env.NASA_FIRMS_MAP_KEY):id==='openaq'?/^[A-Za-z0-9_-]{16,200}$/.test(process.env.OPENAQ_API_KEY??''):Boolean(allowed[id]?.implemented);}
export async function providers(){const rows=await query<ProviderRow>('SELECT id,enabled,refresh_minutes,last_attempt_at,last_success_at,last_error,refresh_requested_at FROM satellite.providers ORDER BY id');return rows.rows.map(p=>({...p,minRefreshMinutes:minimumIntervalMinutes(p.id),effectiveRefreshMinutes:effectiveIntervalMinutes(p.id,p.refresh_minutes),label:allowed[p.id]?.label,kind:allowed[p.id]?.kind,implemented:Boolean(allowed[p.id]?.implemented),configured:configured(p.id),authLocation:allowed[p.id]?.auth?'server environment':'not required'}));}
async function fetchText(url:string){const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'text/csv, application/json'}});return readLimitedText(response);}
async function fetchJson(url:string,headers:Record<string,string>={}):Promise<unknown>{const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json','User-Agent':'PCI-EarthIntelligence/4.0 (+https://pulsr.pk)',...headers}});const text=await readLimitedText(response);try{return JSON.parse(text);}catch{throw Error('Malformed JSON from provider');}}
/** Stores detail in satellite.observations and the comparable numbers in the PCI hub (satellite sub-bucket). */
async function storeBatch(provider:SatelliteProviderId,observations:SatelliteBatchObservation[],opts:{hub?:boolean}={}) {
 let written=0;
 for(let i=0;i<observations.length;i+=SATELLITE_BATCH_SIZE){
  const batch=buildObservationBatch(provider,observations.slice(i,i+SATELLITE_BATCH_SIZE));
  const result=await query(batch.sql,batch.values);
  written+=result.rowCount??0;
 }
 if(opts.hub!==false&&observations.length)await writeHub(provider,observations).catch(err=>logger.warn({err,provider},'Satellite readings not copied to the hub'));
 return written;
}
/** All three NASA VIIRS NRT satellites, latest 3 days, Pakistan-region bounding box.
 * Three requests per FIRMS refresh, each charged for 3 days (up to ~9 FIRMS
 * transactions per refresh under the published day-range accounting).
 * The existing PostgreSQL 180-minute minimum protects this whole batch.
 */
export const FIRMS_SENSORS=['VIIRS_NOAA20_NRT','VIIRS_NOAA21_NRT','VIIRS_SNPP_NRT'] as const;
export const FIRMS_DAYS=3;
async function ingestFirms(){
 const key=process.env.NASA_FIRMS_MAP_KEY;
 if(!key||!/^[A-Za-z0-9_-]{6,150}$/.test(key))throw Error('FIRMS server credential is missing or invalid');
 let inserted=0;
 const failures:string[]=[];const allRows:SatelliteBatchObservation[]=[];
 for(const sensor of FIRMS_SENSORS){
  try{
   const csv=await fetchText(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(key)}/${sensor}/60,23,78,38/${FIRMS_DAYS}`);
   // A header-only CSV means a valid zero-detection response. An HTML error page is not success.
   const header=csv.split(/\r?\n/,1)[0].replace(/^\uFEFF/,'').toLowerCase();
   if(!['latitude','longitude','acq_date','acq_time','confidence'].every(field=>header.split(',').includes(field)))
    throw Error('NASA returned an invalid FIRMS CSV header');
   const rows=parseFirmsCsv(csv).map(obs=>({
    ...obs,metric:'fire' as const,
    observationKey:`${sensor}:${obs.observationKey}`,
    payload:{...obs.payload,sourceSensor:sensor}
   }));
   inserted+=await storeBatch('firms',rows,{hub:false});allRows.push(...rows);
  }catch(e){failures.push(`${sensor}: ${e instanceof Error?e.message:'unknown error'}`);}
 }
 if(allRows.length)await writeHub('firms',allRows).catch(err=>logger.warn({err},'FIRMS count not copied to the hub'));
 // Partial data is stored but provider is NOT marked healthy if any sensor failed.
 if(failures.length)throw Error(`FIRMS incomplete (${FIRMS_SENSORS.length-failures.length}/${FIRMS_SENSORS.length} sensors): ${failures.join('; ')}`);
 return inserted;
}
async function ingestPower(){let inserted=0;let successfulCities=0;const failures:string[]=[];const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10).replace(/-/g,'');const start=new Date(Date.now()-40*86400000).toISOString().slice(0,10).replace(/-/g,'');
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

async function ingestUsgs(){
 const body=JSON.parse(await fetchText(usgsUrl()));
 return storeBatch('usgs',parseUsgs(body));
}
async function ingestEonet(){
 const body=JSON.parse(await fetchText(eonetUrl()));
 return storeBatch('eonet',parseEonet(body));
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
 let stored:number|null=null;
 for(const offset of [2,3,4,5,6,7]){
  const day=new Date(Date.now()-offset*86400000).toISOString().slice(0,10);
  if(await verifiedNASAImage(gibsTileURL(day))){
   stored=await storeBatch('gibs',[{metric:'imagery',location:'bounding-box',observationKey:day,observedAt:day+'T00:00:00Z',payload:{day,layer:'MODIS_Terra_CorrectedReflectance_TrueColor',source:'NASA GIBS',kind:'imagery_only_not_derived_measurement'}}]);
   break;
  }
 }
 if(stored===null)throw Error('NASA GIBS imagery unavailable for recent dates');
 // Extra map layers are published only after a real tile for Pakistan has been fetched for that day.
 for(const l of GIBS_EXTRA_LAYERS){
  let done=false;
  for(const offset of [1,2,3]){
   const day=new Date(Date.now()-offset*86400000).toISOString().slice(0,10);
   for(const [matrix,ext] of l.candidates){
    try{if(await verifiedNASAImage(gibsLayerProbeUrl(l.layer,matrix,ext,day))){
     stored+=await storeBatch('gibs',[{metric:'imagery',location:'bounding-box',observationKey:`${l.id}:${day}`,observedAt:day+'T00:00:00Z',payload:{day,layer:l.layer,layerId:l.id,label:l.label,tileMatrixSet:matrix,format:ext,source:'NASA GIBS',kind:'imagery_only_not_derived_measurement'}}]);
     done=true;break;}}catch{/* try the next candidate */}
   }
   if(done)break;
  }
  if(!done)logger.warn({layer:l.layer},'GIBS extra layer unavailable for recent dates');
 }
 return stored;
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
/** Run one request per item; store what succeeded; fail only when nothing succeeded. */
async function perItem<T extends string>(provider:SatelliteProviderId,items:readonly T[],load:(item:T)=>Promise<SatelliteBatchObservation[]>){
 let inserted=0,ok=0;const failures:string[]=[];
 for(const item of items){
  try{const rows=await load(item);if(rows.length)inserted+=await storeBatch(provider,rows);ok++;}
  catch(e){failures.push(`${item}: ${e instanceof Error?e.message:'unknown error'}`);}
 }
 if(!ok)throw Error(`${provider} unavailable: ${failures.slice(0,3).join('; ')}`);
 if(failures.length)logger.warn({provider,failed:failures.length,of:items.length,examples:failures.slice(0,3)},'Satellite source partially collected');
 return inserted;
}
const cityIds=()=>Object.keys(CITIES);
async function ingestAirQuality(){return perItem('airquality',cityIds(),async c=>parseAirQuality(await fetchJson(airQualityUrl(c)),c) as SatelliteBatchObservation[]);}
/** Weather: MET Norway first (free incl. commercial use); Open-Meteo only as a flagged backup for that city. */
async function ingestWeather(){return perItem('weather',cityIds(),async c=>{
 try{return parseMetno(await fetchJson(metnoUrl(c),{'User-Agent':metnoUserAgent()}),c) as SatelliteBatchObservation[];}
 catch(err){logger.warn({err,city:c},'MET Norway weather failed; using Open-Meteo backup (non-commercial terms)');
  return parseWeather(await fetchJson(weatherUrl(c)),c).map(o=>({...o,payload:{...o.payload,source:'Open-Meteo forecast (backup)'}})) as SatelliteBatchObservation[];}
});}
async function ingestFlood(){return perItem('flood',Object.keys(RIVER_POINTS),async id=>parseFlood(await fetchJson(floodUrl(id)),id) as SatelliteBatchObservation[]);}
async function ingestGdacs(){const rows=parseGdacs(await fetchJson(gdacsUrl())) as SatelliteBatchObservation[];return rows.length?storeBatch('gdacs',rows):0;}
async function ingestSwpc(){return storeBatch('swpc',parseKp(await fetchJson(SWPC_KP_URL)) as SatelliteBatchObservation[]);}
async function ingestCelestrak(){return storeBatch('celestrak',parseCelestrak(await fetchJson(CELESTRAK_STATIONS_URL)) as SatelliteBatchObservation[]);}
async function ingestOpenaq(){
 const key=process.env.OPENAQ_API_KEY??'';const headers={'X-API-Key':key};
 const locations=parseOpenaqLocations(await fetchJson(OPENAQ_LOCATIONS_URL,headers));
 if(!locations.length)return 0; // valid: no station reported in the last 3 days
 const byId=new Map(locations.map(l=>[String(l.id),l]));
 return perItem('openaq',[...byId.keys()],async id=>parseOpenaqLatest(await fetchJson(openaqLatestUrl(Number(id)),headers),byId.get(id)!) as SatelliteBatchObservation[]);
}
const CONNECTORS:Record<string,()=>Promise<number>>={firms:ingestFirms,power:ingestPower,eonet:ingestEonet,usgs:ingestUsgs,gibs:ingestGibs,gpm:ingestGpm,
 airquality:ingestAirQuality,weather:ingestWeather,flood:ingestFlood,gdacs:ingestGdacs,swpc:ingestSwpc,celestrak:ingestCelestrak,openaq:ingestOpenaq};
export async function ingest(id:string){if(!allowed[id]?.implemented||!CONNECTORS[id])throw Error('Provider connector has not been implemented');if(!configured(id))throw Error('Provider server credentials are not configured');
 try{const count=await CONNECTORS[id]();await query('UPDATE satellite.providers SET last_attempt_at=now(),last_success_at=now(),refresh_requested_at=NULL,last_error=NULL WHERE id=$1',[id]);await redis.incr('satellite:epoch').catch(()=>undefined);await reportHub(id,true);if(id==='airquality'||id==='weather')void publishInsights();return count;}
 catch(e){const message=e instanceof Error?e.message:'Unknown provider error';await query('UPDATE satellite.providers SET last_attempt_at=now(),refresh_requested_at=NULL,last_error=$2 WHERE id=$1',[id,message.slice(0,200)]);await reportHub(id,false,message);throw e;}
}
// Database claim prevents concurrent API/worker refresh, even across processes.
/** Both cron and immediate admin dispatch use the same atomic PostgreSQL spacing guard.
 * A refresh request is a REQUEST, never authorization to bypass a provider minimum.
 * last_attempt_at is updated BEFORE any outbound request; failures still consume a slot.
 */
export async function satelliteTick(){
 if(running)return;
 running=true;
 try{
  const rows=await query<ProviderRow>('SELECT * FROM satellite.providers WHERE enabled=true ORDER BY id');
  for(const p of rows.rows){
   if(!allowed[p.id]?.implemented||!configured(p.id))continue;
   const minimum=minimumIntervalMinutes(p.id);
   // The timestamp compare and update occur in one atomic SQL statement, across workers.
   // No "refresh_requested_at" override: manual refresh also respects the full interval.
   const claimed=await query(`UPDATE satellite.providers SET last_attempt_at=now()
    WHERE id=$1 AND enabled=true
      AND (last_attempt_at IS NULL OR last_attempt_at <= now()-make_interval(mins=>GREATEST(refresh_minutes,$2::int)))
    RETURNING id`,[p.id,minimum]);
   if(!claimed.rowCount)continue;
   try{await ingest(p.id);}catch(e){logger.warn({provider:p.id,reason:e instanceof Error?e.message:'unavailable'},'Satellite ingestion failed');}
  }
 }catch(e){logger.warn({err:e},'Satellite scheduler unavailable');}
 finally{running=false;}
}
