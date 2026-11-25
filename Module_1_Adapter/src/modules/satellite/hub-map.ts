/** Pure mapping from satellite records to comparable hub readings (no database access). */
import type {SatelliteBatchObservation} from './bulk.mjs';
export type HubReading={entityKind:string;entityId:string;metric:string;value:number|null;scale:number;text:string|null;observedAt:string;meta?:Record<string,unknown>};
export const hubSourceId=(provider:string)=>`sat_${provider}.api`;
export const KIND=/^[a-z][a-z0-9_]{1,31}$/,METRIC=/^[a-z][a-z0-9_]{0,63}$/;

function n(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v:null;}
function r(entityKind:string,entityId:string,metric:string,value:unknown,scale:number,observedAt:string,meta?:Record<string,unknown>,text:string|null=null):HubReading{return {entityKind,entityId,metric,value:n(value),scale,text,observedAt,meta};}

/** Comparable readings per satellite record. Detailed payloads stay in satellite.observations. */
export function hubReadings(provider:string,rows:SatelliteBatchObservation[]):HubReading[]{
 const out:HubReading[]=[];
 if(provider==='firms'){
  // One regional count per run instead of every hotspot point.
  const newest=rows.reduce((m,x)=>Math.max(m,Date.parse(x.observedAt)||0),0);
  if(rows.length)out.push(r('region','region:pakistan','fire_hotspots_3d',rows.length,0,new Date(newest).toISOString()));
  return out;
 }
 for(const x of rows){
  const p=x.payload as Record<string,any>;const city=`city:${x.location}`;
  switch(x.metric){
   case 'rainfall':out.push(r('city',city,'rainfall_mm',p.value,2,x.observedAt));break;
   case 'solar':out.push(r('city',city,'solar_kwh_m2',p.value,2,x.observedAt));break;
   case 'earthquake':out.push(r('earthquake',`usgs:${p.eventId}`,'magnitude',p.magnitude,1,x.observedAt,{place:p.place,depthKm:p.depthKm}));break;
   case 'natural_event':out.push(r('natural_event',`eonet:${p.eventId}`,'event',null,0,x.observedAt,{categories:p.categories},String(p.title??'Natural event').slice(0,200)));break;
   case 'imagery':out.push(r('map_layer',`gibs:${p.layerId??p.layer??'true_colour'}`,'latest_day',null,0,x.observedAt,undefined,String(p.day)));break;
   case 'air_quality':{const v=p.values??{};
    for(const [k,metric,scale] of [['us_aqi','us_aqi',0],['pm2_5','pm2_5',1],['pm10','pm10',1],['nitrogen_dioxide','no2',1],['ozone','o3',1],['dust','dust',1],['uv_index','uv_index',1]] as const)
     if(n(v[k])!==null)out.push(r('city',city,metric,v[k],scale,x.observedAt));break;}
   case 'weather':{const c=p.current??{};
    for(const [k,metric,scale] of [['temperatureC','temperature_c',1],['feelsLikeC','feels_like_c',1],['humidityPct','humidity_pct',0],['precipitationMm','precipitation_mm',1],['windKmh','wind_kmh',1]] as const)
     if(n(c[k])!==null)out.push(r('city',city,metric,c[k],scale,x.observedAt));
    if(n(p.heatDays)!==null)out.push(r('city',city,'heat_days_7d',p.heatDays,0,x.observedAt));break;}
   case 'river_flow':out.push(r('river_point',`river:${x.location}`,'discharge_m3s',p.dischargeM3s,1,x.observedAt,{river:p.river,place:p.place}));
    if(n(p.peak30?.max)!==null)out.push(r('river_point',`river:${x.location}`,'peak_30d_m3s',p.peak30.max,1,x.observedAt,{date:p.peak30.date}));break;
   case 'disaster_alert':out.push(r('disaster_alert',`gdacs:${p.eventType}:${p.eventId}`,'alert_score',p.alertScore,1,x.observedAt,{name:p.name,severity:p.severityText},String(p.alertLevel)));break;
   case 'space_weather':out.push(r('space','space:kp','kp_index',p.kp,2,x.observedAt,{scale:p.scale}));break;
   case 'orbit':out.push(r('orbiting_object',`norad:${p.noradId}`,'orbital_elements',null,0,x.observedAt,{name:p.name},String(p.epoch)));break;
   case 'aq_station':for(const reading of Array.isArray(p.readings)?p.readings:[]){
     const metric=String(reading.parameter??'').toLowerCase().replace(/[^a-z0-9_]/g,'_');
     if(METRIC.test(metric)&&n(reading.value)!==null)out.push(r('aq_station',`openaq:${p.locationId}`,metric,reading.value,2,String(reading.observedAt),{name:p.name}));}
    break;
  }
 }
 return out;
}

