// Satify pure logic: derived signals, message rendering, alert rules and WhatsApp commands.
// No database or network here, so every rule is unit-tested.
import {SIGNALS,ROUTES,SATIFY_CITIES,scopeLabel} from './catalog.mjs';

const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const PKT=5*3600000;

export function aqiBand(aqi){aqi=num(aqi);if(aqi===null)return null;
 return aqi<=50?'Good':aqi<=100?'Moderate':aqi<=150?'Unhealthy for sensitive groups':aqi<=200?'Unhealthy':aqi<=300?'Very unhealthy':'Hazardous';}

/** Fog risk from measured visibility, forecast fog cover and humidity. */
export function fogRisk(visibilityKm,fogPct,humidityPct){
 const v=num(visibilityKm),f=num(fogPct),h=num(humidityPct);
 if(v===null&&f===null&&h===null)return null;
 if((v!==null&&v<1)||(f!==null&&f>=50))return 'High';
 if((v!==null&&v<3)||(f!==null&&f>=20)||(h!==null&&h>=95))return 'Medium';
 return 'Low';
}
/** Local (PKT) HH:MM when forecast fog cover first drops below 10% after a foggy hour; null if no fog in the next 18 hours. */
export function fogClearTime(fogHourly,now=Date.now()){
 if(!Array.isArray(fogHourly))return null;
 const rows=fogHourly.map(x=>({at:Date.parse(x?.at),f:num(x?.fogPct)})).filter(x=>Number.isFinite(x.at)&&x.f!==null&&x.at>=now-3600000&&x.at<=now+18*3600000).sort((a,b)=>a.at-b.at);
 const foggy=rows.findIndex(x=>x.f>=20);if(foggy<0)return null;
 const clear=rows.slice(foggy).find(x=>x.f<10);if(!clear)return 'after '+pktClock(rows[rows.length-1].at);
 return pktClock(clear.at);
}
export function pktClock(ms){return new Date(ms+PKT).toISOString().slice(11,16);}
export function pktDate(ms){return new Date(ms+PKT).toISOString().slice(0,10);}
export function pktMinutes(ms){const d=new Date(ms+PKT);return d.getUTCHours()*60+d.getUTCMinutes();}

/** Prediction only. An official notice always wins and is shown separately. */
export function schoolClosureChance({aqiForecastMax,tempMax,fogRisk:fog}){
 const a=num(aqiForecastMax),t=num(tempMax);
 if(a===null&&t===null&&!fog)return null;
 if((a!==null&&a>=350)||(t!==null&&t>=45))return 'High';
 if((a!==null&&a>=250)||(t!==null&&t>=42)||fog==='High')return 'Medium';
 return 'Low';
}
export function motorwayStatus(minVisibilityKm,nhmpText){
 if(typeof nhmpText==='string'&&/clos|band|block/i.test(nhmpText))return 'Closed (NHMP notice)';
 const v=num(minVisibilityKm);if(v===null)return null;
 if(v<1)return 'Dense fog: closures likely';
 if(v<3)return 'Fog: drive slowly';
 return 'Clear';
}

/** City-level derived readings from the satellite hub payloads (weather + air) and Satify readings. */
export function deriveCity(city,{weather,air,visibilityKm},now=Date.now()){
 const out=[];const w=weather??{},a=air??{};
 const cur=w.current??{},today=Array.isArray(w.daily)?w.daily[0]??{}:{};
 const values=a.values??{},next=a.next24h??{};
 const src=w.source??'MET Norway',asrc=a.source??'Copernicus CAMS';
 const push=(signal,value,text,source,badge)=>{if(value!==null||text!==null)out.push({signal,scope:city,value,text,badge:badge??SIGNALS[signal].badge,source});};
 const aqi=num(values.us_aqi);push('aqi',aqi,null,asrc);push('aqi_label',null,aqiBand(aqi),asrc);
 push('pm25',num(values.pm2_5),null,asrc);
 const peak=num(next.maxUsAqi);push('aqi_forecast_max',peak,null,asrc);push('aqi_forecast_label',null,aqiBand(peak),asrc);
 push('temp_now',num(cur.temperatureC),null,src);push('temp_max',num(today.maxC),null,src);push('temp_min',num(today.minC),null,src);
 push('feels_max',num(today.feelsLikeMaxC),null,src);push('rain_chance',num(today.rainChancePct),null,src);push('uv_max',num(today.uvIndexMax),null,src);
 push('fog_pct',num(cur.fogPct),null,src);
 const risk=fogRisk(visibilityKm,cur.fogPct,cur.humidityPct);push('fog_risk',null,risk,'Satify (METAR + MET Norway)');
 push('fog_clear_time',null,fogClearTime(w.fogHourly,now),src);
 push('school_closure_chance',null,schoolClosureChance({aqiForecastMax:peak,tempMax:num(today.maxC),fogRisk:risk}),'Satify prediction (smog, heat, fog)');
 return out;
}
/** Route readings from the cities at each end. */
export function deriveRoutes(cityVisibility,cityFogClear,nhmpByRoute={}){
 const out=[];
 for(const [id,r] of Object.entries(ROUTES)){
  const vis=r.cities.map(c=>num(cityVisibility[c])).filter(v=>v!==null);
  const min=vis.length?Math.min(...vis):null;
  if(min!==null)out.push({signal:'route_visibility_km',scope:id,value:min,text:null,badge:'measured',source:'METAR (route-end airports)'});
  const clears=r.cities.map(c=>cityFogClear[c]).filter(x=>typeof x==='string'&&x);
  if(clears.length)out.push({signal:'route_fog_clear_time',scope:id,value:null,text:clears.sort().at(-1),badge:'forecast',source:'MET Norway fog forecast'});
  const status=motorwayStatus(min,nhmpByRoute[id]);
  if(status)out.push({signal:'motorway_status',scope:id,value:null,text:status,badge:'estimate',source:'Satify (airport visibility + NHMP notices)'});
 }
 return out;
}

/** Formats one signal for a message. */
export function formatSignal(id,s){
 const def=SIGNALS[id];
 if(!s||(s.value===null&&!s.text))return def?.fallback??'—';
 if(s.text&&s.value===null)return s.text;
 const v=s.value;
 const n=Math.abs(v)>=1000?Math.round(v).toLocaleString('en-US'):Math.round(v*10)/10;
 return String(n);
}
/** Renders "{aqi}" style templates. {city}/{route}/{scope} become the scope name. Unknown tokens stay visible for the admin. */
export function renderTemplate(template,scope,signals){
 const name=scopeLabel(scope);
 return String(template).replace(/\{([a-z0-9_]+)\}/g,(m,id)=>{
  if(id==='city'||id==='route'||id==='scope')return name;
  if(!Object.hasOwn(SIGNALS,id))return m;
  return formatSignal(id,signals[id]);
 }).replace(/[ \t]+\n/g,'\n').trim();
}
export function templateTokens(template){return [...new Set([...String(template).matchAll(/\{([a-z0-9_]+)\}/g)].map(m=>m[1]))];}
/** Required (non-optional) signals that are missing or older than maxAgeHours. */
export function missingSignals(ids,signals,now=Date.now(),maxAgeHours=30){
 return ids.filter(id=>{const def=SIGNALS[id];if(!def||def.optional)return false;const s=signals[id];
  if(!s||(s.value===null&&!s.text))return true;const at=Date.parse(s.observedAt??'');return !Number.isFinite(at)||at<now-maxAgeHours*3600000;});
}

/** Urgent rule: {signal, op: '>=' | '<=' | '==' | 'exists', value?, label}. Returns the matched value key or null. */
export function evalRule(rule,signals){
 const s=signals[rule?.signal];if(!s)return null;
 const v=s.value,t=s.text;
 switch(rule.op){
  case 'exists':return t||v!==null?`exists:${String(t??v).slice(0,80)}`:null;
  case '>=':return num(v)!==null&&num(rule.value)!==null&&v>=rule.value?`ge:${rule.value}`:null;
  case '<=':return num(v)!==null&&num(rule.value)!==null&&v<=rule.value?`le:${rule.value}`:null;
  case '==':return (t??String(v))===String(rule.value)?`eq:${rule.value}`:null;
  default:return null;
 }
}
export function validRule(rule){
 return rule&&typeof rule==='object'&&Object.hasOwn(SIGNALS,rule.signal)&&['>=','<=','==','exists'].includes(rule.op)
  &&(rule.op==='exists'||rule.value!==undefined)&&typeof (rule.label??'')==='string'&&String(rule.label??'').length<=80;
}

/** Daily brief window: from daily_at up to 59 minutes after (so a missed minute still sends once). */
export function dailyDue(dailyAt,now=Date.now()){
 if(typeof dailyAt!=='string'||!/^\d{2}:\d{2}$/.test(dailyAt))return false;
 const [h,m]=dailyAt.split(':').map(Number);const start=h*60+m,cur=pktMinutes(now);
 return cur>=start&&cur<start+60;
}

/** WhatsApp commands: JOIN <CODE> [CITY|ROUTE], STOP [CODE], LIST, HELP. */
export function parseCommand(text){
 const words=String(text??'').trim().toUpperCase().replace(/[^A-Z0-9\- ]/g,' ').split(/\s+/).filter(Boolean).slice(0,4);
 if(!words.length)return {type:'help'};
 const [w0,w1,w2]=words;
 if(w0==='JOIN'||w0==='START'||w0==='SUBSCRIBE')return w1?{type:'join',code:w1,place:w2?normalisePlace(w2):null}:{type:'help'};
 if(w0==='STOP'||w0==='UNSUBSCRIBE')return {type:'stop',code:w1??null};
 if(w0==='LIST'||w0==='MY')return {type:'list'};
 return {type:'help'};
}
export function normalisePlace(word){
 const w=String(word).toLowerCase().replace(/-/g,'');
 if(Object.hasOwn(SATIFY_CITIES,w))return w;
 if(Object.hasOwn(ROUTES,w))return w;
 const aliases={isb:'islamabad',lhr:'lahore',khi:'karachi',pindi:'islamabad',rawalpindi:'islamabad',fsd:'faisalabad',pesh:'peshawar'};
 return aliases[w]??null;
}
export function maskPhone(phone){const p=String(phone);return p.length>4?`•••${p.slice(-4)}`:'••••';}
export function normalisePhone(input){
 let p=String(input??'').replace(/[^0-9+]/g,'');
 if(p.startsWith('+'))p=p.slice(1);else if(p.startsWith('00'))p=p.slice(2);else if(/^03\d{9}$/.test(p))p='92'+p.slice(1);
 return /^[0-9]{8,15}$/.test(p)?p:null;
}
/** WhatsApp template parameters cannot contain new lines or long runs of spaces. */
export function flattenForTemplate(body){return String(body).replace(/\s*\n+\s*/g,' · ').replace(/\s{2,}/g,' ').slice(0,1000);}
