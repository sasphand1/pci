/** Loads one snapshot of stored satellite observations, builds every combined card,
 * and publishes the headline scores to the PCI hub (category 'satellite').
 * Reads only enabled providers, so a disabled source never feeds a public score. */
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {redis} from '../../lib/redis.js';
import {CITIES} from './catalog.mjs';
import {assembleInsights,type InsightsSnapshot} from './insights.mjs';
import {writeHubReadings,reportHub} from './hub.js';
import {insightReadings,hubSourceId} from './hub-map.js';

type Row={location:string;observed_at:Date;payload:Record<string,unknown>};
const ENABLED='JOIN satellite.providers cfg ON cfg.id=o.provider AND cfg.enabled=true';
const toRec=(x:Row)=>({location:x.location,observedAt:x.observed_at instanceof Date?x.observed_at.toISOString():String(x.observed_at),...x.payload});

async function latestPerLocation(metric:string,provider:string,days:number){
 const r=await query<Row>(`SELECT DISTINCT ON (o.location) o.location,o.observed_at,o.payload FROM satellite.observations o ${ENABLED}
  WHERE o.metric=$1 AND o.provider=$2 AND o.observed_at>=now()-($3::int*interval '1 day') ORDER BY o.location,o.observed_at DESC`,[metric,provider,days]);
 return r.rows.map(toRec);
}
async function recent(metric:string,provider:string,days:number,limit:number){
 const r=await query<Row>(`SELECT o.location,o.observed_at,o.payload FROM satellite.observations o ${ENABLED}
  WHERE o.metric=$1 AND o.provider=$2 AND o.observed_at>=now()-($3::int*interval '1 day') ORDER BY o.observed_at DESC LIMIT $4`,[metric,provider,days,limit]);
 return r.rows.map(toRec);
}

export async function loadSnapshotInputs(){
 const [air,weather,rivers,alerts,quakes,fires,kp,airHist,feels,rain,solar]=await Promise.all([
  latestPerLocation('air_quality','airquality',2),latestPerLocation('weather','weather',2),latestPerLocation('river_flow','flood',3),
  recent('disaster_alert','gdacs',30,200),recent('earthquake','usgs',7,200),recent('fire','firms',4,2000),recent('space_weather','swpc',2,1),
  // Hourly US AQI only (small rows) for 7-day averages and smog days.
  query<{location:string;observed_at:Date;aqi:number|null}>(`SELECT o.location,o.observed_at,(o.payload->'values'->>'us_aqi')::float AS aqi FROM satellite.observations o ${ENABLED}
   WHERE o.metric='air_quality' AND o.provider='airquality' AND o.observed_at>=now()-interval '7 days'`),
  query<{location:string;max:number|null}>(`SELECT o.location,max((o.payload->'current'->>'feelsLikeC')::float) AS max FROM satellite.observations o ${ENABLED}
   WHERE o.metric='weather' AND o.provider='weather' AND o.observed_at>=now()-interval '7 days' GROUP BY o.location`),
  query<Row>(`SELECT o.location,o.observed_at,o.payload FROM satellite.observations o ${ENABLED} WHERE o.metric='rainfall' AND o.provider='power' AND o.observed_at>=now()-interval '14 days' ORDER BY o.observed_at DESC`),
  query<Row>(`SELECT o.location,o.observed_at,o.payload FROM satellite.observations o ${ENABLED} WHERE o.metric='solar' AND o.provider='power' AND o.observed_at>=now()-interval '40 days' ORDER BY o.observed_at DESC`)
 ]);
 const by=<T extends {location:string}>(rows:T[],city:string)=>rows.filter(x=>x.location===city);
 const cities:Record<string,unknown>={};
 for(const [id,[lon,lat]] of Object.entries(CITIES as Record<string,[number,number]>)){
  cities[id]={lat,lon,air:by(air,id)[0]??null,weather:by(weather,id)[0]??null,
   airHistory:by(airHist.rows,id).map(x=>({observedAt:x.observed_at instanceof Date?x.observed_at.toISOString():String(x.observed_at),values:{us_aqi:x.aqi}})),
   maxFeelsLike7:feels.rows.find(x=>x.location===id)?.max??null,
   rainPast:by(rain.rows,id).map(toRec).slice(0,7),solar:by(solar.rows,id).map(toRec).slice(0,30)};
 }
 return {cities,rivers,alerts,quakes,fires,kp:kp[0]??null};
}

let memo:{key:string;at:number;value:InsightsSnapshot}|null=null;
/** Five-minute memo, invalidated whenever any satellite source stores new data. */
export async function insightsSnapshot():Promise<InsightsSnapshot>{
 const key=(await redis.get('satellite:epoch').catch(()=>null))??'0';
 if(memo&&memo.key===key&&Date.now()-memo.at<300000)return memo.value;
 const value=assembleInsights(await loadSnapshotInputs());
 memo={key,at:Date.now(),value};return value;
}

/** Called after air-quality or weather collections. Never fails the collection itself. */
export async function publishInsights(){
 try{
  memo=null;const snap=await insightsSnapshot();
  const hour=new Date();hour.setUTCMinutes(0,0,0);
  const n=await writeHubReadings(hubSourceId('insights'),insightReadings(snap.cities,snap.rankings,hour.toISOString()));
  await reportHub('insights',true);return n;
 }catch(err){logger.warn({err},'Satellite scores not published to the hub');await reportHub('insights',false,err instanceof Error?err.message:'Unknown');return 0;}
}
