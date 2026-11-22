'use client';
import {useEffect,useState} from 'react';
type Datum=Record<string,unknown>;
const API=(process.env.NEXT_PUBLIC_ADAPTER_API_URL||'http://localhost:8080').replace(/\/$/,'');
const cityNames=['lahore','karachi','islamabad','peshawar','quetta','multan','faisalabad','hyderabad'];
function rows(d:unknown[]):Datum[]{return d.filter((x):x is Datum=>Boolean(x&&typeof x==='object'&&!Array.isArray(x)));}
function shown(v:unknown){return typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('en-PK',{maximumFractionDigits:2}):'Not available';}
function date(v:unknown){if(typeof v!=='string')return 'Not available';const d=new Date(v);return Number.isFinite(d.valueOf())?d.toLocaleString('en-PK',{timeZone:'Asia/Karachi',dateStyle:'medium',timeStyle:'short'})+' PKT':'Not available';}
export function SatelliteDashboard({sources,fires,rain,solar}:{sources:unknown[];fires:unknown[];rain:unknown[];solar:unknown[]}){
 const [city,setCity]=useState('lahore'),[rainData,setRainData]=useState(rows(rain)),[solarData,setSolarData]=useState(rows(solar));
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;setError('');if(city==='lahore'){setRainData(rows(rain));setSolarData(rows(solar));return;}
 Promise.all(['rainfall','solar'].map(async metric=>{const response=await fetch(`${API}/api/v1/satellite/${metric}/latest?city=${encodeURIComponent(city)}`,{signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error('Data service unavailable');return rows((await response.json()).data??[]);})).then(([r,s])=>{if(active){setRainData(r);setSolarData(s);}}).catch(()=>{if(active){setError('Unable to retrieve city observations.');setRainData([]);setSolarData([]);}});return()=>{active=false;};},[city,rain,solar]);
 const providers=rows(sources),fireRows=rows(fires);const latestRain=rainData[0],latestSolar=solarData[0];
 return <div className="satellite-dashboard">
  <section className="satellite-controls"><label htmlFor="satellite-city">Select city</label><select id="satellite-city" value={city} onChange={e=>setCity(e.target.value)}>{cityNames.map(c=><option key={c} value={c}>{c[0].toUpperCase()+c.slice(1)}</option>)}</select><span>City values are satellite-derived / modeled regional estimates, not street measurements.</span></section>
  {error&&<p role="alert">{error}</p>}
  <div className="satellite-cards"><article className="card"><h2>Rainfall estimate</h2><strong>{shown(latestRain?.value)} {latestRain?.value==null?'':'mm/day'}</strong><p>NASA POWER daily corrected precipitation — NOT GPM or a live rain gauge.</p><small>Observed: {date(latestRain?.observedAt)}</small></article>
   <article className="card"><h2>Solar resource</h2><strong>{shown(latestSolar?.value)} {latestSolar?.value==null?'':'kWh/m²/day'}</strong><p>NASA POWER daily satellite-derived solar estimate.</p><small>Observed: {date(latestSolar?.observedAt)}</small></article>
   <article className="card"><h2>Thermal hotspots</h2><strong>{fireRows.length?String(fireRows.length):'No current records'}</strong><p>NASA FIRMS latest stored detections (up to 100 shown). Thermal anomalies are not confirmed fires.</p><small>Latest: {date(fireRows[0]?.observedAt)}</small></article></div>
  <section className="card satellite-geo"><h2>Recent thermal detections · Pakistan region</h2><p>The dots show georeferenced NASA FIRMS detections in a longitude/latitude bounding rectangle, not a national boundary map. Pakistan-border filtering is not yet implemented.</p>
   <svg className="satellite-plot" viewBox="0 0 600 440" role="img" aria-label="Thermal detections plotted by longitude and latitude across 60 to 78 degrees east and 23 to 38 degrees north">
    <rect x="40" y="20" width="530" height="370" className="satellite-plot-bg"/>
    {[60,66,72,78].map(lon=><g key={lon}><line x1={40+(lon-60)/18*530} y1="20" x2={40+(lon-60)/18*530} y2="390" className="satellite-plot-grid"/><text x={40+(lon-60)/18*530} y="414" className="satellite-plot-label" textAnchor="middle">{lon}°E</text></g>)}
    {[23,28,33,38].map(lat=><g key={lat}><line x1="40" y1={390-(lat-23)/15*370} x2="570" y2={390-(lat-23)/15*370} className="satellite-plot-grid"/><text x="33" y={394-(lat-23)/15*370} className="satellite-plot-label" textAnchor="end">{lat}°N</text></g>)}
    {fireRows.map((point,i)=>typeof point.latitude==='number'&&typeof point.longitude==='number'&&point.latitude>=23&&point.latitude<=38&&point.longitude>=60&&point.longitude<=78?<circle key={i} className="satellite-hotspot" cx={40+(point.longitude-60)/18*530} cy={390-(point.latitude-23)/15*370} r="3"/>:null)}
   </svg></section>
  <section className="card satellite-source-list"><h2>Data sources and availability</h2><p>Disabled and unimplemented sources are never presented as operational. Missing data is not zero.</p><div className="satellite-source-grid">{providers.map(p=><div key={String(p.id)}><strong>{String(p.label)}</strong><span>{p.available?'Available / enabled':p.implemented?'Inactive or not configured':'Connector not implemented'}</span><small>Last successful retrieval: {date(p.lastSuccessAt)}</small></div>)}</div></section>
  <p className="satellite-disclaimer">Sources: NASA FIRMS and NASA POWER. Observations may be delayed, incomplete or inaccurate. For emergency information, follow the Pakistan Meteorological Department and relevant disaster authorities. API results are public estimates, not official forecasts.</p>
 </div>;
}
