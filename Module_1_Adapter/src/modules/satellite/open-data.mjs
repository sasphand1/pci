// PCI Earth Intelligence v4: free sources that deliver ready-to-use numbers (no raster processing).
// Pure URL builders and parsers: no network, no database. Every parser fails closed on malformed input.
import {CITIES} from './catalog.mjs';

const OPEN_METEO_AQ='https://air-quality-api.open-meteo.com/v1/air-quality';
const OPEN_METEO_FORECAST='https://api.open-meteo.com/v1/forecast';
const OPEN_METEO_FLOOD='https://flood-api.open-meteo.com/v1/flood';
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const str=(v,max=200)=>typeof v==='string'?v.slice(0,max):null;
const isObj=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const H=3600000;
/** Open-Meteo returns local-less ISO times ("2026-11-25T10:00") when timezone=UTC. */
function utc(t){if(typeof t!=='string'||!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/.test(t))return null;const ms=Date.parse(t.length===10?t+'T00:00:00Z':t+(t.length===16?':00Z':'Z'));return Number.isFinite(ms)?ms:null;}
function coords(city){const c=CITIES[city];if(!c)throw Error('Unknown city');return {longitude:c[0],latitude:c[1]};}

// ---------- Air quality: Copernicus CAMS via Open-Meteo ----------
export const AIR_QUALITY_FIELDS=Object.freeze(['us_aqi','pm2_5','pm10','nitrogen_dioxide','ozone','dust','uv_index']);
export function airQualityUrl(city){
 const {latitude,longitude}=coords(city);const u=new URL(OPEN_METEO_AQ);
 for(const [k,v] of Object.entries({latitude:String(latitude),longitude:String(longitude),hourly:AIR_QUALITY_FIELDS.join(','),past_days:'1',forecast_days:'2',timezone:'UTC'}))u.searchParams.set(k,v);
 return u.toString();
}
/** Past ~26 hours as observations; the newest carries the next-24h forecast peak. */
export function parseAirQuality(body,city,now=Date.now()){
 coords(city);const hourly=body?.hourly;if(!isObj(hourly)||!Array.isArray(hourly.time))throw Error('Malformed air-quality response');
 const units=isObj(body.hourly_units)?Object.fromEntries(AIR_QUALITY_FIELDS.map(f=>[f,str(body.hourly_units[f],20)])):{};
 const rows=[];let forecastAqi=null,forecastPm25=null;
 hourly.time.forEach((t,i)=>{
  const at=utc(t);if(at===null)return;
  const values=Object.fromEntries(AIR_QUALITY_FIELDS.map(f=>[f,Array.isArray(hourly[f])?num(hourly[f][i]):null]));
  if(at>now){if(at<=now+24*H){if(values.us_aqi!==null)forecastAqi=Math.max(forecastAqi??0,values.us_aqi);if(values.pm2_5!==null)forecastPm25=Math.max(forecastPm25??0,values.pm2_5);}return;}
  if(at<now-26*H||Object.values(values).every(v=>v===null))return;
  rows.push({metric:'air_quality',location:city,observationKey:city,observedAt:new Date(at).toISOString(),payload:{values,units,source:'Copernicus CAMS via Open-Meteo',kind:'modelled_air_quality_not_station_measurement'}});
 });
 rows.sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt));
 if(rows[0])rows[0].payload={...rows[0].payload,next24h:{maxUsAqi:forecastAqi,maxPm2_5:forecastPm25}};
 return rows;
}
export function aqiBand(aqi){if(typeof aqi!=='number'||!Number.isFinite(aqi))return null;return aqi<=50?'Good':aqi<=100?'Moderate':aqi<=150?'Unhealthy for sensitive groups':aqi<=200?'Unhealthy':aqi<=300?'Very unhealthy':'Hazardous';}

// ---------- Weather forecast: Open-Meteo ----------
const CURRENT=['temperature_2m','relative_humidity_2m','apparent_temperature','precipitation','weather_code','wind_speed_10m'];
const DAILY=['weather_code','temperature_2m_max','temperature_2m_min','apparent_temperature_max','precipitation_sum','precipitation_probability_max','uv_index_max','wind_speed_10m_max'];
export function weatherUrl(city){
 const {latitude,longitude}=coords(city);const u=new URL(OPEN_METEO_FORECAST);
 for(const [k,v] of Object.entries({latitude:String(latitude),longitude:String(longitude),current:CURRENT.join(','),daily:DAILY.join(','),forecast_days:'7',timezone:'UTC'}))u.searchParams.set(k,v);
 return u.toString();
}
export function parseWeather(body,city){
 coords(city);const c=body?.current,d=body?.daily;
 if(!isObj(c)||!isObj(d)||!Array.isArray(d.time))throw Error('Malformed weather response');
 const at=utc(c.time);if(at===null)throw Error('Weather response without a valid time');
 const current={temperatureC:num(c.temperature_2m),feelsLikeC:num(c.apparent_temperature),humidityPct:num(c.relative_humidity_2m),precipitationMm:num(c.precipitation),windKmh:num(c.wind_speed_10m),weatherCode:num(c.weather_code)};
 if(current.temperatureC===null)throw Error('Weather response without temperature');
 const daily=d.time.slice(0,7).map((day,i)=>({date:typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)?day:null,
  maxC:num(d.temperature_2m_max?.[i]),minC:num(d.temperature_2m_min?.[i]),feelsLikeMaxC:num(d.apparent_temperature_max?.[i]),
  rainMm:num(d.precipitation_sum?.[i]),rainChancePct:num(d.precipitation_probability_max?.[i]),uvIndexMax:num(d.uv_index_max?.[i]),
  windMaxKmh:num(d.wind_speed_10m_max?.[i]),weatherCode:num(d.weather_code?.[i])})).filter(x=>x.date);
 const heatDays=daily.filter(x=>(x.feelsLikeMaxC??x.maxC??0)>=40).length;
 return [{metric:'weather',location:city,observationKey:city,observedAt:new Date(at).toISOString(),payload:{current,daily,heatDays,source:'Open-Meteo forecast',kind:'model_forecast_not_official_pmd_warning'}}];
}

// ---------- River flow: GloFAS via Open-Meteo ----------
/** Approximate points on main channels. Open-Meteo returns the nearest 5 km model river cell. */
export const RIVER_POINTS=Object.freeze({
 'indus-attock':{river:'Indus',place:'Attock',latitude:33.893,longitude:72.235},
 'indus-kalabagh':{river:'Indus',place:'Kalabagh',latitude:32.960,longitude:71.550},
 'indus-guddu':{river:'Indus',place:'Guddu',latitude:28.420,longitude:69.700},
 'indus-sukkur':{river:'Indus',place:'Sukkur',latitude:27.700,longitude:68.850},
 'indus-kotri':{river:'Indus',place:'Kotri',latitude:25.360,longitude:68.310},
 'jhelum-mangla':{river:'Jhelum',place:'Mangla',latitude:33.130,longitude:73.640},
 'chenab-marala':{river:'Chenab',place:'Marala',latitude:32.670,longitude:74.460},
 'ravi-lahore':{river:'Ravi',place:'Lahore',latitude:31.610,longitude:74.300},
 'sutlej-sulemanki':{river:'Sutlej',place:'Sulemanki',latitude:30.380,longitude:73.870},
 'kabul-nowshera':{river:'Kabul',place:'Nowshera',latitude:34.010,longitude:71.980},
 'swat-chakdara':{river:'Swat',place:'Chakdara',latitude:34.650,longitude:72.030}
});
export function floodUrl(id){
 const p=RIVER_POINTS[id];if(!p)throw Error('Unknown river point');const u=new URL(OPEN_METEO_FLOOD);
 for(const [k,v] of Object.entries({latitude:String(p.latitude),longitude:String(p.longitude),daily:'river_discharge,river_discharge_median,river_discharge_max',past_days:'7',forecast_days:'30'}))u.searchParams.set(k,v);
 return u.toString();
}
export function parseFlood(body,id,now=Date.now()){
 const p=RIVER_POINTS[id];if(!p)throw Error('Unknown river point');
 const d=body?.daily;if(!isObj(d)||!Array.isArray(d.time)||!Array.isArray(d.river_discharge))throw Error('Malformed river-flow response');
 const days=d.time.map((t,i)=>({date:t,at:utc(t),discharge:num(d.river_discharge[i]),median:num(d.river_discharge_median?.[i]),max:num(d.river_discharge_max?.[i])})).filter(x=>x.at!==null);
 const todayStart=Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z');
 const past=days.filter(x=>x.at<=todayStart&&x.discharge!==null);const latest=past[past.length-1];
 if(!latest)throw Error('River-flow response without current discharge');
 const forecast=days.filter(x=>x.at>todayStart).map(x=>({date:x.date,median:x.median??x.discharge,max:x.max??x.discharge})).filter(x=>x.median!==null||x.max!==null);
 let peak=null;for(const x of forecast)if(x.max!==null&&(!peak||x.max>peak.max))peak={date:x.date,max:x.max};
 const ratio=peak&&latest.discharge>0?Math.round(peak.max/latest.discharge*100)/100:null;
 return [{metric:'river_flow',location:id,observationKey:id,observedAt:new Date(latest.at).toISOString(),payload:{pointId:id,river:p.river,place:p.place,latitude:p.latitude,longitude:p.longitude,dischargeM3s:latest.discharge,past7:past.slice(-7).map(x=>({date:x.date,dischargeM3s:x.discharge})),forecast30:forecast.slice(0,30),peak30:peak,peakToTodayRatio:ratio,unit:'m³/s',source:'GloFAS via Open-Meteo',kind:'modelled_river_discharge_nearest_model_cell_not_official_ffd_forecast'}}];
}

// ---------- Disaster alerts: GDACS (UN/EC) ----------
export const ALERT_REGION=Object.freeze([55,20,80,40]); // Pakistan plus the Arabian Sea approach for cyclones
export function gdacsUrl(now=new Date()){
 const to=now.toISOString().slice(0,10),from=new Date(now.valueOf()-30*86400000).toISOString().slice(0,10);
 const u=new URL('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH');
 for(const [k,v] of Object.entries({eventlist:'EQ;TC;FL;DR;WF;VO',fromdate:from,todate:to,alertlevel:'green;orange;red'}))u.searchParams.set(k,v);
 return u.toString();
}
export function parseGdacs(body){
 if(!body||!Array.isArray(body.features))throw Error('Malformed GDACS response');
 const byEvent=new Map();
 for(const f of body.features.slice(0,500)){
  const p=f?.properties;if(!isObj(p))continue;
  const type=str(p.eventtype,4),id=p.eventid,level=str(p.alertlevel,10);
  if(!type||!/^[A-Z]{2}$/.test(type)||!(typeof id==='number'||(typeof id==='string'&&/^\d{1,12}$/.test(id)))||!level)continue;
  const affected=Array.isArray(p.affectedcountries)?p.affectedcountries.map(c=>str(c?.iso3,3)).filter(Boolean):[];
  const g=f.geometry;const point=g?.type==='Point'&&Array.isArray(g.coordinates)?g.coordinates:null;
  const lon=num(point?.[0]),lat=num(point?.[1]);
  const inRegion=lon!==null&&lat!==null&&lon>=ALERT_REGION[0]&&lon<=ALERT_REGION[2]&&lat>=ALERT_REGION[1]&&lat<=ALERT_REGION[3];
  const pakistan=p.iso3==='PAK'||affected.includes('PAK')||/pakistan/i.test(String(p.country??''));
  if(!inRegion&&!pakistan)continue;
  const from=Date.parse(String(p.fromdate??''));if(!Number.isFinite(from))continue;
  const key=`${type}:${id}`;const prev=byEvent.get(key);
  if(prev&&prev.payload.latitude!==null)continue; // prefer the centroid point feature
  const sev=isObj(p.severitydata)?p.severitydata:{};
  byEvent.set(key,{metric:'disaster_alert',location:'bounding-box',observationKey:`${key}:${p.episodeid??0}`,observedAt:new Date(from).toISOString(),payload:{eventType:type,eventId:String(id),episodeId:String(p.episodeid??''),name:str(p.name)??str(p.eventname)??'GDACS event',alertLevel:level,alertScore:num(p.alertscore),country:str(p.country,160),affectsPakistan:pakistan,latitude:inRegion||pakistan?lat:null,longitude:inRegion||pakistan?lon:null,severity:num(sev.severity),severityText:str(sev.severitytext,200),severityUnit:str(sev.severityunit,40),toDate:str(p.todate,40),reportUrl:typeof p.url?.report==='string'&&p.url.report.startsWith('https://www.gdacs.org/')?p.url.report:null,source:'GDACS (UN OCHA / EC JRC)',kind:'international_alert_not_ndma_instruction'}});
 }
 return [...byEvent.values()];
}

// ---------- Space weather: NOAA SWPC planetary K-index ----------
export const SWPC_KP_URL='https://services.swpc.noaa.gov/json/planetary_k_index_1m.json';
export function geomagneticScale(kp){if(typeof kp!=='number'||!Number.isFinite(kp))return null;return kp>=9?'G5':kp>=8?'G4':kp>=7?'G3':kp>=6?'G2':kp>=5?'G1':kp>=4?'Active':'Quiet';}
/** Accepts the long-standing object array and the older array-of-arrays form. */
export function parseKp(body,now=Date.now()){
 if(!Array.isArray(body)||!body.length)throw Error('Malformed SWPC Kp response');
 const samples=[];
 for(const r of body.slice(-3000)){
  let t,kp;
  if(Array.isArray(r)){t=r[0];kp=Number(r[1]);}
  else if(isObj(r)){t=r.time_tag;kp=typeof r.estimated_kp==='number'?r.estimated_kp:typeof r.kp_index==='number'?r.kp_index:Number(r.Kp??r.kp);}
  const at=typeof t==='string'?Date.parse(/Z|[+-]\d\d:?\d\d$/.test(t)?t:t.replace(' ','T')+'Z'):NaN;
  if(!Number.isFinite(at)||!Number.isFinite(kp)||kp<0||kp>9||at>now+H)continue;samples.push({at,kp});
 }
 if(!samples.length)throw Error('SWPC Kp response without valid samples');
 samples.sort((a,b)=>a.at-b.at);const latest=samples[samples.length-1];
 const max24=Math.max(...samples.filter(s=>s.at>=latest.at-24*H).map(s=>s.kp));
 return [{metric:'space_weather',location:'global',observationKey:'kp',observedAt:new Date(latest.at).toISOString(),payload:{kp:Math.round(latest.kp*100)/100,scale:geomagneticScale(latest.kp),max24h:Math.round(max24*100)/100,scale24h:geomagneticScale(max24),source:'NOAA SWPC',kind:'estimated_planetary_k_index'}}];
}

// ---------- Orbits: CelesTrak GP data (ISS, Tiangong and other stations) ----------
export const CELESTRAK_STATIONS_URL='https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=json';
export function parseCelestrak(body,now=Date.now()){
 if(!Array.isArray(body))throw Error('Malformed CelesTrak response');
 const out=[];
 for(const o of body.slice(0,120)){
  if(!isObj(o))continue;const id=o.NORAD_CAT_ID,name=str(o.OBJECT_NAME,80);
  const epoch=typeof o.EPOCH==='string'?Date.parse(/Z$/.test(o.EPOCH)?o.EPOCH:o.EPOCH+'Z'):NaN;
  const el=['MEAN_MOTION','ECCENTRICITY','INCLINATION','RA_OF_ASC_NODE','ARG_OF_PERICENTER','MEAN_ANOMALY','BSTAR'].map(k=>num(o[k]));
  if(!Number.isInteger(id)||id<=0||!name||!Number.isFinite(epoch)||epoch>now+H||epoch<now-30*86400000||el.some(v=>v===null))continue;
  out.push({metric:'orbit',location:'global',observationKey:`${id}:${new Date(epoch).toISOString()}`,observedAt:new Date(epoch).toISOString(),payload:{noradId:id,name,objectId:str(o.OBJECT_ID,20),epoch:new Date(epoch).toISOString(),meanMotion:el[0],eccentricity:el[1],inclination:el[2],raOfAscNode:el[3],argOfPericenter:el[4],meanAnomaly:el[5],bstar:el[6],meanMotionDot:num(o.MEAN_MOTION_DOT),meanMotionDdot:num(o.MEAN_MOTION_DDOT),elementSetNo:num(o.ELEMENT_SET_NO),revAtEpoch:num(o.REV_AT_EPOCH),isIss:id===25544,source:'CelesTrak GP (OMM)',kind:'orbital_elements_for_sgp4_pass_prediction'}});
 }
 if(!out.length)throw Error('CelesTrak response without valid element sets');
 return out;
}

// ---------- Ground stations: OpenAQ v3 (API key) ----------
export const OPENAQ_LOCATIONS_URL='https://api.openaq.org/v3/locations?bbox=60,23,78,38&limit=200';
export function openaqLatestUrl(id){if(!Number.isInteger(id)||id<=0)throw Error('Invalid OpenAQ location');return `https://api.openaq.org/v3/locations/${id}/latest`;}
/** Recent locations (last reading within 3 days), newest first, capped. */
export function parseOpenaqLocations(body,now=Date.now(),max=15){
 if(!Array.isArray(body?.results))throw Error('Malformed OpenAQ locations response');
 const out=[];
 for(const l of body.results){
  const id=l?.id,last=Date.parse(String(l?.datetimeLast?.utc??''));
  const lat=num(l?.coordinates?.latitude),lon=num(l?.coordinates?.longitude);
  if(!Number.isInteger(id)||!Number.isFinite(last)||last<now-3*86400000||lat===null||lon===null||lon<60||lon>78||lat<23||lat>38)continue;
  const sensors=new Map();for(const s of Array.isArray(l.sensors)?l.sensors:[])if(Number.isInteger(s?.id)&&typeof s?.parameter?.name==='string')sensors.set(s.id,{parameter:s.parameter.name.slice(0,30),units:str(s.parameter.units,20),label:str(s.parameter.displayName,40)});
  if(!sensors.size)continue;
  out.push({id,name:str(l.name,120)??'Station',locality:str(l.locality,120),latitude:lat,longitude:lon,last,sensors});
 }
 return out.sort((a,b)=>b.last-a.last).slice(0,max);
}
export function parseOpenaqLatest(body,location,now=Date.now()){
 if(!Array.isArray(body?.results))throw Error('Malformed OpenAQ latest response');
 const readings=[];
 for(const r of body.results){
  const s=location.sensors.get(r?.sensorsId),v=num(r?.value),at=Date.parse(String(r?.datetime?.utc??''));
  if(!s||v===null||v<0||!Number.isFinite(at)||at<now-3*86400000||at>now+H)continue;
  readings.push({parameter:s.parameter,label:s.label,units:s.units,value:v,observedAt:new Date(at).toISOString()});
 }
 if(!readings.length)return [];
 const newest=readings.reduce((m,r)=>Math.max(m,Date.parse(r.observedAt)),0);
 return [{metric:'aq_station',location:'bounding-box',observationKey:`${location.id}:${new Date(newest).toISOString()}`,observedAt:new Date(newest).toISOString(),payload:{locationId:location.id,name:location.name,locality:location.locality,latitude:location.latitude,longitude:location.longitude,readings,source:'OpenAQ',kind:'ground_station_measurement'}}];
}

// ---------- Extra NASA GIBS map layers (verified by a live tile probe before publishing) ----------
export const GIBS_EXTRA_LAYERS=Object.freeze([
 {id:'nightlights',label:'Night lights (VIIRS)',layer:'VIIRS_SNPP_DayNightBand_ENCC',candidates:[['GoogleMapsCompatible_Level8','png'],['GoogleMapsCompatible_Level8','jpg'],['GoogleMapsCompatible_Level7','png']]},
 {id:'aerosol',label:'Dust & haze (aerosol optical depth)',layer:'MODIS_Combined_Value_Added_AOD',candidates:[['GoogleMapsCompatible_Level6','png'],['GoogleMapsCompatible_Level7','png']]},
 {id:'snow',label:'Snow cover (MODIS)',layer:'MODIS_Terra_NDSI_Snow_Cover',candidates:[['GoogleMapsCompatible_Level8','png'],['GoogleMapsCompatible_Level7','png']]}
]);
const day=d=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('Invalid imagery date');return d;};
const known=(layer,matrix,ext)=>GIBS_EXTRA_LAYERS.some(l=>l.layer===layer&&l.candidates.some(([m,e])=>m===matrix&&e===ext));
export function gibsLayerProbeUrl(layer,matrix,ext,d){if(!known(layer,matrix,ext))throw Error('Unapproved GIBS layer');return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${day(d)}/${matrix}/4/6/11.${ext}`;}
export function gibsLayerTemplate(layer,matrix,ext,d){if(!known(layer,matrix,ext))throw Error('Unapproved GIBS layer');return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${day(d)}/${matrix}/{z}/{y}/{x}.${ext}`;}
export function gibsMaxZoom(matrix){const m=/Level(\d)$/.exec(matrix);return m?Number(m[1]):6;}
