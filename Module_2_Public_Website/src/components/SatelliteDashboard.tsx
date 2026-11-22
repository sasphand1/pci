'use client';
import {useEffect,useRef,useState} from 'react';
import {compareDailySeries, summarizeThermalDetections} from '@/lib/satelliteScience.mjs';
import styles from './SatelliteExperience.module.css';
type Datum=Record<string,unknown>;
const API='/api/satellite';
const cityNames=['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad'];
const scienceCategories=[
 {id:'farm',title:'Farm Doctor',short:'Farms',description:'Understand recent rainfall, sunlight and available Earth-observation evidence before making farm decisions.',audience:'Farmers and agricultural advisers',needs:['Crop vegetation health','Irrigation demand','Crop recovery']},
 {id:'land',title:'Land DNA',short:'Land',description:'Investigate the satellite record of a place. Scene discovery is available; verified land-change measurement is not yet online.',audience:'Landowners and buyers',needs:['Land-cover history','Former water extent','Urban expansion']},
 {id:'water',title:'Water Guardian',short:'Water',description:'Compare observed regional rainfall history and explore precipitation imagery. These are not flood predictions.',audience:'Residents and water planners',needs:['Soil moisture measurement','Surface water mapping','Flood extent']},
 {id:'solar',title:'Solar Advisor',short:'Solar',description:'Explore solar irradiation estimates and recent trends before commissioning site-specific yield analysis.',audience:'Homeowners and installers',needs:['Rooftop yield model','Panel tilt and shading','Seasonal yield projection']},
 {id:'city',title:'City Health',short:'Cities',description:'Explore available thermal alerts and urban observation records. Neighborhood heat and air-quality maps are not yet measured.',audience:'City residents and researchers',needs:['Land-surface temperature','Nighttime radiance','Green-cover change']}
] as const;
type ScienceCategory=(typeof scienceCategories)[number]['id'];
function rows(d:unknown[]):Datum[]{return d.filter((x):x is Datum=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)));}
function shown(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-PK',{maximumFractionDigits:2}):'Not available';}
function date(v:unknown){if(typeof v!=='string')return 'Not available';const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})+' PKT':'Not available';}
export function SatelliteDashboard({sources,fires,rain,solar}:{sources:unknown[];fires:unknown[];rain:unknown[];solar:unknown[]}){
 const [city,setCity]=useState('lahore'),[rainData,setRainData]=useState(rows(rain)),[solarData,setSolarData]=useState(rows(solar));
 const [error,setError]=useState('');
 const [category,setCategory]=useState<ScienceCategory>('farm');
 const [rainHistory,setRainHistory]=useState<Datum[]>([]),[solarHistory,setSolarHistory]=useState<Datum[]>([]);
 const [historyStatus,setHistoryStatus]=useState<'loading'|'ready'|'unavailable'>('loading');
 const mapFrame=useRef<HTMLIFrameElement>(null);
 const [earthquakes,setEarthquakes]=useState<Datum[]>([]);
 const [scienceScenes,setScienceScenes]=useState<Record<string,Datum[]>>({});
 const [naturalEvents,setNaturalEvents]=useState<Datum[]>([]),[imagery,setImagery]=useState<Datum[]>([]),[gpmImagery,setGpmImagery]=useState<Datum[]>([]),[scenes,setScenes]=useState<Record<string,Datum[]>>({});
 useEffect(()=>{let active=true;const filters=['natural-events','imagery','gpm-imagery','scenes&mission=sentinel1','scenes&mission=sentinel2','scenes&mission=sentinel5p','earthquakes','science-scenes&mission=landsat','science-scenes&mission=ecostress','science-scenes&mission=smap','science-scenes&mission=blackmarble'];
 Promise.allSettled(filters.map(async f=>{const resp=await fetch(`${API}?metric=${f}`,{signal:AbortSignal.timeout(8000)});if(!resp.ok)throw Error('Source unavailable');return rows((await resp.json()).data??[])})).then(results=>{if(!active)return;
 const value=(i:number)=>{const result=results[i];return result?.status==='fulfilled'?result.value:[];};
 setNaturalEvents(value(0));setImagery(value(1));setGpmImagery(value(2));setScenes({sentinel1:value(3),sentinel2:value(4),sentinel5p:value(5)}); setEarthquakes(value(6));setScienceScenes({landsat:value(7),ecostress:value(8),smap:value(9),blackmarble:value(10)});});
 return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setError('');if(city==='lahore'){setRainData(rows(rain));setSolarData(rows(solar));return;}
 Promise.all(['rainfall','solar'].map(async metric=>{const response=await fetch(`${API}?metric=${encodeURIComponent(metric)}&city=${encodeURIComponent(city)}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Data service unavailable');return rows((await response.json()).data??[]);})).then(([r,s])=>{if(active){setRainData(r);setSolarData(s);}}).catch(()=>{if(active){setError('Unable to retrieve city observations.');setRainData([]);setSolarData([]);}});return()=>{active=false;};},[city,rain,solar]);
 useEffect(()=>{let active=true;setHistoryStatus('loading');setRainHistory([]);setSolarHistory([]);
  Promise.all(['rainfall-history','solar-history'].map(async metric=>{
   const response=await fetch(`${API}?metric=${metric}&city=${encodeURIComponent(city)}`,{signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('History unavailable');return rows((await response.json()).data??[]);
  })).then(([r,s])=>{if(active){setRainHistory(r);setSolarHistory(s);setHistoryStatus('ready');}})
    .catch(()=>{if(active)setHistoryStatus('unavailable');});
  return()=>{active=false;};},[city]);
 const providers=rows(sources),fireRows=rows(fires);const power=providers.find(p=>p.id==='power');const latestRain=rainData[0],latestSolar=solarData[0];
 const rainfallInsight=compareDailySeries(rainHistory,'rainfall');
 const solarInsight=compareDailySeries(solarHistory,'solar');
 const fireInsight=summarizeThermalDetections(fireRows);
 const selectedCategory=scienceCategories.find(c=>c.id===category)!;
 const postMap=()=>{const points=fireRows.filter(p=>typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.latitude>=23&&p.latitude<=38&&p.longitude>=60&&p.longitude<=78).slice(0,200).map(p=>({latitude:p.latitude,longitude:p.longitude,observedAt:typeof p.observedAt==='string'?p.observedAt:null}));
 const events=naturalEvents.filter(e=>typeof e.latitude==='number'&&typeof e.longitude==='number').slice(0,100).map(e=>({latitude:e.latitude,longitude:e.longitude,title:typeof e.title==='string'?e.title:'Natural event'}));
 mapFrame.current?.contentWindow?.postMessage({type:'PCI_SATELLITE_POINTS_V1',points,events,imagery:imagery[0]?.tileTemplate,gpmImagery:gpmImagery[0]?.tileTemplate,category:'discover'},window.location.origin);};
 useEffect(()=>{postMap();},[naturalEvents,imagery,gpmImagery,category,fires]);

 const latestTime=category==='solar'?latestSolar?.observedAt:latestRain?.observedAt;
 const providerFor=(id:string)=>providers.find(p=>p.id===id);
 const sourceState=(id:string)=>{const p=providerFor(id);return !p?'Source not configured':p.enabled!==true?'Collection is off':p.lastSuccessAt?'Source refreshed':'Awaiting first refresh';};
 const current=selectedCategory;
 const rainfallReady=rainfallInsight.status==='ready';
 const solarReady=solarInsight.status==='ready';
 const heroValue=category==='solar'?shown(latestSolar?.value):category==='water'||category==='farm'?shown(latestRain?.value):category==='city'?String(fireInsight.count):'Scene records';
 const heroUnit=category==='solar'?'kWh/m²/day':category==='water'||category==='farm'?'mm/day':category==='city'?'thermal observations':'Available catalogues';
 return <main className={styles.root}>
  {providers.length===0&&<p role="status" className={styles.alert}>Satellite provider information is currently unavailable. Historical observations may be incomplete.</p>}
  {power?.enabled===false&&<p role="status" className={styles.alert}>NASA POWER ingestion is disabled. Enable it in PCI Management → Satellite APIs.</p>}
  {power?.refreshQueued===true&&<p role="status" className={styles.alert}>NASA POWER refresh queued; the PCI worker processes queued refreshes.</p>}
  {power?.enabled===true&&power?.refreshQueued!==true&&power?.lastSuccessAt==null&&<p role="status" className={styles.alert}>NASA POWER has not completed a successful ingestion.</p>}
  <section className={styles.hero} aria-labelledby="satellite-hero-title">
   <div><p className={styles.eyebrow}>EARTH OBSERVATIONS · PAKISTAN</p><h2 id="satellite-hero-title">Answers from above. Grounded in real data.</h2><p>Choose a problem, explore recent observations and see exactly which analysis is available. No fabricated risk scores or predictions.</p></div>
   <div className={styles.heroAside}><span className={styles.liveDot}/> Live source status <strong>{providers.filter(p=>p.enabled===true&&p.lastSuccessAt).length} / {providers.length} reporting</strong><small>Reporting means ingestion succeeded, not that all scientific measurements are available.</small></div>
  </section>
  <nav className={styles.toolNav} aria-label="Satellite decision tools">
   {scienceCategories.map((tool,i)=><button key={tool.id} type="button" className={`${styles.toolButton} ${category===tool.id?styles.selected:''}`} aria-pressed={category===tool.id} onClick={()=>setCategory(tool.id)}><span className={styles.toolNumber}>0{i+1}</span><strong>{tool.title}</strong><span>{tool.short}</span></button>)}
  </nav>
  <section className={styles.workspace} aria-live="polite">
   <div className={styles.workspaceHead}><div><p className={styles.eyebrow}>YOUR SATELLITE WORKSPACE</p><h2>{current.title}</h2><p>{current.description}</p><small>Designed for {current.audience.toLowerCase()}</small></div>
    <div className={styles.cityPicker}><label htmlFor="satellite-city">Location</label><select id="satellite-city" value={city} onChange={e=>setCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select><small>Regional estimate, not a street or field measurement</small></div></div>
   {error&&<p role="alert" className={styles.alert}>{error}</p>}
   <div className={styles.metricGrid}>
    <article className={`${styles.metricCard} ${styles.metricPrimary}`}><small>{category==='solar'?'Solar irradiation':category==='water'?'Daily rainfall':category==='farm'?'Recent rainfall context':category==='city'?'Regional thermal detections':'Scene discovery status'}</small><strong>{heroValue}</strong><span>{heroUnit}</span><p>{category==='city'?'NASA FIRMS detects thermal anomalies, not confirmed fires.':category==='land'?'Discovery metadata is not land-change analysis.':category==='solar'?'NASA POWER daily modeled / satellite-derived estimate.':'NASA POWER corrected daily precipitation — NOT GPM or a rain gauge.'}</p><small>Observed: {date(latestTime)}</small></article>
    <article className={styles.metricCard}><small>{category==='solar'?'Rainfall context':'Solar resource'}</small><strong>{category==='solar'?shown(latestRain?.value):shown(latestSolar?.value)}</strong><span>{category==='solar'?'mm/day':'kWh/m²/day'}</span><p>{category==='solar'?'NASA POWER precipitation estimate':'NASA POWER regional daily solar estimate; not generation at a specific rooftop'}</p><small>Observed: {date(category==='solar'?latestRain?.observedAt:latestSolar?.observedAt)}</small></article>
    <article className={styles.metricCard}><small>Satellite acquisition coverage</small><strong>{(['landsat','ecostress','smap','blackmarble'] as const).reduce((n,id)=>n+(scienceScenes[id]?.length??0),0)}</strong><span>recent discovery records</span><p>Combined recent scene/granule records, not processed vegetation, thermal or moisture measurements.</p><small>Collection status varies by source</small></article>
   </div>
   <div className={styles.analysisGrid}>
    <section className={styles.chartCard}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>OBSERVATION HISTORY</p><h3>{category==='solar'?'Solar irradiation · daily history':'Daily rainfall · observed history'}</h3></div><span className={styles.note}>Available 30-day window</span></div>
     <HistoryPlot data={category==='solar'?solarHistory:rainHistory} unit={category==='solar'?'kWh/m²/day':'mm/day'} name={category==='solar'?'solar':'rainfall'}/>
     <p className={styles.insight}>{historyStatus==='loading'?'Loading observed history…':historyStatus==='unavailable'?'History unavailable. No trend inferred.':(category==='solar'?solarReady:rainfallReady)?(category==='solar'?solarInsight.summary:rainfallInsight.summary):'Insufficient verified observations for a comparison.'}</p>
     <small>{category==='solar'?'Daily NASA POWER solar estimates, not panel output.':'Daily NASA POWER corrected rainfall estimates (NOT GPM).'} No forecast or seasonal anomaly is implied.</small>
    </section>
    <section className={styles.findings}><p className={styles.eyebrow}>WHAT WE CAN VERIFY</p><h3>Evidence, not guesses</h3>
     {category==='farm'&&<><Finding title="Rainfall trend" detail={rainfallReady?rainfallInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Irrigation and crop stress" detail={`NASA SMAP: ${sourceState('smap')}. ECOSTRESS: ${sourceState('ecostress')}. Granule discovery does not measure conditions in an individual field.`}/></>}
     {category==='land'&&<><Finding title="Satellite image catalogues" detail={`Sentinel-1: ${scenes.sentinel1?.length??0}; Sentinel-2: ${scenes.sentinel2?.length??0} recent scenes. Scene counts are not land-use changes.`}/><Finding title="Land history analysis" detail="No verified land-cover classification or historic waterbody comparison is available yet."/></>}
     {category==='water'&&<><Finding title="Rainfall comparison" detail={rainfallReady?rainfallInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Regional soil-moisture source" detail={`SMAP: ${sourceState('smap')}. Available acquisition records: ${scienceScenes.smap?.length??0}. No extracted soil-moisture values yet.`}/></>}
     {category==='solar'&&<><Finding title="Observed sunlight" detail={solarReady?solarInsight.explanation:'Not enough validated daily history yet.'}/><Finding title="Site-specific savings" detail="Roof orientation, shadows, panel efficiency, weather and tariff information are required before any yield or savings calculation."/></>}
     {category==='city'&&<><Finding title="Thermal observations" detail={fireInsight.explanation}/><Finding title="Urban environment" detail={`Landsat: ${scienceScenes.landsat?.length??0} recent scenes; Black Marble: ${scienceScenes.blackmarble?.length??0} granules. No processed heat or nightlight intensity values yet.`}/></>}
     <div className={styles.pending}><strong>Analysis still needed</strong><p>{current.needs.join(' · ')}</p><small>Requires validated raster processing. Not presented as operational.</small></div>
    </section>
   </div>
  </section>
  <section className={styles.moreEvidence}><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>EXPLORE VERIFIED SOURCES</p><h2>What the satellites can currently show</h2></div></div>
   <div className={styles.evidenceGrid}>
    <article><span>01</span><h3>Weather & sunlight</h3><p>NASA POWER rainfall and solar daily estimates for eight cities.</p><strong>{power?.lastSuccessAt?'Last refresh: '+date(power.lastSuccessAt):'Refresh status unavailable'}</strong></article>
    <article><span>02</span><h3>Earth-observation catalogues</h3><p>Sentinel scenes and NASA/USGS acquisition metadata. Not computed scientific measurements.</p><strong>{Object.values(scenes).reduce((n,a)=>n+a.length,0)} Sentinel scene records</strong></article>
    <article><span>03</span><h3>Environmental reports</h3><p>FIRMS anomalies, EONET natural-event metadata and USGS earthquake reports (not an emergency alert).</p><strong>{earthquakes.length} recent USGS reports · {naturalEvents.length} natural-event records</strong></article>
   </div>
  </section>
  <details className={styles.mapDisclosure}><summary><span><strong>Explore the Pakistan observation map</strong><small>Optional geographic context · NASA imagery and rainfall overlays</small></span><span>Open map</span></summary><div className={styles.mapBody}><p>Map markers represent regional observations, not precise property assessments. Thermal anomalies are not confirmed fires.</p><iframe ref={mapFrame} className={styles.map} title="Fixed Pakistan science overlays map" src="/satellite-map.html" loading="lazy" onLoad={postMap}/></div></details>
  <details className={styles.sourceDisclosure}><summary><span><strong>Data source transparency</strong><small>Provider status, recent acquisitions, and original observation dates</small></span><span>View sources</span></summary>
   <div className={styles.sourceBody}><p>Copernicus scene catalogue entries are not flood extent, NDVI crop health or pollutant concentration measurements. NASA EONET is not an emergency alert.</p><div className={styles.sourceGrid}>{providers.map(p=><article key={String(p.id)}><strong>{String(p.label)}</strong><span>{p.available?'Recently refreshed':!p.implemented?'Not implemented':!p.enabled?'Ingestion disabled':p.refreshQueued?'Refresh queued':'Awaiting first successful ingestion'}</span><small>Last success: {date(p.lastSuccessAt)}</small></article>)}</div><h3>Acquisition records</h3><div className={styles.sourceGrid}>{(['landsat','ecostress','smap','blackmarble'] as const).map(id=><article key={id}><strong>{({landsat:'Landsat',ecostress:'ECOSTRESS',smap:'SMAP',blackmarble:'Black Marble'} as const)[id]}</strong><span>{scienceScenes[id]?.length??0} recent acquisitions</span><small>{date(scienceScenes[id]?.[0]?.observedAt)}</small></article>)}</div><p>NASA GIBS imagery: {imagery.length?'Available':'Unavailable'} · GPM imagery: {gpmImagery.length?'Available':'Unavailable'}. Neither is a quantitative district rainfall measurement.</p></div>
  </details>
  <p className={styles.disclaimer}>Satellite and modeled regional observations can be incomplete or delayed. No output is an emergency alert, field diagnosis, property guarantee or financial forecast. For emergencies, follow relevant Pakistani authorities.</p>
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
