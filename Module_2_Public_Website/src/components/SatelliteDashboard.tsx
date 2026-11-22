'use client';
import {useEffect,useRef,useState} from 'react';
type Datum=Record<string,unknown>;
const API='/api/satellite';
const cityNames=['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad'];
function rows(d:unknown[]):Datum[]{return d.filter((x):x is Datum=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)));}
function shown(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-PK',{maximumFractionDigits:2}):'Not available';}
function date(v:unknown){if(typeof v!=='string')return 'Not available';const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})+' PKT':'Not available';}
export function SatelliteDashboard({sources,fires,rain,solar}:{sources:unknown[];fires:unknown[];rain:unknown[];solar:unknown[]}){
 const [city,setCity]=useState('lahore'),[rainData,setRainData]=useState(rows(rain)),[solarData,setSolarData]=useState(rows(solar));
 const [error,setError]=useState('');
 const mapFrame=useRef<HTMLIFrameElement>(null);
 const [naturalEvents,setNaturalEvents]=useState<Datum[]>([]),[imagery,setImagery]=useState<Datum[]>([]),[gpmImagery,setGpmImagery]=useState<Datum[]>([]),[scenes,setScenes]=useState<Record<string,Datum[]>>({});
 useEffect(()=>{let active=true;const filters=['natural-events','imagery','gpm-imagery','scenes&mission=sentinel1','scenes&mission=sentinel2','scenes&mission=sentinel5p'];
 Promise.allSettled(filters.map(async f=>{const resp=await fetch(`${API}?metric=${f}`,{signal:AbortSignal.timeout(8000)});if(!resp.ok)throw Error('Source unavailable');return rows((await resp.json()).data??[])})).then(results=>{if(!active)return;
 const value=(i:number)=>{const result=results[i];return result?.status==='fulfilled'?result.value:[];};
 setNaturalEvents(value(0));setImagery(value(1));setGpmImagery(value(2));setScenes({sentinel1:value(3),sentinel2:value(4),sentinel5p:value(5)});});
 return()=>{active=false;};},[]);
 useEffect(()=>{let active=true;setError('');if(city==='lahore'){setRainData(rows(rain));setSolarData(rows(solar));return;}
 Promise.all(['rainfall','solar'].map(async metric=>{const response=await fetch(`${API}?metric=${encodeURIComponent(metric)}&city=${encodeURIComponent(city)}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Data service unavailable');return rows((await response.json()).data??[]);})).then(([r,s])=>{if(active){setRainData(r);setSolarData(s);}}).catch(()=>{if(active){setError('Unable to retrieve city observations.');setRainData([]);setSolarData([]);}});return()=>{active=false;};},[city,rain,solar]);
 const providers=rows(sources),fireRows=rows(fires);const power=providers.find(p=>p.id==='power');const latestRain=rainData[0],latestSolar=solarData[0];
 const postMap=()=>{const points=fireRows.filter(p=>typeof p.latitude==='number'&&typeof p.longitude==='number'&&Number.isFinite(p.latitude)&&Number.isFinite(p.longitude)&&p.latitude>=23&&p.latitude<=38&&p.longitude>=60&&p.longitude<=78).slice(0,200).map(p=>({latitude:p.latitude,longitude:p.longitude,observedAt:typeof p.observedAt==='string'?p.observedAt:null}));
 const events=naturalEvents.filter(e=>typeof e.latitude==='number'&&typeof e.longitude==='number').slice(0,100).map(e=>({latitude:e.latitude,longitude:e.longitude,title:typeof e.title==='string'?e.title:'Natural event'}));
 mapFrame.current?.contentWindow?.postMessage({type:'PCI_SATELLITE_POINTS_V1',points,events,imagery:imagery[0]?.tileTemplate,gpmImagery:gpmImagery[0]?.tileTemplate},window.location.origin);};
 useEffect(()=>{postMap();},[naturalEvents,imagery,gpmImagery]);

 return <div className="satellite-dashboard">
  {providers.length===0&&<p className="satellite-notice" role="status">Satellite API unavailable or provider catalogue not loaded. Check Module 1 deployment and database migration.</p>}
  {power?.enabled===false&&<p className="satellite-notice" role="status">NASA POWER ingestion is disabled. Enable it in PCI Management → Satellite APIs.</p>}
  {power?.refreshQueued===true&&<p className="satellite-notice" role="status">NASA POWER refresh queued. Processing is handled by the existing PCI worker.</p>}
  {power?.enabled===true&&power?.refreshQueued!==true&&power?.lastSuccessAt==null&&<p className="satellite-notice" role="status">NASA POWER has not completed a successful ingestion. Check the management panel for its last error.</p>}

  <section className="satellite-controls"><label htmlFor="satellite-city">Select city</label><select id="satellite-city" value={city} onChange={e=>setCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select><span>City values are satellite-derived / modeled regional estimates, not street measurements.</span></section>
  {error&&<p role="alert">{error}</p>}
  <div className="satellite-cards"><article className="card"><h2>Rainfall estimate</h2><strong>{shown(latestRain?.value)} {latestRain?.value==null?'':'mm/day'}</strong><p>NASA POWER daily corrected precipitation — NOT GPM or a live rain gauge.</p><small>Observed: {date(latestRain?.observedAt)}</small></article>
   <article className="card"><h2>Solar resource</h2><strong>{shown(latestSolar?.value)} {latestSolar?.value==null?'':'kWh/m²/day'}</strong><p>NASA POWER daily satellite-derived solar estimate.</p><small>Observed: {date(latestSolar?.observedAt)}</small></article>
   <article className="card"><h2>Thermal hotspots</h2><strong>{fireRows.length?String(fireRows.length):'No current records'}</strong><p>NASA FIRMS latest stored detections (up to 100 shown). Thermal anomalies are not confirmed fires.</p><small>Latest: {date(fireRows[0]?.observedAt)}</small></article></div>
  <section className="card satellite-geo"><h2>Recent thermal detections · Pakistan region</h2><p>The dots show georeferenced NASA FIRMS detections in a longitude/latitude bounding rectangle, not a national boundary map. Pakistan-border filtering is not yet implemented.</p>
   <iframe ref={mapFrame} className="satellite-map-frame" title="Pakistan regional satellite fire and natural events map" src="/satellite-map.html" loading="lazy" onLoad={postMap} /></section>
  <section className="card satellite-feed-details" aria-label="Additional satellite intelligence">
   <h2>NASA natural events · Pakistan region</h2>
   <p>NASA EONET event metadata (not an emergency alert). Only events with a point geometry within the region are shown.</p>
   {naturalEvents.length?<ul>{naturalEvents.slice(0,8).map((e,i)=><li key={i}><strong>{String(e.title??'Natural event')}</strong> · {date(e.observedAt)}</li>)}</ul>:<p>No regional point events in the latest published feed, or feed disabled.</p>}
   <h2>Copernicus scene discovery</h2>
   <p>Satellite scene catalogue entries are not flood extent, NDVI crop health or pollutant concentration measurements.</p>
   <div className="satellite-scene-grid">{(['sentinel1','sentinel2','sentinel5p'] as const).map(mission=><div key={mission}><h3>{mission.replace('sentinel','Sentinel-')}</h3><strong>{scenes[mission]?.length??0} recent scenes</strong><small>Latest: {date(scenes[mission]?.[0]?.observedAt)}</small></div>)}</div>
   <p>NASA GIBS: {imagery.length?'Satellite imagery available in map.':'Satellite imagery inactive or unavailable.'} NASA GPM IMERG: {gpmImagery.length?'Visualized precipitation-rate layer available in map.':'Precipitation imagery inactive or unavailable.'} Neither map layer is a district rainfall measurement.</p>
  </section>
  <section className="card satellite-source-list"><h2>Data sources and availability</h2><p>Disabled and unimplemented sources are never presented as operational. Missing data is not zero.</p><div className="satellite-source-grid">{providers.map(p=><div key={String(p.id)}><strong>{String(p.label)}</strong><span>{p.available?'Enabled · recently refreshed':!p.implemented?'Connector not implemented':!p.enabled?'Disabled by administrator':p.refreshQueued?'Refresh queued':'Enabled · awaiting successful retrieval'}</span><small>Last attempted: {date(p.lastAttemptAt)} · Last succeeded: {date(p.lastSuccessAt)}</small></div>)}</div></section>
  <p className="satellite-disclaimer">Sources: NASA FIRMS, NASA POWER, NASA EONET, NASA GIBS, Copernicus catalogue. Observations may be delayed, incomplete or inaccurate. For emergency information, follow the Pakistan Meteorological Department and relevant disaster authorities. API results are public estimates, not official forecasts.</p>
 </div>;
}
