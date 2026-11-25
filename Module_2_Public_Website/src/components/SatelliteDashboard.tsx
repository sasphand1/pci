'use client';
import {useEffect,useRef,useState} from 'react';
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
export function SatelliteDashboard({sources,fires,rain,solar}:{sources:unknown[];fires:unknown[];rain:unknown[];solar:unknown[]}){
 const [city,setCity]=useState('lahore'),[rainData,setRainData]=useState(rows(rain)),[solarData,setSolarData]=useState(rows(solar));
 const [error,setError]=useState('');
 const [category,setCategory]=useState<ScienceCategory>('farm');
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
  Promise.all([get('rainfall',city),get('solar',city)]).then(([r,s])=>{if(active){setRainData(r);setSolarData(s);}}).catch(()=>{if(active){setError('Unable to retrieve city observations.');setRainData([]);setSolarData([]);}});
  return()=>{active=false;};},[city,rain,solar]);
 useEffect(()=>{let active=true;setHistoryStatus('loading');setRainHistory([]);setSolarHistory([]);
  Promise.all([get('rainfall-history',city),get('solar-history',city)])
   .then(([r,s])=>{if(active){setRainHistory(r);setSolarHistory(s);setHistoryStatus('ready');}})
   .catch(()=>{if(active)setHistoryStatus('unavailable');});
  return()=>{active=false;};},[city]);
 const providers=rows(sources),fireRows=rows(fires);const power=providers.find(p=>p.id==='power');const latestRain=rainData[0],latestSolar=solarData[0];
 const rainfallInsight=compareDailySeries(rainHistory,'rainfall');
 const solarInsight=compareDailySeries(solarHistory,'solar');
 const fireInsight=summarizeThermalDetections(fireRows);
 const current=scienceCategories.find(c=>c.id===category)!;
 const postMap=()=>{const points=fireRows.filter(p=>typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.latitude>=23&&p.latitude<=38&&p.longitude>=60&&p.longitude<=78).slice(0,200).map(p=>({latitude:p.latitude,longitude:p.longitude,observedAt:typeof p.observedAt==='string'?p.observedAt:null}));
 const events=naturalEvents.filter(e=>typeof e.latitude==='number'&&typeof e.longitude==='number').slice(0,100).map(e=>({latitude:e.latitude,longitude:e.longitude,title:typeof e.title==='string'?e.title:'Natural event'}));
 const extraLayers=layers.filter(l=>typeof l.id==='string'&&typeof l.tileTemplate==='string').map(l=>({id:l.id,label:typeof l.label==='string'?l.label:String(l.id),tileTemplate:l.tileTemplate,maxZoom:typeof l.maxZoom==='number'?l.maxZoom:6}));
 const quakes=earthquakes.filter(q=>typeof q.latitude==='number'&&typeof q.longitude==='number'&&typeof q.magnitude==='number').slice(0,200).map(q=>({latitude:q.latitude,longitude:q.longitude,magnitude:q.magnitude}));
 const alertPoints=alerts.filter(a=>typeof a.latitude==='number'&&typeof a.longitude==='number').slice(0,60).map(a=>({latitude:a.latitude,longitude:a.longitude,level:a.alertLevel,name:a.name}));
 const orbitElements=orbits.slice(0,80).map(o=>({name:o.name,isIss:o.isIss===true,epoch:o.epoch,meanMotion:o.meanMotion,eccentricity:o.eccentricity,inclination:o.inclination,raOfAscNode:o.raOfAscNode,argOfPericenter:o.argOfPericenter,meanAnomaly:o.meanAnomaly}));
 mapFrame.current?.contentWindow?.postMessage({type:'PCI_SATELLITE_POINTS_V1',points,events,quakes,alerts:alertPoints,orbits:orbitElements,imagery:imagery[0]?.tileTemplate,gpmImagery:gpmImagery[0]?.tileTemplate,extraLayers,category},window.location.origin);};
 useEffect(()=>{postMap();},[naturalEvents,imagery,gpmImagery,layers,category,fires,earthquakes,alerts,orbits]);

 // Derived, plain-language readings. Nothing is shown that the sources did not provide.
 const aq=rec(air[0]),aqValues=rec(aq.values),next24=rec(aq.next24h);
 const w=rec(weather[0]),wNow=rec(w.current),days=(Array.isArray(w.daily)?w.daily:[]) as Day[];
 const rain7=days.reduce((s,d)=>s+(num(d.rainMm)??0),0),hottest=days.reduce<number|null>((m,d)=>{const v=num(d.feelsLikeMaxC)??num(d.maxC);return v===null?m:m===null?v:Math.max(m,v);},null);
 const riverRows=rivers.map(rec).filter(r=>num(r.dischargeM3s)!==null);
 const rising=[...riverRows].sort((a,b)=>(num(b.peakToTodayRatio)??0)-(num(a.peakToTodayRatio)??0));
 const topRiver=rising[0];
 const kp=rec(space[0]);
 const activeAlerts=alerts.map(rec);const severe=activeAlerts.filter(a=>a.alertLevel==='Orange'||a.alertLevel==='Red');
 const latestQuake=rec(earthquakes[0]);
 const riverText=(r:Datum)=>`${r.river} at ${r.place}: ${shown(r.dischargeM3s)} m³/s today${num(r.peakToTodayRatio)!==null?`, 30-day peak ${shown(rec(r.peak30).max)} m³/s on ${String(rec(r.peak30).date)} (×${shown(r.peakToTodayRatio)})`:''}`;
 const forecastText=days.length?`Next 7 days: ${shown(Math.round(rain7*10)/10)} mm rain in total, highest feels-like ${shown(hottest)} °C, ${shown(w.heatDays)} day(s) at 40 °C or above.`:'Forecast unavailable.';
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
  {label:'Rain next 7 days',value:days.length?shown(Math.round(rain7*10)/10):'Not available',unit:'mm (forecast)',note:'Open-Meteo forecast. Observed history below is NASA POWER corrected precipitation — NOT GPM or a rain gauge.',at:w.observedAt};
 const second=category==='solar'?{label:'UV index today',value:shown(days[0]?.uvIndexMax),unit:'max',note:'Open-Meteo forecast.',at:w.observedAt}:
  category==='city'?{label:'Feels like today',value:shown(days[0]?.feelsLikeMaxC),unit:'°C max',note:`Now ${shown(wNow.temperatureC)} °C, feels like ${shown(wNow.feelsLikeC)} °C.`,at:w.observedAt}:
  category==='safety'?{label:'Latest earthquake',value:shown(latestQuake.magnitude),unit:'magnitude',note:typeof latestQuake.place==='string'?latestQuake.place:'USGS reports, not early warning.',at:latestQuake.observedAt}:
  {label:'Observed rainfall',value:shown(latestRain?.value),unit:'mm/day',note:'NASA POWER corrected daily precipitation — NOT GPM or a rain gauge.',at:latestRain?.observedAt};
 const third=category==='safety'?{label:'Space weather',value:shown(kp.kp),unit:`Kp · ${String(kp.scale??'')}`,note:'NOAA SWPC estimated planetary K-index (affects GPS and radio).',at:kp.observedAt}:
  category==='city'?{label:'Hot days ahead',value:shown(w.heatDays),unit:'days ≥ 40 °C feels-like',note:'Open-Meteo 7-day forecast.',at:w.observedAt}:
  {label:'Air quality now',value:shown(aqValues.us_aqi),unit:`US AQI · ${String(aq.band??'not classified')}`,note:'Copernicus CAMS, modelled.',at:aq.observedAt};
 const card=(c:typeof second,primaryCard=false)=><article className={`${styles.metricCard} ${primaryCard?styles.metricPrimary:''}`}><small>{c.label}</small><strong>{c.value}</strong><span>{c.unit}</span><p>{c.note}</p><small>Observed: {date(c.at)}</small></article>;
 return <main className={styles.root}>
  {providers.length===0&&<p role="status" className={styles.alert}>Satellite provider information is currently unavailable. Historical observations may be incomplete.</p>}
  {power?.enabled===false&&<p role="status" className={styles.alert}>NASA POWER ingestion is disabled. Enable it in PCI Management → Satellite APIs.</p>}
  <section className={styles.hero} aria-labelledby="satellite-hero-title">
   <div><p className={styles.eyebrow}>EARTH OBSERVATIONS · PAKISTAN</p><h2 id="satellite-hero-title">Answers from above. Grounded in real data.</h2><p>Air, weather, rivers, fires, earthquakes and alerts from NASA, Copernicus, USGS, GDACS and NOAA. Every number shows its source and time. No fabricated risk scores.</p></div>
   <div className={styles.heroAside}><span className={styles.liveDot}/> Live source status <strong>{providers.filter(p=>p.enabled===true&&p.lastSuccessAt).length} / {providers.length} reporting</strong><small>Reporting means the source delivered data on its last refresh.</small></div>
  </section>
  <section className={styles.globeHero} aria-labelledby="globe-title">
   <div className={styles.globeFrame}><iframe ref={mapFrame} className={styles.globeMap} title="Rotating Earth with live satellites and Pakistan observation map" src="/satellite-map.html" loading="eager" onLoad={postMap}/></div>
   <aside className={styles.goOut} aria-live="polite">
    <div className={styles.goOutHead}><div><p className={styles.eyebrow}>GO-OUT SCORE · TODAY</p><h2 id="globe-title">{cityLabel}</h2></div>
     <select aria-label="City" value={city} onChange={e=>setCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select></div>
    <div className={styles.goOutScore} data-level={txt(goOut.level,'none')}><strong>{typeof goOut.score==='number'?goOut.score:'–'}</strong><span>/ 100</span></div>
    <p className={styles.goOutLabel} data-level={txt(goOut.level,'none')}>{txt(goOut.label,'Score appears after the first air and weather refresh')}</p>
    <ul className={styles.adviceList}>{advice.map(a=><li key={a}>{a}</li>)}</ul>
    <div className={styles.miniGrid}><div><small>Air (US AQI)</small><b>{shown(rec(goOut.inputs).usAqi)}</b></div><div><small>Feels like max</small><b>{shown(rec(goOut.inputs).feelsLikeMaxC)} °C</b></div><div><small>UV max</small><b>{shown(rec(goOut.inputs).uvIndexMax)}</b></div><div><small>Rain chance</small><b>{shown(rec(goOut.inputs).rainChancePct)}%</b></div></div>
    <small className={styles.note}>Combines Copernicus CAMS air quality (modelled) and the Open-Meteo forecast. Not an official PMD warning.</small>
   </aside>
  </section>
  <section className={styles.forYou} aria-label="For you today">
   <article><p className={styles.eyebrow}>IS MY AREA SAFE TODAY</p><h3 data-level={txt(safety.level,'none')}>{txt(safety.label,'Not available')}</h3><ul>{safetyItems.map(i=><li key={i}>{i}</li>)}</ul><small>{txt(safety.note,'')}</small></article>
   <article><p className={styles.eyebrow}>SMOG AND HEATWAVE WATCH</p><h3>{typeof watch.smogDaysPast7==='number'?`${watch.smogDaysPast7} smog day(s), ${shown(watch.heatDaysNext7)} hot day(s)`:'Not available'}</h3><p>{txt(watch.summary,'Appears after the first air and weather refresh.')}</p><small>Next 24 h peak AQI: {shown(watch.next24hMaxAqi)}</small></article>
  </section>
  <nav className={styles.toolNav} aria-label="Satellite decision tools">
   {scienceCategories.map((tool,i)=><button key={tool.id} type="button" className={`${styles.toolButton} ${category===tool.id?styles.selected:''}`} aria-pressed={category===tool.id} onClick={()=>setCategory(tool.id)}><span className={styles.toolNumber}>0{i+1}</span><strong>{tool.title}</strong><span>{tool.short}</span></button>)}
  </nav>
  <section className={styles.workspace} aria-live="polite">
   <div className={styles.workspaceHead}><div><p className={styles.eyebrow}>YOUR SATELLITE WORKSPACE</p><h2>{current.title}</h2><p>{current.description}</p><small>Designed for {current.audience.toLowerCase()}</small></div>
    <div className={styles.cityPicker}><label htmlFor="satellite-city">Location</label><select id="satellite-city" value={city} onChange={e=>setCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select><small>Regional estimate, not a street or field measurement</small></div></div>
   {error&&<p role="alert" className={styles.alert}>{error}</p>}
   <div className={styles.metricGrid}>{card(primary,true)}{card(second)}{card(third)}</div>
   <div className={styles.analysisGrid}>
    <section className={styles.chartCard}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>OBSERVATION HISTORY</p><h3>{category==='solar'?'Solar irradiation · daily history':'Daily rainfall · observed history'}</h3></div><span className={styles.note}>Available 30-day window</span></div>
     <HistoryPlot data={category==='solar'?solarHistory:rainHistory} unit={category==='solar'?'kWh/m²/day':'mm/day'} name={category==='solar'?'solar':'rainfall'}/>
     <p className={styles.insight}>{historyStatus==='loading'?'Loading observed history…':historyStatus==='unavailable'?'History unavailable. No trend inferred.':(category==='solar'?solarReady:rainfallReady)?(category==='solar'?solarInsight.summary:rainfallInsight.summary):'Insufficient verified observations for a comparison.'}</p>
     <small>{category==='solar'?'Daily NASA POWER solar estimates, not panel output.':'Daily NASA POWER corrected rainfall estimates (NOT GPM).'} No seasonal anomaly is implied.</small>
    </section>
    <section className={styles.findings}><p className={styles.eyebrow}>WHAT WE CAN VERIFY</p><h3>Evidence, not guesses</h3>
     {category==='farm'&&<><Finding title="Irrigation" detail={`${txt(rec(farm.irrigation).label)}. ${txt(rec(farm.irrigation).detail,'')}`}/><Finding title="Spray window" detail={txt(rec(farm.spray).label)}/><Finding title="Heat stress" detail={txt(rec(farm.heat).label)}/><Finding title="Rainfall trend" detail={rainfallReady?rainfallInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Week ahead" detail={forecastText}/><Finding title="River outlook" detail={topRiver?riverText(topRiver):'River-flow data unavailable.'}/></>}
     {category==='safety'&&<><Finding title="Disaster alerts (GDACS)" detail={activeAlerts.length?activeAlerts.slice(0,3).map(a=>`${String(a.alertLevel)}: ${String(a.name)}${a.severityText?` — ${String(a.severityText)}`:''}`).join(' · '):'No GDACS alerts for Pakistan in the last 30 days.'}/><Finding title="Earthquakes (USGS)" detail={earthquakes.length?`${earthquakes.length} reported in 7 days; latest magnitude ${shown(latestQuake.magnitude)}, ${String(latestQuake.place??'')}. Reports, not early warning.`:'No earthquakes of magnitude 2.5+ reported in 7 days.'}/><Finding title="Natural events and space weather" detail={`${naturalEvents.length} NASA EONET event record(s). Kp ${shown(kp.kp)} (${String(kp.scale??'not available')}), 24 h max ${shown(kp.max24h)}.`}/></>}
     {category==='water'&&<><Finding title="Rainfall comparison" detail={rainfallReady?rainfallInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Rivers to watch" detail={rising.length?rising.slice(0,3).map(riverText).join(' · '):'River-flow data unavailable.'}/></>}
     {category==='solar'&&<><Finding title="Observed sunlight" detail={solarReady?solarInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Week ahead" detail={days.length?`UV max ${days.map(d=>shown(d.uvIndexMax)).join(' / ')}; rain chance ${days.map(d=>`${shown(d.rainChancePct)}%`).join(' / ')}.`:'Forecast unavailable.'}/><Finding title="Site-specific savings" detail="Roof orientation, shadows, panel efficiency and tariff information are required before any yield or savings calculation."/></>}
     {category==='city'&&<><Finding title="Air quality" detail={aqText}/><Finding title="Heat" detail={forecastText}/><Finding title="Thermal observations" detail={fireInsight.explanation}/></>}
     <div className={styles.pending}><strong>Analysis still needed</strong><p>{current.needs.join(' · ')}</p><small>Not presented as operational until validated.</small></div>
    </section>
   </div>
  </section>
  <section className={styles.industry} aria-labelledby="industry-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>FOR INDUSTRIES · {cityLabel.toUpperCase()}</p><h2 id="industry-title">Risk and planning cards</h2></div><span className={styles.note}>Next 7 days unless stated</span></div>
   <div className={styles.industryGrid}>{industryCards.map(([title,sub,c])=><article key={title}><small>{title}</small><strong>{txt(c.label)}</strong><p>{txt(c.detail,txt(c.cleaningLabel,''))}</p>{title==='Solar'&&typeof c.cleaningLabel==='string'?<span>{c.cleaningLabel}</span>:<span>{sub}</span>}</article>)}</div>
  </section>
  <section className={styles.rankings} aria-labelledby="rankings-title"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>PULSR WEEKLY · LAST 7 DAYS</p><h2 id="rankings-title">City rankings</h2></div><span className={styles.note}>8 cities · updated hourly</span></div>
   {rankingRows.length?<div className={styles.rankingGrid}>{rankingRows.map(r=>{const w=rec(r.winner),list=Array.isArray(r.list)?r.list.map(rec):[];return <article key={String(r.id)}><small>{String(r.title)}</small>{w.city?<><strong>#1 {String(w.city)[0].toUpperCase()+String(w.city).slice(1)}</strong><span>{shown(w.value)} {String(r.unit)}</span><ol>{list.slice(1,5).map(x=><li key={String(x.city)}>{String(x.city)[0].toUpperCase()+String(x.city).slice(1)} · {shown(x.value)}</li>)}</ol></>:<p>Needs more data (at least 3 cities).</p>}</article>;})}</div>:<p className={styles.note}>Rankings appear after a few hours of air and weather data.</p>}
  </section>
  <section className={styles.moreEvidence}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>EXPLORE VERIFIED SOURCES</p><h2>What the satellites can currently show</h2></div></div>
   <div className={styles.evidenceGrid}>
    <article><span>01</span><h3>Weather & sunlight</h3><p>NASA POWER rainfall and sunlight, Open-Meteo current weather and 7-day forecast for eight cities.</p><strong>{power?.lastSuccessAt?'Last refresh: '+date(power.lastSuccessAt):'Refresh status unavailable'}</strong></article>
    <article><span>02</span><h3>Air & rivers</h3><p>Copernicus CAMS air quality and GloFAS river flow at {riverRows.length||11} points on the Indus system.</p><strong>{riverRows.length} river points · AQI {shown(aqValues.us_aqi)} in {city[0].toUpperCase()+city.slice(1)}</strong></article>
    <article><span>03</span><h3>Alerts & hazards</h3><p>GDACS disaster alerts, USGS earthquakes, NASA FIRMS hotspots and EONET events (not emergency alerts).</p><strong>{activeAlerts.length} GDACS alerts · {earthquakes.length} USGS reports · {naturalEvents.length} natural-event records</strong></article>
   </div>
  </section>
  <details className={styles.sourceDisclosure}><summary><span><strong>Data source transparency</strong><small>Provider status and original observation dates</small></span><span>View sources</span></summary>
   <div className={styles.sourceBody}><p>Air quality and river flow are model outputs, not flood extent or station measurements. GDACS and NASA EONET are not NDMA or PMD instructions and not an emergency alert.</p><div className={styles.sourceGrid}>{providers.map(p=><article key={String(p.id)}><strong>{String(p.label)}</strong><span>{p.available?'Recently refreshed':!p.implemented?'Not implemented':!p.enabled?'Ingestion disabled':p.refreshQueued?'Refresh queued':'Awaiting first successful ingestion'}</span><small>Last success: {date(p.lastSuccessAt)}</small></article>)}</div><p>NASA GIBS imagery: {imagery.length?'Available':'Unavailable'} · GPM imagery: {gpmImagery.length?'Available':'Unavailable'} · Extra map layers: {layers.length}. Images are not quantitative measurements.</p></div>
  </details>
  <p className={styles.disclaimer}>Satellite and modeled regional observations can be incomplete or delayed. No output is an emergency alert, field diagnosis, property guarantee or financial forecast. For emergencies, follow NDMA, PMD and local Pakistani authorities.</p>
 </main>;
}

function Finding({title,detail}:{title:string;detail:string}){return <div className={styles.finding}><strong>{title}</strong><p>{detail}</p></div>;}
function HistoryPlot({data,unit,name}:{data:Datum[];unit:string;name:string}){
 const points=data.map(p=>({when:typeof p.observedAt==='string'?Date.parse(p.observedAt):NaN,value:typeof p.value==='number'?p.value:Number(p.value)})).filter(p=>Number.isFinite(p.when)&&Number.isFinite(p.value)&&p.value>=0).sort((a,b)=>a.when-b.when);
 const unique=Array.from(new Map(points.map(p=>[p.when,p])).values()).slice(-30);
 if(!unique.length)return <div className={styles.chartEmpty}>No verified daily observations available yet.</div>;
 const highest=Math.max(...unique.map(p=>p.value),0.01);
 const left=36,right=664,top=15,bottom=165;
 const x=(i:number)=>unique.length===1?(left+right)/2:left+(i/(unique.length-1))*(right-left);
 const y=(v:number)=>bottom-(v/highest)*(bottom-top);
 const path=unique.map((p,i)=>`${i===0?'M':'L'} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
 return <div className={styles.plot}><svg viewBox="0 0 700 207" role="img" aria-label={`${name} daily observations for ${unique.length} days. Maximum ${shown(highest)} ${unit}`} preserveAspectRatio="none">
  {[0,0.5,1].map(t=><g key={t}><line x1={left} x2={right} y1={y(t*highest)} y2={y(t*highest)} className={styles.plotGrid}/><text x="3" y={y(t*highest)+4} className={styles.plotLabel}>{shown(t*highest)}</text></g>)}
  <path d={path} className={styles.plotLine}/>{unique.map((p,i)=><circle key={p.when} cx={x(i)} cy={y(p.value)} r="3.3" className={styles.plotDot}/>) }
  <text x={left} y="195" className={styles.plotLabel}>{new Date(unique[0].when).toLocaleDateString('en-PK',{day:'numeric',month:'short'})}</text><text x={right} y="195" textAnchor="end" className={styles.plotLabel}>{new Date(unique[unique.length-1].when).toLocaleDateString('en-PK',{day:'numeric',month:'short'})}</text>
 </svg><div className={styles.plotCaption}><span>{unique.length} recorded days</span><span>Latest {shown(unique[unique.length-1].value)} {unit}</span></div></div>;
}
