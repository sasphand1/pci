'use client';
import {useEffect,useRef,useState} from 'react';
import {CloudRain, Waves, Sun, TriangleAlert, Sprout, Building2, Satellite, Flame, Activity, ChevronRight, ChartNoAxesCombined, Factory, ShieldCheck, Leaf, Radio, Truck, Zap, HeartPulse, Landmark} from 'lucide-react';

import {compareDailySeries, summarizeThermalDetections} from '@/lib/satelliteScience.mjs';
import styles from './SatelliteExperience.module.css';
type Datum=Record<string,unknown>;
type Day={date?:string;maxC?:number|null;minC?:number|null;feelsLikeMaxC?:number|null;rainMm?:number|null;rainChancePct?:number|null;uvIndexMax?:number|null};
const API='/api/satellite';
const cityNames=['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad'];
const scienceCategories=[
 {id:'farm',title:'Farm Doctor',short:'Farms',description:'Recent rainfall, the 7-day forecast and river outlook before you irrigate, sow or harvest.',audience:'Farmers and agricultural advisers',needs:['Crop vegetation health (NDVI)','Field soil moisture']},
 {id:'safety',title:'Safety Watch',short:'Alerts',description:'International disaster alerts, earthquakes, natural events and space weather for Pakistan in one place.',audience:'Residents, businesses and NGOs',needs:['Official NDMA / PMD warnings feed']},
 {id:'water',title:'Water Guardian',short:'Water',description:'Observed rainfall and modelled river flow for the Indus system, with a 30-day outlook.',audience:'Residents, water planners and insurers',needs:['Flood extent mapping']},
 {id:'solar',title:'Solar Advisor',short:'Solar',description:'Solar irradiation estimates, UV and the week ahead before commissioning site-specific yield analysis.',audience:'Homeowners and installers',needs:['Rooftop yield model','Panel tilt and shading']},
 {id:'city',title:'City Health',short:'Cities',description:'Air quality now and next 24 hours, heat in the week ahead, and thermal hotspots.',audience:'City residents, schools and employers',needs:['Neighbourhood heat map','Night-light change analysis']}
] as const;
type ScienceCategory=(typeof scienceCategories)[number]['id'];
function rows(d:unknown[]):Datum[]{return d.filter((x):x is Datum=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)));}
function num(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v:null;}
function shown(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-PK',{maximumFractionDigits:2}):'Not available';}
function date(v:unknown){if(typeof v!=='string')return 'Not available';const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})+' PKT':'Not available';}
function rec(v:unknown):Datum{return v&&typeof v==='object'&&!Array.isArray(v)?v as Datum:{};}
async function get(metric:string,city?:string){const r=await fetch(`${API}?metric=${metric}${city?`&city=${encodeURIComponent(city)}`:''}`,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('Source unavailable');return rows((await r.json()).data??[]);}

const referenceChips=[
 {id:'weather',label:'Weather & Rain',category:'farm',Icon:CloudRain},
 {id:'water',label:'Rivers & Water',category:'water',Icon:Waves},
 {id:'solar',label:'Solar & Energy',category:'solar',Icon:Sun},
 {id:'safety',label:'Hazards & Disasters',category:'safety',Icon:TriangleAlert},
 {id:'farm',label:'Farms & Crops',category:'farm',Icon:Sprout},
 {id:'city',label:'Cities & Air',category:'city',Icon:Building2}
] as const;
function MiniPlot({data,field='value',kind='line',unit=''}:{data:Datum[];field?:string;kind?:'line'|'bars';unit?:string}){
 const unique=new Map<number,number>();
 for(const row of data){const raw=row.observedAt??row.date;const t=typeof raw==='string'?Date.parse(raw):NaN;const value=num(row[field]);if(Number.isFinite(t)&&t<=Date.now()&&value!==null&&value>=0)unique.set(t,value);}
 const p=[...unique].sort((a,b)=>a[0]-b[0]).slice(-30);
 if(p.length<2)return <div className="pci-sat-mini-empty">Waiting for recorded history</div>;
 const max=Math.max(...p.map(x=>x[1]),0.01),first=p[0][0],last=p[p.length-1][0];
 const x=(t:number)=>8+(t-first)/(last-first)*144,y=(v:number)=>59-v/max*52;
 const coords=p.map(([t,v])=>x(t)+','+y(v)).join(' ');
 return <svg className={`pci-sat-mini-plot ${kind==='bars'?'pci-sat-solar-plot':''}`} viewBox="0 0 160 65" role="img" aria-label={`${p.length} recorded values, latest ${shown(p[p.length-1][1])} ${unit}`}>
 <path d="M8 59H152 M8 32H152 M8 7H152" className="pci-sat-mini-grid"/>
 {kind==='line'?<><polygon points={`8,59 ${coords} 152,59`} className="pci-sat-mini-area"/><polyline points={coords} className="pci-sat-mini-line"/>{p.map(([t,v])=><circle key={t} cx={x(t)} cy={y(v)} r="2" className="pci-sat-mini-dot"><title>{date(new Date(t).toISOString())}: {shown(v)} {unit}</title></circle>)}</>:p.map(([t,v],i)=>{const bw=Math.min(11,132/p.length);return <rect key={t} x={8+i*144/p.length} y={y(v)} width={bw} height={59-y(v)} rx="1" className="pci-sat-mini-bar"><title>{date(new Date(t).toISOString())}: {shown(v)} {unit}</title></rect>;})}
 </svg>;
}
function ScoreGauge({score}:{score:number|null}){const v=score===null?null:Math.min(100,Math.max(0,score));return <div className="pci-sat-gauge" data-score-band={v===null?"unknown":v>=75?"good":v>=55?"fair":v>=35?"limit":"avoid"}><svg viewBox="0 0 120 76" aria-hidden="true"><path d="M12 65 A48 48 0 0 1 108 65" pathLength="100" className="pci-sat-gauge-base"/>{v!==null&&<path d="M12 65 A48 48 0 0 1 108 65" pathLength="100" strokeDasharray={`${v} 100`} className="pci-sat-gauge-value"/>}</svg><div><strong>{v===null?'—':v}</strong><small>/100</small></div></div>;}
function CitySnapshot({data,city,onCity}:{data:Datum[];city:string;onCity:(c:string)=>void}){const by=new Map(data.filter(r=>typeof r.city==='string').map(r=>[String(r.city),num(r.value)]));return <div className="pci-sat-city-bars">{cityNames.map(c=>{const n=by.get(c)??null;const v=n!==null&&n>=0&&n<=100?n:null;return <button key={c} type="button" onClick={()=>onCity(c)} aria-pressed={city===c} title={`${c}: ${v===null?'Not available':v+'/100'}`}><b>{v===null?'—':v}</b><svg viewBox="0 0 22 44" aria-hidden="true"><rect x="2" y="2" width="18" height="40" rx="2" className="pci-sat-city-base"/>{v!==null&&<rect x="2" y={42-v*.4} width="18" height={v*.4} rx="2" className="pci-sat-city-value"/>}</svg><small>{c[0].toUpperCase()+c.slice(1)}</small></button>;})}</div>;}

export function SatelliteDashboard({sources,fires,rain,solar}:{sources:unknown[];fires:unknown[];rain:unknown[];solar:unknown[]}){
 const [city,setCity]=useState('lahore'),[rainData,setRainData]=useState(rows(rain)),[solarData,setSolarData]=useState(rows(solar));
 const [error,setError]=useState('');
 const [category,setCategory]=useState<ScienceCategory>('farm');
 const [detailOpen,setDetailOpen]=useState(false);
 const detailRef=useRef<HTMLDetailsElement>(null);
 const [navChoice,setNavChoice]=useState<string>('weather'),[access,setAccess]=useState<'workspaces'|'quick'>('workspaces');
 const [rainHistory,setRainHistory]=useState<Datum[]>([]),[solarHistory,setSolarHistory]=useState<Datum[]>([]);
 const [historyStatus,setHistoryStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
 const mapFrame=useRef<HTMLIFrameElement>(null);
 const [earthquakes,setEarthquakes]=useState<Datum[]>([]),[alerts,setAlerts]=useState<Datum[]>([]),[rivers,setRivers]=useState<Datum[]>([]),[space,setSpace]=useState<Datum[]>([]);
 const [naturalEvents,setNaturalEvents]=useState<Datum[]>([]),[imagery,setImagery]=useState<Datum[]>([]),[gpmImagery,setGpmImagery]=useState<Datum[]>([]),[layers,setLayers]=useState<Datum[]>([]);
 const [air,setAir]=useState<Datum[]>([]),[weather,setWeather]=useState<Datum[]>([]);
 const [insight,setInsight]=useState<Datum>({}),[rankings,setRankings]=useState<Datum[]>([]),[orbits,setOrbits]=useState<Datum[]>([]);
 useEffect(()=>{let active=true;const filters=['natural-events','imagery','gpm-imagery','earthquakes','alerts','rivers','space-weather','imagery-layers','rankings','orbits'];
 Promise.allSettled(filters.map(f=>get(f))).then(results=>{if(!active)return;
 const value=(i:number)=>{const result=results[i];return result?.status==='fulfilled'?result.value:[];};
 setNaturalEvents(value(0));setImagery(value(1));setGpmImagery(value(2));setEarthquakes(value(3));setAlerts(value(4));setRivers(value(5));setSpace(value(6));setLayers(value(7));setRankings(value(8));setOrbits(value(9));});
 return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setError('');
  Promise.allSettled([get('air-quality',city),get('weather',city),get('insights',city)]).then(([a,w,i])=>{if(!active)return;setAir(a.status==='fulfilled'?a.value:[]);setWeather(w.status==='fulfilled'?w.value:[]);setInsight(i.status==='fulfilled'?rec(i.value[0]):{});});
  if(city==='lahore'){setRainData(rows(rain));setSolarData(rows(solar));return()=>{active=false;};}
  Promise.allSettled([get('rainfall',city),get('solar',city)]).then(([r,s])=>{if(active){setRainData(r.status==='fulfilled'?r.value:[]);setSolarData(s.status==='fulfilled'?s.value:[]);if(r.status==='rejected'||s.status==='rejected')setError('Some city observations are unavailable.');}});
  return()=>{active=false;};},[city,rain,solar]);
 useEffect(()=>{let active=true;setHistoryStatus('loading');setRainHistory([]);setSolarHistory([]);
  Promise.allSettled([get('rainfall-history',city),get('solar-history',city)])
   .then(([r,s])=>{if(active){setRainHistory(r.status==='fulfilled'?r.value:[]);setSolarHistory(s.status==='fulfilled'?s.value:[]);setHistoryStatus(r.status==='rejected'&&s.status==='rejected'?'unavailable':'ready');}});
  return()=>{active=false;};},[city]);
 const providers=rows(sources),fireRows=rows(fires);const power=providers.find(p=>p.id==='power');const latestRain=rainData[0],latestSolar=solarData[0];
 const rainfallInsight=compareDailySeries(rainHistory,'rainfall');
 const solarInsight=compareDailySeries(solarHistory,'solar');
 const fireInsight=summarizeThermalDetections(fireRows);
 const current=scienceCategories.find(c=>c.id===category)!;
 const postMap=()=>{const points=fireRows.filter(p=>typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.latitude>=23&&p.latitude<=38&&p.longitude>=60&&p.longitude<=78).slice(0,200).map(p=>({latitude:p.latitude,longitude:p.longitude,observedAt:typeof p.observedAt==='string'?p.observedAt:null}));
 const events=naturalEvents.filter(e=>typeof e.latitude==='number'&&typeof e.longitude==='number').slice(0,100).map(e=>({latitude:e.latitude,longitude:e.longitude,title:typeof e.title==='string'?e.title:'Natural event',observedAt:e.observedAt}));
 const extraLayers=layers.filter(l=>typeof l.id==='string'&&typeof l.tileTemplate==='string').map(l=>({id:l.id,label:typeof l.label==='string'?l.label:String(l.id),tileTemplate:l.tileTemplate,maxZoom:typeof l.maxZoom==='number'?l.maxZoom:6}));
 const quakes=earthquakes.filter(q=>typeof q.latitude==='number'&&typeof q.longitude==='number'&&typeof q.magnitude==='number').slice(0,200).map(q=>({latitude:q.latitude,longitude:q.longitude,magnitude:q.magnitude,observedAt:q.observedAt,place:q.place}));
 const alertPoints=alerts.filter(a=>typeof a.latitude==='number'&&typeof a.longitude==='number').slice(0,60).map(a=>({latitude:a.latitude,longitude:a.longitude,level:a.alertLevel,name:a.name,observedAt:a.observedAt}));
 const riverPoints=rivers.filter(r=>typeof r.latitude==='number'&&typeof r.longitude==='number'&&typeof r.dischargeM3s==='number').slice(0,60).map(r=>({latitude:r.latitude,longitude:r.longitude,name:String(r.river)+' at '+String(r.place),discharge:r.dischargeM3s,observedAt:r.observedAt}));
 const orbitElements=orbits.slice(0,80).map(o=>({name:o.name,isIss:o.isIss===true,epoch:o.epoch,meanMotion:o.meanMotion,eccentricity:o.eccentricity,inclination:o.inclination,raOfAscNode:o.raOfAscNode,argOfPericenter:o.argOfPericenter,meanAnomaly:o.meanAnomaly}));
 mapFrame.current?.contentWindow?.postMessage({type:'PCI_SATELLITE_POINTS_V1',points,events,quakes,alerts:alertPoints,rivers:riverPoints,orbits:orbitElements,imagery:imagery[0]?.tileTemplate,gpmImagery:gpmImagery[0]?.tileTemplate,extraLayers,category},window.location.origin);};
 useEffect(()=>{postMap();},[naturalEvents,imagery,gpmImagery,layers,category,fires,earthquakes,alerts,orbits,rivers]);

 // Derived, plain-language readings. Nothing is shown that the sources did not provide.
 const aq=rec(air[0]),aqValues=rec(aq.values),next24=rec(aq.next24h);
 const w=rec(weather[0]),wNow=rec(w.current),days=(Array.isArray(w.daily)?w.daily:[]) as Day[];
 const rainValues=days.map(d=>num(d.rainMm));const rain7=rainValues.length===7&&rainValues.every(v=>v!==null)?rainValues.reduce<number>((s,v)=>s+(v??0),0):null,hottest=days.reduce<number|null>((m,d)=>{const v=num(d.feelsLikeMaxC)??num(d.maxC);return v===null?m:m===null?v:Math.max(m,v);},null);
 const riverRows=rivers.map(rec).filter(r=>num(r.dischargeM3s)!==null);
 const rising=[...riverRows].sort((a,b)=>(num(b.peakToTodayRatio)??0)-(num(a.peakToTodayRatio)??0));
 const topRiver=rising[0];
 const kp=rec(space[0]);
 const activeAlerts=alerts.map(rec);const severe=activeAlerts.filter(a=>a.alertLevel==='Orange'||a.alertLevel==='Red');
 const latestQuake=rec(earthquakes[0]);
 const riverText=(r:Datum)=>`${r.river} at ${r.place}: ${shown(r.dischargeM3s)} m³/s today${num(r.peakToTodayRatio)!==null?`, 30-day peak ${shown(rec(r.peak30).max)} m³/s on ${String(rec(r.peak30).date)} (×${shown(r.peakToTodayRatio)})`:''}`;
 const forecastText=days.length?`Next 7 days: ${shown(rain7===null?null:Math.round(rain7*10)/10)} mm rain in total, highest feels-like ${shown(hottest)} °C, ${shown(w.heatDays)} day(s) at 40 °C or above.`:'Forecast unavailable.';
 const aqText=aq.observedAt?`US AQI ${shown(aqValues.us_aqi)} (${String(aq.band??'not classified')}), PM2.5 ${shown(aqValues.pm2_5)} µg/m³, dust ${shown(aqValues.dust)} µg/m³. Next 24 h peak AQI ${shown(next24.maxUsAqi)}. Modelled (CAMS), not a station reading.`:'Air-quality data unavailable.';

 const goOut=rec(insight.goOut),watch=rec(insight.watch),safety=rec(insight.safety),farm=rec(insight.farm),industry=rec(insight.industry);
 const txt=(v:unknown,fallback='Not available')=>typeof v==='string'&&v?v:fallback;
 const advice=Array.isArray(goOut.advice)?goOut.advice.filter((a):a is string=>typeof a==='string'):[];
 const safetyItems=Array.isArray(safety.items)?safety.items.filter((a):a is string=>typeof a==='string'):[];
 const cityLabel=city[0].toUpperCase()+city.slice(1);
 const industryCards:Array<[string,string,Datum]>=[['Solar','Installers and owners',rec(industry.solar)],['Insurers and banks','Property and crop risk',rec(industry.risk)],['Logistics','Roads around '+cityLabel,rec(industry.logistics)],['Power (DISCOs)','Heat-driven demand',rec(industry.power)],['Telecom, GPS, drones','Space weather',rec(industry.space)],['Health and NGOs','Smog exposure',rec(industry.health)]];
 const rankingRows=rankings.map(rec).filter(r=>typeof r.title==='string');
 const solarReady=solarInsight.status==='ready',rainfallReady=rainfallInsight.status==='ready';
 const primary:{label:string;value:string;unit:string;note:string;at:unknown}=
  category==='solar'?{label:'Solar irradiation',value:shown(latestSolar?.value),unit:'kWh/m²/day',note:'NASA POWER daily modeled / satellite-derived estimate.',at:latestSolar?.observedAt}:
  category==='city'?{label:'Air quality now',value:shown(aqValues.us_aqi),unit:`US AQI · ${String(aq.band??'not classified')}`,note:'Copernicus CAMS modelled air quality for the city area.',at:aq.observedAt}:
  category==='safety'?{label:'Active disaster alerts',value:String(activeAlerts.length),unit:`${severe.length} orange or red`,note:'GDACS alerts for Pakistan and the Arabian Sea approach, last 30 days.',at:activeAlerts[0]?.observedAt}:
  category==='water'?{label:'River flow outlook',value:topRiver?shown(topRiver.peakToTodayRatio):'Not available',unit:topRiver?`× today · ${String(topRiver.river)} at ${String(topRiver.place)}`:'peak vs today',note:'GloFAS modelled discharge, nearest model river cell. Not an official FFD forecast.',at:topRiver?.observedAt}:
  {label:'Rain next 7 days',value:days.length?shown(rain7===null?null:Math.round(rain7*10)/10):'Not available',unit:'mm (forecast)',note:'Open-Meteo forecast. Observed history below is NASA POWER corrected precipitation — NOT GPM or a rain gauge.',at:w.observedAt};
 const second=category==='solar'?{label:'UV index today',value:shown(days[0]?.uvIndexMax),unit:'max',note:'Open-Meteo forecast.',at:w.observedAt}:
  category==='city'?{label:'Feels like today',value:shown(days[0]?.feelsLikeMaxC),unit:'°C max',note:`Now ${shown(wNow.temperatureC)} °C, feels like ${shown(wNow.feelsLikeC)} °C.`,at:w.observedAt}:
  category==='safety'?{label:'Latest earthquake',value:shown(latestQuake.magnitude),unit:'magnitude',note:typeof latestQuake.place==='string'?latestQuake.place:'USGS reports, not early warning.',at:latestQuake.observedAt}:
  {label:'Observed rainfall',value:shown(latestRain?.value),unit:'mm/day',note:'NASA POWER corrected daily precipitation — NOT GPM or a rain gauge.',at:latestRain?.observedAt};
 const third=category==='safety'?{label:'Space weather',value:shown(kp.kp),unit:`Kp · ${String(kp.scale??'')}`,note:'NOAA SWPC estimated planetary K-index (affects GPS and radio).',at:kp.observedAt}:
  category==='city'?{label:'Hot days ahead',value:shown(w.heatDays),unit:'days ≥ 40 °C feels-like',note:'Open-Meteo 7-day forecast.',at:w.observedAt}:
  {label:'Air quality now',value:shown(aqValues.us_aqi),unit:`US AQI · ${String(aq.band??'not classified')}`,note:'Copernicus CAMS, modelled.',at:aq.observedAt};

 const score=num(goOut.score),scoreInputs=rec(goOut.inputs),scorePartial=goOut.partial===true||['usAqi','feelsLikeMaxC','uvIndexMax','rainChancePct'].some(k=>num(scoreInputs[k])===null);
 const cityRank=rankingRows.find(r=>r.id==='best_go_out'),cityScores=Array.isArray(cityRank?.list)?cityRank.list.map(rec):[];
 const chooseCity=(next:string)=>{if(!cityNames.includes(next)||next===city)return;setAir([]);setWeather([]);setInsight({});setRainData([]);setSolarData([]);setRainHistory([]);setSolarHistory([]);setCity(next);};
 const goTo=(id:string)=>{
  if(id!=='pci-sat-earth'){setDetailOpen(true);if(detailRef.current)detailRef.current.open=true;}
  requestAnimationFrame(()=>document.getElementById(id)?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}));
 };
 const openWorkspace=(next:ScienceCategory)=>{setCategory(next);setNavChoice(next==='farm'?'farm':next);goTo('pci-sat-workspace');};
 const riverPast=Array.isArray(topRiver?.past7)?topRiver.past7.map(rec):[];
 const forecastRain=num(days[0]?.rainChancePct);
 const riverName=topRiver?String(topRiver.river)+' ('+String(topRiver.place)+')':'River observations unavailable';
 const riverRatio=num(topRiver?.peakToTodayRatio);
 const fireCount=fireInsight.count;
 const quickLinks=[{label:'Satellite Explorer',Icon:Satellite,action:()=>goTo('pci-sat-earth')},{label:'City Health',Icon:Building2,action:()=>openWorkspace('city')},{label:'Safety Watch',Icon:ShieldCheck,action:()=>openWorkspace('safety')},{label:'Environmental Watch',Icon:Leaf,action:()=>openWorkspace('water')},{label:'Farm Doctor',Icon:Sprout,action:()=>openWorkspace('farm')}];

 const card=(c:typeof second,primaryCard=false)=><article className={`${styles.metricCard} ${primaryCard?styles.metricPrimary:''}`}><small>{c.label}</small><strong>{c.value}</strong><span>{c.unit}</span><p>{c.note}</p><small>Observed: {date(c.at)}</small></article>;
 return <div className={`${styles.root} pci-sat-redesign`} data-satellite-revision="reference-v3" data-satellite-theme="fifi-home">
  {providers.length===0&&<p role="status" className={styles.alert}>Satellite provider information is currently unavailable. Historical observations may be incomplete.</p>}
  {power?.enabled===false&&<p role="status" className={styles.alert}>NASA POWER ingestion is disabled. Enable it in PCI Management → Satellite APIs.</p>}

  <header className="pci-sat-banner rounded-2xl border border-primary/10 bg-secondary/60 p-5 shadow-soft" aria-labelledby="satellite-hero-title">
   <div className="pci-sat-banner-copy"><p className="pci-sat-kicker eyebrow">PAKISTAN FROM SPACE</p><h1 id="satellite-hero-title" className="font-display text-3xl font-medium tracking-tight text-primary sm:text-4xl">Satellite Intelligence</h1><p>Real satellite and modeled data for people, farms, cities and businesses across Pakistan.</p></div>
   <div className="pci-sat-banner-art" aria-hidden="true"/>
   <nav className="pci-sat-chips" aria-label="Satellite categories">{referenceChips.map(({id,label,category:target,Icon})=><button className={`filter-pill ${navChoice===id?'filter-pill-active':''}`} type="button" key={id} aria-pressed={navChoice===id} onClick={()=>{setNavChoice(id);setCategory(target);}}><Icon size={17} aria-hidden="true"/><span>{label}</span></button>)}</nav>
  </header>

  <section id="pci-sat-earth" className={`${styles.globeHero} pci-sat-stage`} aria-labelledby="globe-title">

   <aside className="pci-sat-live rounded-2xl border border-border/70 bg-card p-4 shadow-soft" aria-labelledby="pci-sat-live-title"><div className="pci-sat-live-head"><Satellite size={23}/><div><h2 id="pci-sat-live-title">Live from Space</h2><p>Satellite, weather and environmental intelligence for Pakistan.</p></div></div>
   <button className="pci-sat-event rain rounded-xl border border-border/70 bg-background/60" type="button" onClick={()=>{setNavChoice('weather');setCategory('farm');goTo('pci-sat-workspace');}}><CloudRain/><span><b>Rain forecast · {cityLabel}</b><small>{forecastRain===null?'Forecast unavailable':shown(forecastRain)+'% chance today'}</small></span><ChevronRight/></button>
   <button className="pci-sat-event fire rounded-xl border border-border/70 bg-background/60" type="button" onClick={()=>openWorkspace('safety')}><Flame/><span><b>Thermal detections</b><small>{fireCount?shown(fireCount)+' recent regional records':'No qualifying records available'}</small></span><ChevronRight/></button>
   <button className="pci-sat-event quake rounded-xl border border-border/70 bg-background/60" type="button" onClick={()=>openWorkspace('safety')}><Activity/><span><b>Latest earthquake</b><small>{num(latestQuake.magnitude)===null?'Report unavailable':'M '+shown(latestQuake.magnitude)+' · '+txt(latestQuake.place,'Regional report')}</small></span><ChevronRight/></button>
   <button className="pci-sat-event river rounded-xl border border-border/70 bg-background/60" type="button" onClick={()=>openWorkspace('water')}><Waves/><span><b>River flow outlook</b><small>{riverRatio===null?riverName:riverName+' · '+shown(riverRatio)+'× peak vs today'}</small></span><ChevronRight/></button>
   <p className="pci-sat-live-status">{providers.length?providers.filter(p=>p.available===true).length+' / '+providers.length+' sources recently refreshed':'Source status unavailable'}</p></aside>

   <div className={`${styles.globeFrame} pci-sat-earth-frame rounded-2xl border border-border/70 shadow-soft`}><iframe ref={mapFrame} className={styles.globeMap} title="Rotating Earth with live satellites and Pakistan observation map" src="/satellite-map.html?v=reference-v3" allowFullScreen loading="eager" onLoad={postMap}/></div>

   <div className="pci-sat-city-stack"><aside className="pci-sat-city-panel rounded-2xl border border-border/70 bg-card p-4 shadow-soft" aria-live="polite">
    <div className="pci-sat-card-head"><h2 id="globe-title" aria-label="City Health · GO-OUT SCORE"><Building2 size={19}/> City Health &amp; Go-Out Score</h2><select className="field" aria-label="City" value={city} onChange={e=>chooseCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></div>
    <div className="pci-sat-city-details"><div><ScoreGauge score={score}/><p className={styles.goOutLabel} data-level={txt(goOut.level,'none')}>{score===null?'Awaiting observations':scorePartial?'Partial score':txt(goOut.label)}</p></div>
    <div className="pci-sat-city-metrics"><div><Sun/><b>{num(wNow.temperatureC)===null?'—':shown(wNow.temperatureC)+'°C'}</b><small>Temperature</small></div><div><CloudRain/><b>{num(scoreInputs.rainChancePct)===null?'—':shown(scoreInputs.rainChancePct)+'%'}</b><small>Rain chance</small></div><div><Leaf/><b>{num(scoreInputs.usAqi)===null?'—':shown(scoreInputs.usAqi)}</b><small>US AQI</small></div><div><Sun/><b>{num(scoreInputs.uvIndexMax)===null?'—':shown(scoreInputs.uvIndexMax)}</b><small>UV max</small></div></div></div>
    <p className="pci-sat-quiet">{scorePartial?'Some inputs are missing; do not interpret the score as a safety guarantee.':advice[0]??'Regional modeled indicator.'} Not an official PMD warning.</p>
    <small className="pci-sat-quiet">Observed: {date(goOut.observedAt)} · CAMS / Open-Meteo</small>
   </aside><section className="pci-sat-city-panel pci-sat-snapshot rounded-2xl border border-border/70 bg-card p-4 shadow-soft"><div className="pci-sat-card-head"><h3>8-City Snapshot <small>(Go-Out Score)</small></h3><button type="button" onClick={()=>goTo('pci-sat-rankings')}>View rankings <ChevronRight size={14}/></button></div><CitySnapshot data={cityScores} city={city} onCity={chooseCity}/><p className="pci-sat-quiet">Latest published score comparison. Missing cities are not scored.</p></section></div>
  </section>

  <nav className="pci-sat-quick" aria-label="Workspace shortcuts"><div className="pci-sat-mode"><button type="button" aria-pressed={access==='workspaces'} onClick={()=>setAccess('workspaces')}>Workspaces</button><button type="button" aria-pressed={access==='quick'} onClick={()=>setAccess('quick')}>Quick Access</button></div><div className="pci-sat-quick-links">{(access==='workspaces'?quickLinks:[{label:'Observation history',Icon:ChartNoAxesCombined,action:()=>goTo('pci-sat-history')},{label:'City rankings',Icon:Building2,action:()=>goTo('pci-sat-rankings')},{label:'Industry Intelligence',Icon:Factory,action:()=>goTo('pci-sat-industry')},{label:'Data sources',Icon:Radio,action:()=>goTo('pci-sat-sources')}]).map(({label,Icon,action})=><button key={label} type="button" onClick={action}><Icon size={19}/>{label}</button>)}</div></nav>
  <section className="pci-sat-preview-grid" aria-label="Satellite workspaces">
   <article className="pci-sat-preview rounded-2xl border border-border/70 bg-card p-3 shadow-soft"><div className="pci-sat-card-art water"/><button className="pci-sat-preview-head" type="button" onClick={()=>openWorkspace('water')}><Waves/><span><b>Water Guardian</b><small>Rivers, flow outlook and rainfall</small></span><ChevronRight/></button><div className="pci-sat-preview-body"><div><small>{riverName}</small><strong>{shown(topRiver?.dischargeM3s)}</strong><small>m³/s · modelled</small></div><MiniPlot data={riverPast} field="dischargeM3s" unit="m³/s"/></div><div className="pci-sat-preview-foot">Peak vs today: {riverRatio===null?'Not available':shown(riverRatio)+'×'}<br/>Observed {date(topRiver?.observedAt)}</div></article>
   <article className="pci-sat-preview rounded-2xl border border-border/70 bg-card p-3 shadow-soft"><div className="pci-sat-card-art solar"/><button className="pci-sat-preview-head" type="button" onClick={()=>openWorkspace('solar')}><Sun/><span><b>Solar Advisor</b><small>Sunlight and energy planning</small></span><ChevronRight/></button><div className="pci-sat-preview-body"><div><small>Solar irradiation</small><strong>{shown(latestSolar?.value)}</strong><small>kWh/m²/day</small></div><MiniPlot data={solarHistory} kind="bars" unit="kWh/m²/day"/></div><div className="pci-sat-preview-foot">{txt(rec(industry.solar).label)}<br/>NASA POWER · {date(latestSolar?.observedAt)}</div></article>
   <article className="pci-sat-preview rounded-2xl border border-border/70 bg-card p-3 shadow-soft"><div className="pci-sat-card-art history"/><button className="pci-sat-preview-head" type="button" onClick={()=>goTo('pci-sat-history')}><ChartNoAxesCombined/><span><b>Historical Analytics</b><small>Past observations and trends</small></span><ChevronRight/></button><div className="pci-sat-history-mini"><small>Rainfall · available 30-day window</small><MiniPlot data={rainHistory} unit="mm/day"/></div><div className="pci-sat-preview-foot">{rainfallReady?rainfallInsight.summary:'Waiting for sufficient verified history'}</div></article>
   <article className="pci-sat-preview rounded-2xl border border-border/70 bg-card p-3 shadow-soft"><div className="pci-sat-card-art city"/><button className="pci-sat-preview-head" type="button" onClick={()=>goTo('pci-sat-rankings')}><Building2/><span><b>City Rankings</b><small>Compare modeled city indicators</small></span><ChevronRight/></button><div className="pci-sat-ranking-mini">{cityScores.length?cityScores.slice(0,4).map(r=><div key={String(r.city)}><span>#{shown(r.rank)} {String(r.city)}</span><svg viewBox="0 0 100 8" aria-hidden="true"><rect width="100" height="8" rx="2" className="pci-sat-rank-bg"/><rect width={Math.max(0,Math.min(100,num(r.value)??0))} height="8" rx="2" className="pci-sat-rank-fill"/></svg><b>{shown(r.value)}</b></div>):<p className="pci-sat-quiet">Not enough cities with data.</p>}</div><div className="pci-sat-preview-foot">All 8 cities · Go-Out Score</div></article>
   <article className="pci-sat-preview rounded-2xl border border-border/70 bg-card p-3 shadow-soft"><div className="pci-sat-card-art industry"/><button className="pci-sat-preview-head" type="button" onClick={()=>goTo('pci-sat-industry')}><Factory/><span><b>Industry Intelligence</b><small>Planning for key sectors</small></span><ChevronRight/></button><div className="pci-sat-industry-mini">{[{label:'Solar',Icon:Sun},{label:'Insurance',Icon:ShieldCheck},{label:'Banking',Icon:Landmark},{label:'Logistics',Icon:Truck},{label:'Power',Icon:Zap},{label:'Telecom',Icon:Radio},{label:'GPS / Drones',Icon:Satellite},{label:'Healthcare',Icon:HeartPulse}].map(({label,Icon})=><button key={label} type="button" onClick={()=>goTo('pci-sat-industry')}><Icon size={19}/><small>{label}</small></button>)}</div><div className="pci-sat-preview-foot">Planning indicators, not guarantees</div></article>
  </section>

  <details ref={detailRef} className="pci-sat-expanded content-card" open={detailOpen} onToggle={e=>setDetailOpen(e.currentTarget.open)}>
   <summary>Detailed workspace, evidence and source transparency <span>Open analysis</span></summary>
   <div className="pci-sat-expanded-content">
  <section className={styles.forYou} aria-label="For you today">
   <article><p className={styles.eyebrow}>IS MY AREA SAFE TODAY</p><h3 data-level={txt(safety.level,'none')}>{txt(safety.label,'Not available')}</h3><ul>{safetyItems.map(i=><li key={i}>{i}</li>)}</ul><small>{txt(safety.note,'')}</small></article>
   <article><p className={styles.eyebrow}>SMOG AND HEATWAVE WATCH</p><h3>{typeof watch.smogDaysPast7==='number'?`${watch.smogDaysPast7} smog day(s), ${shown(watch.heatDaysNext7)} hot day(s)`:'Not available'}</h3><p>{txt(watch.summary,'Appears after the first air and weather refresh.')}</p><small>Next 24 h peak AQI: {shown(watch.next24hMaxAqi)}</small></article>
  </section>
  <nav className={`${styles.toolNav} pci-sat-detail-nav`} aria-label="Satellite decision tools">
   {scienceCategories.map((tool,i)=><button key={tool.id} type="button" className={`${styles.toolButton} ${category===tool.id?styles.selected:''}`} aria-pressed={category===tool.id} onClick={()=>{setCategory(tool.id);setNavChoice(tool.id);}}><span className={styles.toolNumber}>0{i+1}</span><strong>{tool.title}</strong><span>{tool.short}</span></button>)}
  </nav>
  <section id="pci-sat-workspace" className={`${styles.workspace} pci-sat-detail-workspace content-card`} aria-live="polite">
   <div className={styles.workspaceHead}><div><p className={styles.eyebrow}>YOUR SATELLITE WORKSPACE</p><h2>{current.title}</h2><p>{current.description}</p><small>Designed for {current.audience.toLowerCase()}</small></div>
    <div className={styles.cityPicker}><label htmlFor="satellite-city">Location</label><select id="satellite-city" value={city} onChange={e=>chooseCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select><small>Regional estimate, not a street or field measurement</small></div></div>
   {error&&<p role="alert" className={styles.alert}>{error}</p>}
   <div className={styles.metricGrid}>{card(primary,true)}{card(second)}{card(third)}</div>
   <div className={styles.analysisGrid}>
    <section id="pci-sat-history" className={`${styles.chartCard} content-card`}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>OBSERVATION HISTORY</p><h3>{category==='solar'?'Solar irradiation · daily history':'Daily rainfall · observed history'}</h3></div><span className={styles.note}>Available 30-day window</span></div>
     <HistoryPlot data={category==='solar'?solarHistory:rainHistory} unit={category==='solar'?'kWh/m²/day':'mm/day'} name={category==='solar'?'solar':'rainfall'}/>
     <p className={styles.insight}>{historyStatus==='loading'?'Loading observed history…':historyStatus==='unavailable'?'History unavailable. No trend inferred.':(category==='solar'?solarReady:rainfallReady)?(category==='solar'?solarInsight.summary:rainfallInsight.summary):'Insufficient verified observations for a comparison.'}</p>
     <small>{category==='solar'?'Daily NASA POWER solar estimates, not panel output.':'Daily NASA POWER corrected rainfall estimates (NOT GPM).'} No seasonal anomaly is implied.</small>
    </section>
    <section className={`${styles.findings} content-card`}><p className={styles.eyebrow}>WHAT WE CAN VERIFY</p><h3>Evidence, not guesses</h3>
     {category==='farm'&&<><Finding title="Irrigation" detail={`${txt(rec(farm.irrigation).label)}. ${txt(rec(farm.irrigation).detail,'')}`}/><Finding title="Spray window" detail={txt(rec(farm.spray).label)}/><Finding title="Heat stress" detail={txt(rec(farm.heat).label)}/><Finding title="Rainfall trend" detail={rainfallReady?rainfallInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Week ahead" detail={forecastText}/><Finding title="River outlook" detail={topRiver?riverText(topRiver):'River-flow data unavailable.'}/></>}
     {category==='safety'&&<><Finding title="Disaster alerts (GDACS)" detail={activeAlerts.length?activeAlerts.slice(0,3).map(a=>`${String(a.alertLevel)}: ${String(a.name)}${a.severityText?` — ${String(a.severityText)}`:''}`).join(' · '):'No alert records returned; source status may be incomplete.'}/><Finding title="Earthquakes (USGS)" detail={earthquakes.length?`${earthquakes.length} reported in 7 days; latest magnitude ${shown(latestQuake.magnitude)}, ${String(latestQuake.place??'')}. Reports, not early warning.`:'No earthquake records returned; source status may be incomplete.'}/><Finding title="Natural events and space weather" detail={`${naturalEvents.length} NASA EONET event record(s). Kp ${shown(kp.kp)} (${String(kp.scale??'not available')}), 24 h max ${shown(kp.max24h)}.`}/></>}
     {category==='water'&&<><Finding title="Rainfall comparison" detail={rainfallReady?rainfallInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Rivers to watch" detail={rising.length?rising.slice(0,3).map(riverText).join(' · '):'River-flow data unavailable.'}/></>}
     {category==='solar'&&<><Finding title="Observed sunlight" detail={solarReady?solarInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Week ahead" detail={days.length?`UV max ${days.map(d=>shown(d.uvIndexMax)).join(' / ')}; rain chance ${days.map(d=>`${shown(d.rainChancePct)}%`).join(' / ')}.`:'Forecast unavailable.'}/><Finding title="Site-specific savings" detail="Roof orientation, shadows, panel efficiency and tariff information are required before any yield or savings calculation."/></>}
     {category==='city'&&<><Finding title="Air quality" detail={aqText}/><Finding title="Heat" detail={forecastText}/><Finding title="Thermal observations" detail={fireInsight.explanation}/></>}
     <div className={styles.pending}><strong>Analysis still needed</strong><p>{current.needs.join(' · ')}</p><small>Not presented as operational until validated.</small></div>
    </section>
   </div>
  </section>
  <section id="pci-sat-industry" className={`${styles.industry} content-card`} aria-labelledby="industry-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>FOR INDUSTRIES · {cityLabel.toUpperCase()}</p><h2 id="industry-title">Risk and planning cards</h2></div><span className={styles.note}>Next 7 days unless stated</span></div>
   <div className={styles.industryGrid}>{industryCards.map(([title,sub,c])=><article key={title}><small>{title}</small><strong>{txt(c.label)}</strong><p>{txt(c.detail,txt(c.cleaningLabel,''))}</p>{title==='Solar'&&typeof c.cleaningLabel==='string'?<span>{c.cleaningLabel}</span>:<span>{sub}</span>}</article>)}</div>
  </section>
  <section id="pci-sat-rankings" className={`${styles.rankings} content-card`} aria-labelledby="rankings-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PULSR WEEKLY · LAST 7 DAYS</p><h2 id="rankings-title">City rankings</h2></div><span className={styles.note}>8 cities · updated hourly</span></div>
   {rankingRows.length?<div className={styles.rankingGrid}>{rankingRows.map(r=>{const w=rec(r.winner),list=Array.isArray(r.list)?r.list.map(rec):[];return <article key={String(r.id)}><small>{String(r.title)}</small>{w.city?<><strong>#1 {String(w.city)[0].toUpperCase()+String(w.city).slice(1)}</strong><span>{shown(w.value)} {String(r.unit)}</span><ol>{list.slice(1,5).map(x=><li key={String(x.city)}>{String(x.city)[0].toUpperCase()+String(x.city).slice(1)} · {shown(x.value)}</li>)}</ol></>:<p>Needs more data (at least 3 cities).</p>}</article>;})}</div>:<p className={styles.note}>Rankings appear after a few hours of air and weather data.</p>}
  </section>
  <section className={`${styles.moreEvidence} content-card`}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>EXPLORE VERIFIED SOURCES</p><h2>What the satellites can currently show</h2></div></div>
   <div className={styles.evidenceGrid}>
    <article><span>01</span><h3>Weather & sunlight</h3><p>NASA POWER rainfall and sunlight, Open-Meteo current weather and 7-day forecast for eight cities.</p><strong>{power?.lastSuccessAt?'Last refresh: '+date(power.lastSuccessAt):'Refresh status unavailable'}</strong></article>
    <article><span>02</span><h3>Air & rivers</h3><p>Copernicus CAMS air quality and GloFAS river flow at {riverRows.length||11} points on the Indus system.</p><strong>{riverRows.length} river points · AQI {shown(aqValues.us_aqi)} in {city[0].toUpperCase()+city.slice(1)}</strong></article>
    <article><span>03</span><h3>Alerts & hazards</h3><p>GDACS disaster alerts, USGS earthquakes, NASA FIRMS hotspots and EONET events (not emergency alerts).</p><strong>{activeAlerts.length} GDACS alerts · {earthquakes.length} USGS reports · {naturalEvents.length} natural-event records</strong></article>
   </div>
  </section>
  <details id="pci-sat-sources" className={`${styles.sourceDisclosure} content-card`}><summary><span><strong>Data source transparency</strong><small>Provider status and original observation dates</small></span><span>View sources</span></summary>
   <div className={styles.sourceBody}><p>Air quality and river flow are model outputs, not flood extent or station measurements. GDACS and NASA EONET are not NDMA or PMD instructions and not an emergency alert.</p><div className={styles.sourceGrid}>{providers.map(p=><article key={String(p.id)}><strong>{String(p.label)}</strong><span>{p.available?'Recently refreshed':!p.implemented?'Not implemented':!p.enabled?'Ingestion disabled':p.refreshQueued?'Refresh queued':'Awaiting first successful ingestion'}</span><small>Last success: {date(p.lastSuccessAt)}</small></article>)}</div><p>NASA GIBS imagery: {imagery.length?'Available':'Unavailable'} · GPM imagery: {gpmImagery.length?'Available':'Unavailable'} · Extra map layers: {layers.length}. Images are not quantitative measurements.</p></div>
  </details>
   </div>
  </details>
  <p className={styles.disclaimer}>Satellite and modeled regional observations can be incomplete or delayed. No output is an emergency alert, field diagnosis, property guarantee or financial forecast. For emergencies, follow NDMA, PMD and local Pakistani authorities.</p>
 </div>;
}

function Finding({title,detail}:{title:string;detail:string}){return <div className={styles.finding}><strong>{title}</strong><p>{detail}</p></div>;}
function HistoryPlot({data,unit,name}:{data:Datum[];unit:string;name:string}){
 const points=data.map(p=>({when:typeof p.observedAt==='string'?Date.parse(p.observedAt):NaN,value:typeof p.value==='number'?p.value:NaN})).filter(p=>Number.isFinite(p.when)&&Number.isFinite(p.value)&&p.value>=0).sort((a,b)=>a.when-b.when);
 const unique=Array.from(new Map(points.map(p=>[p.when,p])).values()).slice(-30);
 if(!unique.length)return <div className={styles.chartEmpty}>No verified daily observations available yet.</div>;
 const highest=Math.max(...unique.map(p=>p.value),0.01);
 const left=36,right=664,top=15,bottom=165;
 const x=(i:number)=>unique.length===1?(left+right)/2:left+(i/(unique.length-1))*(right-left);
 const y=(v:number)=>bottom-(v/highest)*(bottom-top);
 const path=unique.map((p,i)=>`${i===0?'M':'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
 return <div className={styles.plot}><svg viewBox="0 0 700 207" role="img" aria-label={`${name} daily observations for ${unique.length} days. Maximum ${shown(highest)} ${unit}`} preserveAspectRatio="none">
  {[0,0.5,1].map(t=><g key={t}><line x1={left} x2={right} y1={y(t*highest)} y2={y(t*highest)} className={styles.plotGrid}/><text x="3" y={y(t*highest)+4} className={styles.plotLabel}>{shown(t*highest)}</text></g>)}
  <path d={path} className={styles.plotLine}/>{unique.map((p,i)=><circle key={p.when} cx={x(i)} cy={y(p.value)} r="3.3" className={styles.plotDot}><title>{date(new Date(p.when).toISOString())}: {shown(p.value)} {unit}</title></circle>) }
  <text x={left} y="195" className={styles.plotLabel}>{new Date(unique[0].when).toLocaleDateString('en-PK',{day:'numeric',month:'short'})}</text><text x={right} y="195" textAnchor="end" className={styles.plotLabel}>{new Date(unique[unique.length-1].when).toLocaleDateString('en-PK',{day:'numeric',month:'short'})}</text>
 </svg><div className={styles.plotCaption}><span>{unique.length} recorded days</span><span>Latest {shown(unique[unique.length-1].value)} {unit}</span></div></div>;
}
