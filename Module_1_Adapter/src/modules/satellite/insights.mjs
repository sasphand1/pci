// Combined, plain-language scores built ONLY from observations PCI already stores.
// Pure functions: no I/O, no clock unless passed in, so every rule is unit-tested.
// These are decision aids from modelled/open data. They are never presented as official
// PMD, NDMA or FFD warnings, and each result lists the inputs it used.

const num=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const round=(v,d=0)=>v===null?null:Math.round(v*10**d)/10**d;
const sum=a=>a.reduce((s,v)=>s+(num(v)??0),0);
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
const WEEKDAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
export const dayName=date=>{const t=Date.parse(String(date)+'T00:00:00Z');return Number.isFinite(t)?WEEKDAY[new Date(t).getUTCDay()]:String(date);};

/** Great-circle distance in km. */
export function distanceKm(lat1,lon1,lat2,lon2){
 const r=Math.PI/180,a=Math.sin((lat2-lat1)*r/2)**2+Math.cos(lat1*r)*Math.cos(lat2*r)*Math.sin((lon2-lon1)*r/2)**2;
 return 12742*Math.asin(Math.sqrt(Math.min(1,a)));
}

// ---------- Go-Out Score ----------
export function airPenalty(aqi){
 if(aqi===null)return 0;
 if(aqi<=50)return 0;if(aqi<=100)return (aqi-50)*0.3;if(aqi<=150)return 15+(aqi-100)*0.5;
 if(aqi<=200)return 40+(aqi-150)*0.4;return Math.min(75,60+(aqi-200)*0.15);
}
export function heatPenalty(feels){
 if(feels===null)return 0;
 if(feels<5)return Math.min(15,(5-feels)*2);if(feels<=32)return 0;if(feels<=40)return (feels-32)*2.5;return Math.min(40,20+(feels-40)*3);
}
export function uvPenalty(uv){if(uv===null)return 0;return uv>=11?15:uv>=8?10:uv>=6?5:0;}
export function rainPenalty(chance,mm){if(chance===null&&mm===null)return 0;if((chance??0)>=70&&(mm??0)>=5)return 10;if((chance??0)>=50||(mm??0)>=5)return 5;return 0;}
export const GO_OUT_LEVELS=Object.freeze([
 {min:75,level:'good',label:'Good to go out'},{min:55,level:'fair',label:'Fine, take some care'},
 {min:35,level:'limit',label:'Limit time outdoors'},{min:0,level:'avoid',label:'Stay indoors if you can'}]);

/** One 0-100 number per city from air quality, feels-like heat, UV and rain. Null when nothing is known. */
export function goOutScore(air,weather){
 const a=obj(air),w=obj(weather),values=obj(a.values),today=obj((Array.isArray(w.daily)?w.daily:[])[0]),now=obj(w.current);
 const aqi=num(values.us_aqi),feels=num(today.feelsLikeMaxC)??num(now.feelsLikeC)??num(today.maxC),uv=num(today.uvIndexMax)??num(values.uv_index);
 const chance=num(today.rainChancePct),mm=num(today.rainMm);
 if(aqi===null&&feels===null)return null;
 const parts={air:round(airPenalty(aqi),1),heat:round(heatPenalty(feels),1),uv:uvPenalty(uv),rain:rainPenalty(chance,mm)};
 const score=Math.round(clamp(100-parts.air-parts.heat-parts.uv-parts.rain,0,100));
 const band=GO_OUT_LEVELS.find(x=>score>=x.min);
 const advice=[];
 if(aqi!==null&&aqi>150)advice.push('Mask (N95) advised, especially for children, the elderly and people with asthma.');
 else if(aqi!==null&&aqi>100)advice.push('Sensitive groups should cut long outdoor exercise.');
 if(feels!==null&&feels>=40)advice.push('Avoid 12 to 4 pm in the sun and drink water often.');
 else if(feels!==null&&feels>=35)advice.push('Hot afternoon: carry water and take shade breaks.');
 if(uv!==null&&uv>=8)advice.push('Very high UV: shade, hat and sunscreen from 11 am to 3 pm.');
 if(parts.rain>=10)advice.push('Heavy rain likely: plan travel around it.');
 if(feels!==null&&feels<5)advice.push('Cold: dress warmly in the early morning and evening.');
 if(!advice.length)advice.push('No special precautions needed.');
 return {score,level:band.level,label:band.label,advice,inputs:{usAqi:aqi,feelsLikeMaxC:feels,uvIndexMax:uv,rainChancePct:chance,rainMm:mm},penalties:parts,partial:aqi===null||feels===null,
  observedAt:a.observedAt??w.observedAt??null,sources:['Copernicus CAMS (modelled air quality)','MET Norway forecast']};
}

// ---------- Daily maxima from hourly air-quality history ----------
export function dailyMaxAqi(history){
 const byDay=new Map();
 for(const r of Array.isArray(history)?history:[]){const x=obj(r),v=num(obj(x.values).us_aqi),d=typeof x.observedAt==='string'?x.observedAt.slice(0,10):x.observedAt instanceof Date?x.observedAt.toISOString().slice(0,10):null;
  if(v===null||!d)continue;byDay.set(d,Math.max(byDay.get(d)??0,v));}
 return [...byDay.entries()].sort((a,b)=>a[0]<b[0]?-1:1).map(([date,maxUsAqi])=>({date,maxUsAqi}));
}
export function averageAqi(history){const v=(Array.isArray(history)?history:[]).map(r=>num(obj(obj(r).values).us_aqi)).filter(x=>x!==null);return v.length?round(sum(v)/v.length):null;}

/** Smog and heat watch for one city. */
export function smogHeatWatch(air,history,weather){
 const days=dailyMaxAqi(history).slice(-7),w=obj(weather),daily=Array.isArray(w.daily)?w.daily:[];
 const smogDays=days.filter(d=>d.maxUsAqi>150).length;
 const hotDays=daily.filter(d=>(num(obj(d).feelsLikeMaxC)??num(obj(d).maxC)??0)>=40).map(d=>dayName(obj(d).date));
 const next24=num(obj(obj(air).next24h).maxUsAqi);
 return {smogDaysPast7:smogDays,daysMeasured:days.length,next24hMaxAqi:next24,heatDaysNext7:hotDays.length,hotDays,
  summary:`${smogDays} smog day(s) (AQI above 150) in the last ${days.length||7} days; ${hotDays.length} day(s) at 40 °C feels-like or more ahead${hotDays.length?` (${hotDays.join(', ')})`:''}.`};
}

// ---------- Nearby hazards ----------
export function nearestRiver(lat,lon,rivers,maxKm=200){
 let best=null;
 for(const r of Array.isArray(rivers)?rivers:[]){const x=obj(r),la=num(x.latitude),lo=num(x.longitude);if(la===null||lo===null)continue;
  const d=distanceKm(lat,lon,la,lo);if(d<=maxKm&&(!best||d<best.distanceKm))best={...x,distanceKm:Math.round(d)};}
 return best;
}
export function riverStatus(ratio){const r=num(ratio);return r===null?'unknown':r>=3?'flood_watch':r>=1.5?'rising':'normal';}
const RIVER_TEXT={flood_watch:'flood watch',rising:'rising',normal:'normal',unknown:'no outlook'};
export function riverLine(r){if(!r)return 'No modelled river point within 200 km.';const x=obj(r),s=riverStatus(x.peakToTodayRatio),pk=obj(x.peak30);
 return `${x.river} at ${x.place}: ${RIVER_TEXT[s]}, ${round(num(x.dischargeM3s))} m³/s today${num(pk.max)!==null?`, 30-day peak ${round(num(pk.max))} m³/s around ${pk.date}`:''}.`;}

/** Is my area safe today: alerts, recent quakes, nearby fire detections and rivers. */
export function safetyToday(lat,lon,{alerts=[],quakes=[],fires=[],rivers=[]}={},now=Date.now()){
 const items=[];let level=0;
 const near=(x,km)=>{const la=num(x.latitude),lo=num(x.longitude);return la!==null&&lo!==null&&distanceKm(lat,lon,la,lo)<=km;};
 const al=alerts.map(obj).filter(a=>a.affectsPakistan===true||near(a,600));
 const severe=al.filter(a=>a.alertLevel==='Red'||a.alertLevel==='Orange');
 if(severe.length){level=Math.max(level,2);items.push(`${severe.length} orange/red GDACS alert(s): ${severe.slice(0,2).map(a=>a.name).join('; ')}.`);}
 else if(al.length){level=Math.max(level,1);items.push(`${al.length} green (minor) GDACS alert(s) in the region.`);}
 const qk=quakes.map(obj).filter(q=>near(q,300)&&(num(q.magnitude)??0)>=4&&now-Date.parse(String(q.observedAt))<=7*86400000);
 if(qk.length){const m=Math.max(...qk.map(q=>num(q.magnitude)));level=Math.max(level,m>=5.5?2:1);items.push(`${qk.length} earthquake(s) M4+ within 300 km in 7 days (largest M${m}).`);}
 const fr=fires.map(obj).filter(f=>near(f,50));
 if(fr.length){level=Math.max(level,fr.length>=10?1:0);items.push(`${fr.length} satellite heat detection(s) within 50 km (fires, burning or industry).`);}
 const rv=nearestRiver(lat,lon,rivers,150);const rs=rv?riverStatus(rv.peakToTodayRatio):'unknown';
 if(rs==='flood_watch'){level=Math.max(level,2);items.push(riverLine(rv));}else if(rs==='rising'){level=Math.max(level,1);items.push(riverLine(rv));}
 const labels=['Clear','Watch','Warning'];
 return {level:['clear','watch','warning'][level],label:labels[level],items:items.length?items:['No alerts, recent nearby earthquakes, nearby fires or rising rivers in our data.'],
  note:'From GDACS, USGS, NASA FIRMS and GloFAS. Always follow NDMA and PMD instructions.'};
}

// ---------- Farmers ----------
/** Irrigation advice from observed rain (NASA POWER, 2-3 day delay), forecast rain and heat. */
export function irrigationAdvice(pastRain,weather){
 const w=obj(weather),daily=Array.isArray(w.daily)?w.daily:[];
 const past=(Array.isArray(pastRain)?pastRain:[]).map(r=>num(obj(r).value)).filter(v=>v!==null);
 const past7=past.length?round(sum(past.slice(0,7)),1):null,next7=daily.length?round(sum(daily.map(d=>obj(d).rainMm)),1):null;
 const hot=daily.filter(d=>(num(obj(d).maxC)??0)>=35).length;
 if(next7===null)return {decision:'unknown',label:'Forecast unavailable',past7,next7,detail:'Not enough data for advice.'};
 let decision,label;
 if(next7>=20){decision='wait';label='Hold irrigation: heavy rain expected';}
 else if(next7>=5){decision='wait';label='Rain expected: check soil before irrigating';}
 else if((past7??0)+next7<10&&hot>=2){decision='irrigate';label='Irrigate this week';}
 else if((past7??0)+next7<10){decision='irrigate_light';label='Light irrigation likely needed';}
 else {decision='check';label='Soil likely holding: check your fields';}
 return {decision,label,past7,next7,hotDays35:hot,detail:`Last 7 observed days ${past7??'n/a'} mm (NASA POWER), next 7 days ${next7} mm forecast, ${hot} day(s) at 35 °C or more.`};
}
/** Days fit for spraying: light wind, low rain chance, no rain. */
export function sprayWindows(weather){
 const daily=Array.isArray(obj(weather).daily)?obj(weather).daily:[];
 const good=daily.map(obj).filter(d=>num(d.windMaxKmh)!==null&&num(d.windMaxKmh)<15&&(num(d.rainChancePct)??0)<30&&(num(d.rainMm)??0)<1).map(d=>({date:d.date,day:dayName(d.date)}));
 return {days:good,label:good.length?`Best: ${good.slice(0,3).map(d=>d.day).join(', ')} mornings (light wind, dry)`:'No good spray day in the next 7 (windy or wet)'};
}
export function heatStress(weather){
 const daily=(Array.isArray(obj(weather).daily)?obj(weather).daily:[]).map(obj);
 const d=daily.filter(x=>(num(x.maxC)??0)>=40);const peak=daily.reduce((m,x)=>Math.max(m,num(x.maxC)??-99),-99);
 return {days:d.length,dayNames:d.map(x=>dayName(x.date)),peakC:peak>-99?peak:null,label:d.length?`${d.length} day(s) above 40 °C: ${d.map(x=>dayName(x.date)).join(', ')}`:`No day above 40 °C ahead${peak>-99?` (peak ${round(peak)} °C)`:''}`};
}

// ---------- Industries ----------
export function solarCard(solarHistory,air,weather){
 const s=(Array.isArray(solarHistory)?solarHistory:[]).map(r=>num(obj(r).value)).filter(v=>v!==null);
 const latest=s[0]??null,avg=s.length?sum(s)/s.length:null;
 const index=latest!==null&&avg?Math.round(latest/avg*100):null;
 const daily=Array.isArray(obj(weather).daily)?obj(weather).daily:[],rain7=sum(daily.map(d=>obj(d).rainMm));
 const v=obj(obj(air).values),dust=num(v.dust),pm10=num(v.pm10);
 const dusty=(dust!==null&&dust>=100)||(pm10!==null&&pm10>=150);
 const cleaning=dusty&&rain7<2?'clean':dusty?'rain_will_rinse':'ok';
 const sunnyDays=daily.filter(d=>(num(obj(d).weatherCode)??99)<=3).length;
 return {index,latestKwhM2:latest,avg30KwhM2:round(avg,2),sunnyDaysNext7:sunnyDays,cleaning,
  label:index===null?'Solar data unavailable':`Output index ${index} (latest day vs 30-day average)`,
  cleaningLabel:cleaning==='clean'?'Clean panels: dust high and no rain coming':cleaning==='rain_will_rinse'?'Dust high, but rain should rinse panels':'Panels: no extra cleaning needed'};
}
const LEVEL=['low','medium','high'];
export function riskCard(lat,lon,{weather,rivers=[],quakes=[],fires=[]}={}){
 const rv=nearestRiver(lat,lon,rivers,150),rs=rv?riverStatus(rv.peakToTodayRatio):'unknown';
 const daily=Array.isArray(obj(weather).daily)?obj(weather).daily:[],rain7=sum(daily.map(d=>obj(d).rainMm)),heat=num(obj(weather).heatDays)??0;
 const flood=rs==='flood_watch'||rain7>=60?2:rs==='rising'||rain7>=25?1:0;
 const heatL=heat>=3?2:heat>=1?1:0;
 const near=(x,km)=>{const la=num(obj(x).latitude),lo=num(obj(x).longitude);return la!==null&&lo!==null&&distanceKm(lat,lon,la,lo)<=km;};
 const qk=quakes.filter(q=>near(q,300)),qm=qk.reduce((m,q)=>Math.max(m,num(obj(q).magnitude)??0),0);
 const quake=qm>=5.5?2:qm>=4.5?1:0,fire=fires.filter(f=>near(f,50)).length>=10?1:0;
 const overall=Math.max(flood,heatL,quake,fire);
 const top=[['Flood',flood],['Heat',heatL],['Earthquake',quake],['Fire',fire]].filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).map(x=>`${x[0]} ${LEVEL[x[1]]}`);
 return {overall:LEVEL[overall],flood:LEVEL[flood],heat:LEVEL[heatL],earthquake:LEVEL[quake],fire:LEVEL[fire],
  label:`Risk: ${LEVEL[overall]}`,detail:top.length?top.join(', '):'All hazards low this week',window:'next 7 days (flood, heat); last 7 days (earthquakes, fires)'};
}
export function logisticsCard(lat,lon,{air,weather,alerts=[]}={}){
 const reasons=[];let lvl=0;
 const daily=(Array.isArray(obj(weather).daily)?obj(weather).daily:[]).map(obj);
 const heavy=daily.filter(d=>(num(d.rainMm)??0)>=20).map(d=>dayName(d.date));if(heavy.length){lvl=Math.max(lvl,1);reasons.push(`Heavy rain ${heavy.join(', ')}`);}
 const windy=daily.filter(d=>(num(d.windMaxKmh)??0)>=50).map(d=>dayName(d.date));if(windy.length){lvl=Math.max(lvl,1);reasons.push(`Strong wind ${windy.join(', ')}`);}
 const v=obj(obj(air).values),dust=num(v.dust);if(dust!==null&&dust>=300){lvl=Math.max(lvl,1);reasons.push('Dust storm: low visibility');}
 const al=alerts.map(obj).filter(a=>(a.alertLevel==='Red'||a.alertLevel==='Orange')&&(a.affectsPakistan===true||(num(a.latitude)!==null&&distanceKm(lat,lon,a.latitude,a.longitude)<=600)));
 if(al.length){lvl=2;reasons.push(`${al.length} orange/red disaster alert(s)`);}
 return {level:['clear','watch','disruption_likely'][lvl],label:['Roads: clear','Roads: watch','Disruption likely'][lvl],detail:reasons.length?reasons.join('; '):'No heavy rain, strong wind, dust storm or major alert in the next 7 days'};
}
export function powerDemandCard(weather){
 const daily=(Array.isArray(obj(weather).daily)?obj(weather).daily:[]).map(obj);
 const spikes=daily.filter(d=>(num(d.feelsLikeMaxC)??num(d.maxC)??0)>=40);const peak=daily.reduce((m,d)=>Math.max(m,num(d.feelsLikeMaxC)??num(d.maxC)??-99),-99);
 return {spikeDays:spikes.map(d=>dayName(d.date)),peakFeelsLikeC:peak>-99?round(peak):null,
  label:spikes.length?`Demand spike: ${spikes.map(d=>dayName(d.date)).join(', ')}`:'No heat-driven demand spike',detail:peak>-99?`Peak feels-like ${round(peak)} °C this week`:'Forecast unavailable'};
}
export function spaceWeatherCard(kpRow){
 const kp=num(obj(kpRow).kp);if(kp===null)return {kp:null,level:'unknown',label:'Space weather unavailable',detail:''};
 const lvl=kp>=7?'severe':kp>=5?'storm':kp>=4?'active':'quiet';
 return {kp,level:lvl,label:`Kp ${round(kp,1)}: ${lvl}`,detail:lvl==='quiet'?'No GPS or HF-radio disruption expected':lvl==='active'?'Minor GPS accuracy loss possible':'GPS, HF radio and drone navigation may be disrupted'};
}
export function healthCard(watch){
 const w=obj(watch);return {smogDaysPast7:w.smogDaysPast7??0,next24hMaxAqi:w.next24hMaxAqi??null,
  label:`Smog days: ${w.smogDaysPast7??0} in the last 7`,detail:w.next24hMaxAqi!=null?`Next 24 h peak AQI ${Math.round(w.next24hMaxAqi)}`:'Air forecast unavailable'};
}

// ---------- Weekly rankings ----------
/** Ranks cities on the last 7 days. Each input row: {city, avgAqi, maxFeelsLikeC, rainMm, goOut}. */
export const RANKING_DEFS=Object.freeze([
 {id:'cleanest_air',title:'Cleanest air',field:'avgAqi',dir:'asc',unit:'avg US AQI'},
 {id:'worst_smog',title:'Worst smog',field:'avgAqi',dir:'desc',unit:'avg US AQI'},
 {id:'hottest',title:'Hottest week',field:'maxFeelsLikeC',dir:'desc',unit:'°C peak feels-like'},
 {id:'most_rain',title:'Most rain',field:'rainMm',dir:'desc',unit:'mm observed'},
 {id:'best_go_out',title:'Best Go-Out Score',field:'goOut',dir:'desc',unit:'/ 100 today'}]);
export function weeklyRankings(cities){
 const rows=(Array.isArray(cities)?cities:[]).map(obj).filter(c=>typeof c.city==='string');
 return RANKING_DEFS.map(def=>{
  const list=rows.filter(c=>num(c[def.field])!==null).sort((a,b)=>def.dir==='asc'?a[def.field]-b[def.field]:b[def.field]-a[def.field]).map((c,i)=>({rank:i+1,city:c.city,value:round(c[def.field],1)}));
  // A ranking needs at least 3 cities with data, and "most rain" needs some rain.
  const usable=list.length>=3&&!(def.id==='most_rain'&&(list[0]?.value??0)<=0);
  return {id:def.id,title:def.title,unit:def.unit,winner:usable?list[0]:null,list:usable?list:[]};
 });
}

// ---------- Assembly ----------
/** Builds every card for every city from one snapshot of stored observations. */
export function assembleInsights(data,now=Date.now()){
 const d=obj(data),shared={rivers:d.rivers??[],alerts:d.alerts??[],quakes:d.quakes??[],fires:d.fires??[]};
 const cities={},forRanking=[];
 for(const [id,raw] of Object.entries(obj(d.cities))){
  const c=obj(raw),lat=num(c.lat),lon=num(c.lon);if(lat===null||lon===null)continue;
  const goOut=goOutScore(c.air,c.weather),watch=smogHeatWatch(c.air,c.airHistory,c.weather);
  const river=nearestRiver(lat,lon,shared.rivers);
  cities[id]={city:id,goOut,watch,
   safety:safetyToday(lat,lon,shared,now),
   farm:{irrigation:irrigationAdvice(c.rainPast,c.weather),spray:sprayWindows(c.weather),heat:heatStress(c.weather),river:river?{status:riverStatus(river.peakToTodayRatio),label:riverLine(river)}:{status:'unknown',label:riverLine(null)}},
   industry:{solar:solarCard(c.solar,c.air,c.weather),risk:riskCard(lat,lon,{weather:c.weather,...shared}),logistics:logisticsCard(lat,lon,{air:c.air,weather:c.weather,alerts:shared.alerts}),
    power:powerDemandCard(c.weather),space:spaceWeatherCard(d.kp),health:healthCard(watch)}};
  const rain=(Array.isArray(c.rainPast)?c.rainPast:[]).slice(0,7).map(r=>num(obj(r).value)).filter(v=>v!==null);
  forRanking.push({city:id,avgAqi:averageAqi(c.airHistory),maxFeelsLikeC:num(c.maxFeelsLike7),rainMm:rain.length?round(sum(rain),1):null,goOut:goOut?.score??null});
 }
 return {generatedAt:new Date(now).toISOString(),cities,rankings:weeklyRankings(forRanking),
  disclaimer:'Decision aids from modelled and open satellite data (Copernicus, NASA, NOAA, USGS, GDACS, GloFAS). Not official PMD, NDMA or FFD warnings.'};
}
