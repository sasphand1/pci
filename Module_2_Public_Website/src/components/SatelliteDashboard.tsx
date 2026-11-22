'use client';
import {useEffect,useRef,useState} from 'react';
import {compareDailySeries, summarizeThermalDetections} from '@/lib/satelliteScience.mjs';
type Datum=Record<string,unknown>;
const API='/api/satellite';
const cityNames=['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad'];
const scienceCategories=[
 {id:'agriculture',title:'Agriculture',audience:'Farmers and agricultural researchers',description:'Field condition, irrigation variability and crop recovery. Verified field-level assessments require cloud-masked imagery and field boundaries.',layers:'Daily regional rainfall and solar context are available now. Crop-stress, irrigation and harvest models are not yet operational.',needs:['Vegetation health','Irrigation variability','Crop recovery','Thermal activity']},
 {id:'land',title:'Land',audience:'Land buyers and property owners',description:'Review land-cover history and investigate changes before a major land decision.',layers:'NASA imagery is available when the imagery provider returns a valid tile layer. Historical land-cover and former-waterbody analysis are not yet operational.',needs:['Land history','Built-up change','Historical water extent','Vegetation loss']},
 {id:'water',title:'Water',audience:'Farmers, residents and water planners',description:'Inspect precipitation imagery and regional rainfall, then explore waterbody change when processing becomes available.',layers:'IMERG rainfall imagery is a visualization, not a field-scale flood or soil-water measurement.',needs:['Rainfall context','Waterbody change','Inundation history','Catchment analysis']},
 {id:'energy',title:'Energy',audience:'Households and solar installers',description:'Compare satellite-derived solar resource estimates; site-specific solar yield requires installation information.',layers:'Daily NASA POWER solar irradiation estimates are available for the selected city.',needs:['Solar resource','Seasonal solar patterns','Performance screening','Night lights']},
 {id:'environment',title:'Environment',audience:'Residents, scientists and conservation groups',description:'Inspect satellite thermal anomalies and natural event evidence without treating detections as confirmed impacts.',layers:'NASA FIRMS thermal anomalies and NASA EONET metadata are available when observations exist.',needs:['Thermal anomalies','Vegetation recovery','Atmospheric products','Snow changes']},
 {id:'cities',title:'Cities',audience:'Residents, architects and city planners',description:'Understand the physical transformation of urban places, including surfaces, vegetation and heat.',layers:'NASA imagery can be viewed now. Built-up change, vegetation loss and urban heat measurements require additional processing.',needs:['Urban expansion','Tree-cover deficit','Surface heat','Neighborhood history']},
 {id:'disasters',title:'Disasters',audience:'Communities, agencies and researchers',description:'View observational context around reported environmental incidents; not a real-time warning service.',layers:'Thermal anomalies, NASA natural events and rainfall imagery may be displayed. Flood extent, damage and recovery claims are not yet calculated.',needs:['Thermal detections','Natural events','Precipitation imagery','Recovery evidence']},
 {id:'discover',title:'Discover',audience:'Everyone',description:'Explore Pakistan through currently available satellite observations, with clear uncertainty and original sources.',layers:'Combines available imagery, thermal anomalies, natural events and rainfall overlays.',needs:['Satellite imagery','Thermal anomaly map','Natural-event records','Science discoveries']}
] as const;
type ScienceCategory=(typeof scienceCategories)[number]['id'];

function rows(d:unknown[]):Datum[]{return d.filter((x):x is Datum=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)));}
function shown(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-PK',{maximumFractionDigits:2}):'Not available';}
function date(v:unknown){if(typeof v!=='string')return 'Not available';const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})+' PKT':'Not available';}
export function SatelliteDashboard({sources,fires,rain,solar}:{sources:unknown[];fires:unknown[];rain:unknown[];solar:unknown[]}){
 const [city,setCity]=useState('lahore'),[rainData,setRainData]=useState(rows(rain)),[solarData,setSolarData]=useState(rows(solar));
 const [error,setError]=useState('');
 const [category,setCategory]=useState<ScienceCategory>('agriculture');
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
 mapFrame.current?.contentWindow?.postMessage({type:'PCI_SATELLITE_POINTS_V1',points,events,imagery:imagery[0]?.tileTemplate,gpmImagery:gpmImagery[0]?.tileTemplate,category},window.location.origin);};
 useEffect(()=>{postMap();},[naturalEvents,imagery,gpmImagery,category,fires]);

 return <div className="satellite-dashboard">
  {providers.length===0&&<p className="satellite-notice" role="status">Satellite API unavailable or provider catalogue not loaded. Check Module 1 deployment and database migration.</p>}
  {power?.enabled===false&&<p className="satellite-notice" role="status">NASA POWER ingestion is disabled. Enable it in PCI Management → Satellite APIs.</p>}
  {power?.refreshQueued===true&&<p className="satellite-notice" role="status">NASA POWER refresh queued. Processing is handled by the existing PCI worker.</p>}
  {power?.enabled===true&&power?.refreshQueued!==true&&power?.lastSuccessAt==null&&<p className="satellite-notice" role="status">NASA POWER has not completed a successful ingestion. Check the management panel for its last error.</p>}

  <nav className="pci-science-tabs" aria-label="Satellite science categories">
   {scienceCategories.map(c=><button key={c.id} type="button" className={category===c.id?'pci-science-tab is-active':'pci-science-tab'} aria-pressed={category===c.id} onClick={()=>setCategory(c.id)}>{c.title}</button>)}
  </nav>
  <section className="card pci-science-intro" aria-live="polite"><h2>{selectedCategory.title} intelligence</h2><p>{selectedCategory.description}</p><small>For: {selectedCategory.audience}</small></section>
  <section className="card satellite-geo"><h2>Pakistan satellite observation map</h2><p>Fixed Pakistan overview. Categories change the visible verified data overlays; map zoom, pan and rotation are disabled.</p>{fireRows.length>0?<p>Dots represent NASA FIRMS thermal anomalies from the last 3 days, not confirmed fires. The bounding rectangle includes land outside Pakistan.</p>:<p>{providers.some(p=>p.id==='firms'&&p.enabled&&p.lastSuccessAt)?'No thermal detections are currently stored for this region. Explore NASA imagery and rainfall layers on the map.':'FIRMS hotspot ingestion is not yet available. Explore NASA imagery and rainfall layers on the map.'}</p>}
   <iframe ref={mapFrame} className="satellite-map-frame" title="Fixed Pakistan science overlays map" src="/satellite-map.html" loading="lazy" onLoad={postMap} /></section>
  <section className="satellite-controls"><label htmlFor="satellite-city">Select city</label><select id="satellite-city" value={city} onChange={e=>setCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select><span>City values are satellite-derived / modeled regional estimates, not street measurements.</span></section>
  {error&&<p role="alert">{error}</p>}
  <div className="satellite-cards"><article className="card"><h2>Rainfall estimate</h2><strong>{shown(latestRain?.value)} {latestRain?.value==null?'':'mm/day'}</strong><p>NASA POWER daily corrected precipitation — NOT GPM or a live rain gauge.</p><small>Observed: {date(latestRain?.observedAt)}</small></article>
   <article className="card"><h2>Solar resource</h2><strong>{shown(latestSolar?.value)} {latestSolar?.value==null?'':'kWh/m²/day'}</strong><p>NASA POWER daily satellite-derived solar estimate.</p><small>Observed: {date(latestSolar?.observedAt)}</small></article>
   {fireRows.length>0&&<article className="card"><h2>Thermal hotspots (last 3 days)</h2><strong>{String(fireRows.length)} shown</strong><p>NASA FIRMS VIIRS thermal detections (up to 100). These are not confirmed fires.</p><small>Latest: {date(fireRows[0]?.observedAt)}</small></article>}</div>
  <section className="card pci-science-analysis" aria-live="polite">
   <h2>{selectedCategory.title}: scientific findings</h2>
   <p>{selectedCategory.layers}</p>
   <div className="pci-science-finding-grid">
    {(category==='agriculture'||category==='water'||category==='energy'||category==='discover')&&<article className="pci-science-finding"><h3>Rainfall · 30-day observation comparison</h3><strong>{historyStatus==='loading'?'Checking observations':rainfallInsight.status==='ready'?rainfallInsight.summary:'Not enough verified history'}</strong><p>{rainfallInsight.explanation}</p><small>NASA POWER corrected daily precipitation (NOT GPM). {rainfallInsight.days} valid days; not a forecast or field measurement.</small></article>}
    {(category==='energy'||category==='agriculture'||category==='discover')&&<article className="pci-science-finding"><h3>Solar resource · 30-day observation comparison</h3><strong>{solarInsight.status==='ready'?solarInsight.summary:'Not enough verified history'}</strong><p>{solarInsight.explanation}</p><small>NASA POWER regional solar estimate. {solarInsight.days} valid days; not rooftop power generation.</small></article>}
    {(category==='agriculture'||category==='environment'||category==='disasters'||category==='discover')&&<article className="pci-science-finding"><h3>Regional thermal detections</h3><strong>{fireInsight.count} observations in available feed</strong><p>{fireInsight.explanation}</p><small>NASA FIRMS; bounded regional sample, NOT a nationwide fire count.</small></article>}
    {(category==='disasters'||category==='discover')&&<article className="pci-science-finding"><h3>Recent reported earthquakes</h3><strong>{earthquakes.length?earthquakes.length+' USGS events in the available feed':'No current USGS report available'}</strong><p>{earthquakes.length?'Most recent: M '+String(earthquakes[0]?.magnitude??'?')+' · '+String(earthquakes[0]?.place??'Unknown'):'The source may be disabled or unavailable. Missing reports do not mean there were no earthquakes.'}</p><small>USGS catalog. Not an early warning, prediction or official local shaking assessment. Events may occur in neighboring countries.</small></article>}
    {(category==='environment'||category==='disasters'||category==='discover')&&<article className="pci-science-finding"><h3>NASA natural-event records</h3><strong>{naturalEvents.length} records in available feed</strong><p>Event metadata is observational context, not an official alert or confirmed local impact.</p></article>}
    {(category==='land'||category==='cities'||category==='water'||category==='disasters'||category==='agriculture')&&<article className="pci-science-finding"><h3>Scientific processing status</h3><strong>Advanced analysis not yet available</strong><p>Verified vegetation indices, flood-extent maps, built-up changes and land-cover assessments require calibrated raster processing. Scene catalogue entries do not provide these measurements.</p></article>}
   </div>
   <h3>Planned decision products</h3><div className="pci-science-chips">{selectedCategory.needs.map(n=><span key={n}>{n} · planned</span>)}</div>
   <small>{historyStatus==='unavailable'?'Historical observations currently unavailable. No extrapolation has been performed.':'Scientific findings use only available observations and must not be used as emergency or financial guarantees.'}</small>
  </section>
  <section className="card satellite-feed-details" aria-label="Additional satellite intelligence">
   <h2>NASA natural events · Pakistan region</h2>
   <p>NASA EONET event metadata (not an emergency alert). Only events with a point geometry within the region are shown.</p>
   {naturalEvents.length?<ul>{naturalEvents.slice(0,8).map((e,i)=><li key={i}><strong>{String(e.title??'Natural event')}</strong> · {date(e.observedAt)}</li>)}</ul>:<p>No regional point events in the latest published feed, or feed disabled.</p>}
   <h2>Additional Earth science acquisition records</h2>
   <p>These counts indicate recently discoverable NASA/USGS granules or scenes, not processed soil moisture, surface temperature, water stress or nighttime brightness.</p>
   <div className="satellite-scene-grid">{(['landsat','ecostress','smap','blackmarble'] as const).map(id=><div key={id}><h3>{({landsat:'Landsat thermal',ecostress:'ECOSTRESS',smap:'SMAP',blackmarble:'Black Marble'} as const)[id]}</h3><strong>{scienceScenes[id]?.length??0} recent acquisitions</strong><small>Most recent: {date(scienceScenes[id]?.[0]?.observedAt)}</small></div>)}</div>
   <h2>Copernicus scene discovery</h2>
   <p>Satellite scene catalogue entries are not flood extent, NDVI crop health or pollutant concentration measurements.</p>
   <div className="satellite-scene-grid">{(['sentinel1','sentinel2','sentinel5p'] as const).map(mission=><div key={mission}><h3>{mission.replace('sentinel','Sentinel-')}</h3><strong>{scenes[mission]?.length??0} recent scenes</strong><small>Latest: {date(scenes[mission]?.[0]?.observedAt)}</small></div>)}</div>
   <p>NASA GIBS: {imagery.length?'Satellite imagery available in map.':'Satellite imagery inactive or unavailable.'} NASA GPM IMERG: {gpmImagery.length?'Visualized precipitation-rate layer available in map.':'Precipitation imagery inactive or unavailable.'} Neither map layer is a district rainfall measurement.</p>
  </section>
  <section className="card satellite-source-list"><h2>Data sources and availability</h2><p>Disabled and unimplemented sources are never presented as operational. Missing data is not zero.</p><div className="satellite-source-grid">{providers.map(p=><div key={String(p.id)}><strong>{String(p.label)}</strong><span>{p.available?'Enabled · recently refreshed':!p.implemented?'Connector not implemented':!p.enabled?'Disabled by administrator':p.refreshQueued?'Refresh queued':'Enabled · awaiting successful retrieval'}</span><small>Last attempted: {date(p.lastAttemptAt)} · Last succeeded: {date(p.lastSuccessAt)}</small></div>)}</div></section>
  <p className="satellite-disclaimer">Sources: NASA FIRMS, NASA POWER, NASA EONET, NASA GIBS, Copernicus catalogue. Observations may be delayed, incomplete or inaccurate. For emergency information, follow the Pakistan Meteorological Department and relevant disaster authorities. API results are public estimates, not official forecasts.</p>
 </div>;
}
