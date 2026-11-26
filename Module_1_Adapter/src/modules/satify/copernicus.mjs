// Copernicus connectors for the Satify Hub (pure: request builders + GRIB → readings; no network).
// Both portals run the same "CADS" job API: ADS (atmosphere: CAMS) and EWDS (emergency: GloFAS).
// Adding another Copernicus dataset = one more entry in CONNECTORS with a request builder and a handler.
import {CITIES} from '../satellite/catalog.mjs';
import {RIVER_POINTS} from '../satellite/open-data.mjs';
import {valueAt} from './grib.mjs';

export const PORTALS=Object.freeze({
 ads:{base:'https://ads.atmosphere.copernicus.eu/api',keyEnv:'COPERNICUS_ADS_KEY',label:'Copernicus Atmosphere Data Store'},
 ewds:{base:'https://ewds.climate.copernicus.eu/api',keyEnv:'COPERNICUS_EWDS_KEY',label:'Copernicus Emergency Management Data Store'}
});
/** Pakistan box with a margin: [North, West, South, East]. Keeps every download small. */
export const PK_AREA=Object.freeze([38,60,23,79]);
const ymd=ms=>new Date(ms).toISOString().slice(0,10);
const H=3600e3;

/** Newest CAMS run that is normally published: 00 UTC run after ~10 UTC, else yesterday's 12 UTC run. */
export function camsRun(now=Date.now()){
 const d=new Date(now),h=d.getUTCHours();
 if(h>=10)return {date:ymd(now),time:'00:00',refMs:Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate(),0)};
 const y=now-24*H,yd=new Date(y);return {date:ymd(y),time:'12:00',refMs:Date.UTC(yd.getUTCFullYear(),yd.getUTCMonth(),yd.getUTCDate(),12)};
}
export function camsRequest(variable,now=Date.now()){
 const run=camsRun(now);
 return {dataset:'cams-global-atmospheric-composition-forecasts',runKey:`${run.date}T${run.time}`,inputs:{
  variable:[variable],date:[`${run.date}/${run.date}`],time:[run.time],type:['forecast'],
  leadtime_hour:Array.from({length:17},(_,i)=>String(i*3)),data_format:'grib',area:[...PK_AREA]}};
}
/** GloFAS daily forecast from yesterday 00 UTC (today's is published later in the day). */
export function glofasRequest(now=Date.now()){
 const d=new Date(now-24*H);
 return {dataset:'cems-glofas-forecast',runKey:ymd(now-24*H),inputs:{
  system_version:['operational'],hydrological_model:['lisflood'],product_type:['control_forecast'],
  variable:['river_discharge_in_the_last_24_hours'],year:[String(d.getUTCFullYear())],month:[String(d.getUTCMonth()+1).padStart(2,'0')],
  day:[String(d.getUTCDate()).padStart(2,'0')],leadtime_hour:Array.from({length:10},(_,i)=>String((i+1)*24)),
  data_format:'grib2',download_format:'unarchived',area:[...PK_AREA]}};
}

// US EPA AQI (2024 PM2.5 breakpoints). Hourly model concentrations, so it is an estimate, not a 24h official index.
const PM25=[[0,9,0,50],[9.1,35.4,51,100],[35.5,55.4,101,150],[55.5,125.4,151,200],[125.5,225.4,201,300],[225.5,325.4,301,500]];
const PM10=[[0,54,0,50],[55,154,51,100],[155,254,101,150],[255,354,151,200],[355,424,201,300],[425,604,301,500]];
function sub(c,table,dp){
 if(!Number.isFinite(c)||c<0)return null;const x=Math.floor(c*10**dp)/10**dp;
 for(const [lo,hi,ilo,ihi] of table)if(x<=hi)return Math.round((ihi-ilo)/(hi-lo)*(x-lo)+ilo);
 return 500;
}
export function usAqi(pm25,pm10){
 const a=sub(pm25,PM25,1),b=sub(pm10,PM10,0);
 return a===null&&b===null?null:Math.max(a??0,b??0);
}

/** City values from decoded fields (kg/m³ → µg/m³). Small enough to keep in the job row until both PM jobs finish. */
export function cityPoints(fields,factor=1e9){
 const out=[];
 for(const f of fields)for(const [city,[lon,lat]] of Object.entries(CITIES)){
  const v=valueAt(f,lat,lon);if(Number.isFinite(v))out.push({city,validTime:f.validTime,value:Math.round(v*factor*10)/10});
 }
 return out;
}
/** CAMS PM2.5 + PM10 city points → satellite 'air_quality' rows per city, the shape the Satellite page and insights read. */
export function camsRows(pm25Points,pm10Points,now=Date.now()){
 const byTime=new Map();
 const add=(points,key)=>{for(const p of points){const k=`${p.city}|${p.validTime}`;const row=byTime.get(k)??{city:p.city,at:Date.parse(p.validTime),pm2_5:null,pm10:null};row[key]=p.value;byTime.set(k,row);}};
 add(pm25Points,'pm2_5');add(pm10Points,'pm10');
 const out=[];
 for(const city of Object.keys(CITIES)){
  const rows=[...byTime.values()].filter(r=>r.city===city&&Number.isFinite(r.at)).sort((a,b)=>a.at-b.at);
  const past=rows.filter(r=>r.at<=now),future=rows.filter(r=>r.at>now&&r.at<=now+24*H);
  let peak=null,peakPm=null;for(const r of future){const q=usAqi(r.pm2_5,r.pm10);if(q!==null)peak=Math.max(peak??0,q);if(r.pm2_5!==null)peakPm=Math.max(peakPm??0,r.pm2_5);}
  // Model steps up to now become observations; the newest carries the next-24h peak (as before).
  const obs=(past.length?past:rows.slice(0,1)).slice(-9);
  obs.forEach((r,i)=>{
   const values={us_aqi:usAqi(r.pm2_5,r.pm10),pm2_5:r.pm2_5,pm10:r.pm10,nitrogen_dioxide:null,ozone:null,dust:null,uv_index:null};
   const payload={values,units:{us_aqi:'USAQI',pm2_5:'μg/m³',pm10:'μg/m³'},source:'Copernicus CAMS global forecast (ADS)',kind:'modelled_air_quality_not_station_measurement'};
   if(i===obs.length-1)payload.next24h={maxUsAqi:peak,maxPm2_5:peakPm};
   out.push({metric:'air_quality',location:city,observationKey:city,observedAt:new Date(r.at).toISOString(),payload});
  });
 }
 if(!out.length)throw Error('CAMS download had no values for Pakistan cities');
 return out;
}

/** GloFAS discharge fields → satellite 'river_flow' rows per river point (same shape as before). */
export function glofasRows(fields,now=Date.now()){
 const out=[];
 for(const [id,p] of Object.entries(RIVER_POINTS)){
  const days=fields.map(f=>({at:Date.parse(f.validTime),v:valueAt(f,p.latitude,p.longitude)})).filter(x=>Number.isFinite(x.v)).sort((a,b)=>a.at-b.at);
  if(!days.length)continue;
  const first=days[0];
  const forecast=days.map(x=>({date:new Date(x.at).toISOString().slice(0,10),median:Math.round(x.v*10)/10,max:Math.round(x.v*10)/10}));
  let peak=null;for(const x of forecast)if(!peak||x.max>peak.max)peak={date:x.date,max:x.max};
  const today=Math.round(first.v*10)/10;
  out.push({metric:'river_flow',location:id,observationKey:id,observedAt:new Date(Math.min(first.at,now)).toISOString(),payload:{pointId:id,river:p.river,place:p.place,
   latitude:p.latitude,longitude:p.longitude,dischargeM3s:today,past7:[{date:forecast[0].date,dischargeM3s:today}],forecast30:forecast,peak30:peak,
   peakToTodayRatio:peak&&today>0?Math.round(peak.max/today*100)/100:null,unit:'m³/s',source:'GloFAS control forecast (Copernicus EWDS)',kind:'modelled_river_discharge_not_official_flood_warning'}});
 }
 if(!out.length)throw Error('GloFAS download had no values at the river points');
 return out;
}
