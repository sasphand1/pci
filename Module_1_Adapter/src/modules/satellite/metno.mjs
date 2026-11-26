// MET Norway Locationforecast 2.0 ("complete"): free, including commercial use, with attribution.
// Terms: identify the app in User-Agent; outside the Nordics cache at least 3 hours (weather minMinutes=180).
// Produces exactly the payload shape the existing insights expect (current, daily[], heatDays),
// plus fogHourly for Satify's fog clearing time.
import {CITIES} from './catalog.mjs';

export const METNO_URL='https://api.met.no/weatherapi/locationforecast/2.0/complete';
const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const isObj=v=>Boolean(v)&&typeof v==='object'&&!Array.isArray(v);
const PKT_OFFSET_MS=5*3600000;

export function metnoUserAgent(env=process.env){
 const contact=(env.SATIFY_CONTACT||'https://github.com/sasphand1/pci').slice(0,120);
 return `Satify-Pulsr/1.0 (${contact})`;
}
export function metnoUrl(city){
 const c=CITIES[city];if(!c)throw Error('Unknown city');
 const [lon,lat]=c;
 // MET asks for at most 4 decimals.
 return `${METNO_URL}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
}

const SYMBOL_CODES=[
 [/thunder/,95],[/heavysnow/,75],[/^snow/,73],[/lightsnow/,71],[/heavysleet/,67],[/^sleet/,67],[/lightsleet/,66],
 [/heavyrain/,65],[/^rainshowers/,81],[/^rain/,63],[/lightrainshowers/,80],[/lightrain/,61],
 [/fog/,45],[/^cloudy/,3],[/partlycloudy/,2],[/fair/,1],[/clearsky/,0]
];
/** MET symbol_code ("partlycloudy_day") → WMO-style weather code used elsewhere in PCI. */
export function symbolToCode(symbol){
 if(typeof symbol!=='string')return null;
 const s=symbol.replace(/_(day|night|polartwilight)$/,'');
 for(const [re,code] of SYMBOL_CODES)if(re.test(s))return code;
 return null;
}
/** NOAA heat index (feels-like) in °C. Below 27°C or 40% humidity the air temperature is returned. */
export function heatIndexC(tC,rh){
 if(tC===null)return null;if(rh===null||tC<27||rh<40)return tC;
 const T=tC*9/5+32,R=rh;
 const hi=-42.379+2.04901523*T+10.14333127*R-0.22475541*T*R-0.00683783*T*T-0.05481717*R*R+0.00122874*T*T*R+0.00085282*T*R*R-0.00000199*T*T*R*R;
 return Math.round(((hi-32)*5/9)*10)/10;
}
const pktDate=ms=>new Date(ms+PKT_OFFSET_MS).toISOString().slice(0,10);
const r1=v=>v===null?null:Math.round(v*10)/10;

export function parseMetno(body,city,now=Date.now()){
 if(!CITIES[city])throw Error('Unknown city');
 const series=body?.properties?.timeseries;
 if(!Array.isArray(series)||!series.length)throw Error('Malformed MET Norway response');
 const rows=series.map(e=>{
  const at=Date.parse(e?.time);const d=e?.data;if(!Number.isFinite(at)||!isObj(d))return null;
  const i=isObj(d.instant?.details)?d.instant.details:{};const n1=d.next_1_hours,n6=d.next_6_hours;
  const has1=isObj(n1?.details);
  return {at,temp:num(i.air_temperature),rh:num(i.relative_humidity),windMs:num(i.wind_speed),fog:num(i.fog_area_fraction),
   uv:num(i.ultraviolet_index_clear_sky),dew:num(i.dew_point_temperature),
   rain:has1?num(n1.details.precipitation_amount):isObj(n6?.details)?num(n6.details.precipitation_amount):null,
   chance:has1?num(n1.details.probability_of_precipitation):isObj(n6?.details)?num(n6.details.probability_of_precipitation):null,
   code:symbolToCode(has1?n1?.summary?.symbol_code:n6?.summary?.symbol_code)};
 }).filter(Boolean).sort((a,b)=>a.at-b.at);
 const first=rows.find(x=>x.temp!==null);if(!first)throw Error('MET Norway response without temperature');
 const current={temperatureC:first.temp,feelsLikeC:heatIndexC(first.temp,first.rh),humidityPct:first.rh,precipitationMm:first.rain,
  windKmh:first.windMs===null?null:r1(first.windMs*3.6),weatherCode:first.code,fogPct:first.fog,dewPointC:first.dew};
 const byDay=new Map();
 for(const x of rows){const k=pktDate(x.at);if(!byDay.has(k))byDay.set(k,[]);byDay.get(k).push(x);}
 const daily=[...byDay.entries()].slice(0,7).map(([date,xs])=>{
  const temps=xs.map(x=>x.temp).filter(v=>v!==null),feels=xs.map(x=>heatIndexC(x.temp,x.rh)).filter(v=>v!==null);
  const rains=xs.map(x=>x.rain).filter(v=>v!==null),chances=xs.map(x=>x.chance).filter(v=>v!==null);
  const uvs=xs.map(x=>x.uv).filter(v=>v!==null),winds=xs.map(x=>x.windMs).filter(v=>v!==null),codes=xs.map(x=>x.code).filter(v=>v!==null);
  return {date,maxC:temps.length?r1(Math.max(...temps)):null,minC:temps.length?r1(Math.min(...temps)):null,
   feelsLikeMaxC:feels.length?r1(Math.max(...feels)):null,rainMm:rains.length?r1(rains.reduce((a,b)=>a+b,0)):null,
   rainChancePct:chances.length?Math.max(...chances):null,uvIndexMax:uvs.length?r1(Math.max(...uvs)):null,
   windMaxKmh:winds.length?r1(Math.max(...winds)*3.6):null,weatherCode:codes.length?Math.max(...codes):null};
 });
 const fogHourly=rows.filter(x=>x.at>=now-3600000&&x.at<=now+30*3600000&&x.fog!==null).map(x=>({at:new Date(x.at).toISOString(),fogPct:x.fog}));
 const heatDays=daily.filter(x=>(x.feelsLikeMaxC??x.maxC??0)>=40).length;
 const updated=Date.parse(body?.properties?.meta?.updated_at);
 const observedAt=new Date(Number.isFinite(updated)?updated:first.at).toISOString();
 return [{metric:'weather',location:city,observationKey:city,observedAt,payload:{current,daily,heatDays,fogHourly,
  source:'MET Norway Locationforecast',kind:'model_forecast_not_official_pmd_warning',licence:'CC BY 4.0 / NLOD, MET Norway'}}];
}
