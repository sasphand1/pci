// Strict allowlist; no remote URL or executable provider configuration from the admin UI.
export const PROVIDERS = Object.freeze({
 firms:{label:'NASA FIRMS fire / heat hotspots (VIIRS)',kind:'fire',implemented:true,auth:'NASA_FIRMS_MAP_KEY',minMinutes:180},
 power:{label:'NASA POWER daily rainfall and sunlight',kind:'rainfall,solar',implemented:true,auth:null,minMinutes:1440},
 eonet:{label:'NASA EONET natural events',kind:'natural_event',implemented:true,auth:null,minMinutes:360},
 usgs:{label:'USGS earthquake reports (not early warning)',kind:'earthquake',implemented:true,auth:null,minMinutes:60},
 gibs:{label:'NASA GIBS map layers (true colour, night lights, dust, snow)',kind:'imagery',implemented:true,auth:null,minMinutes:1440},
 gpm:{label:'NASA GPM IMERG rain map (imagery only)',kind:'rainfall imagery',implemented:true,auth:null,minMinutes:360},
 airquality:{label:'Copernicus CAMS air quality, PM2.5 and PM10 (ADS, via Satify Hub)',kind:'air_quality',implemented:true,auth:'COPERNICUS_ADS_KEY',minMinutes:60},
 weather:{label:'MET Norway weather and 7-day forecast',kind:'weather',implemented:true,auth:null,minMinutes:180},
 flood:{label:'GloFAS river flow forecast (Copernicus EWDS, via Satify Hub)',kind:'river_flow',implemented:true,auth:'COPERNICUS_EWDS_KEY',minMinutes:1440},
 gdacs:{label:'GDACS disaster alerts (UN / EC)',kind:'disaster_alert',implemented:true,auth:null,minMinutes:60},
 swpc:{label:'NOAA SWPC space weather (Kp index)',kind:'space_weather',implemented:true,auth:null,minMinutes:180},
 celestrak:{label:'CelesTrak orbits (ISS, Tiangong and other stations)',kind:'orbit',implemented:true,auth:null,minMinutes:360},
 openaq:{label:'OpenAQ ground air-quality stations',kind:'aq_station',implemented:true,auth:'OPENAQ_API_KEY',minMinutes:60}
});
export const CITIES=Object.freeze({lahore:[74.3587,31.5204],karachi:[67.0099,24.8615],islamabad:[73.0479,33.6844],peshawar:[71.5249,34.0151],quetta:[67.0011,30.1798],multan:[71.5249,30.1575],faisalabad:[73.1350,31.4504],hyderabad:[68.3578,25.3960]});
export function validateProvider(id){return Object.hasOwn(PROVIDERS,id)}
export function parseFirmsCsv(input){const lines=input.trim().split(/\r?\n/);if(lines.length<2)return [];
 const heads=parseCsvLine(lines[0]);const required=['latitude','longitude','acq_date','acq_time','confidence'];if(required.some(k=>!heads.includes(k)))throw Error('FIRMS CSV missing mandatory columns');
 return lines.slice(1).filter(Boolean).slice(0,20000).map(line=>{const cells=parseCsvLine(line);const o=Object.fromEntries(heads.map((k,i)=>[k,cells[i]??''])); const lat=Number(o.latitude),lon=Number(o.longitude);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<23||lat>38||lon<60||lon>78)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(o.acq_date)||!/^\d{1,4}$/.test(o.acq_time))return null;
 const iso=`${o.acq_date}T${String(o.acq_time).padStart(4,'0').slice(0,2)}:${String(o.acq_time).padStart(4,'0').slice(2)}:00Z`;
 if(!Number.isFinite(Date.parse(iso)))return null;
 return {location:'bounding-box',observationKey:`${lat.toFixed(4)},${lon.toFixed(4)}`,observedAt:iso,payload:{latitude:lat,longitude:lon,confidence:String(o.confidence).slice(0,20),satellite:String(o.satellite||'').slice(0,30),instrument:String(o.instrument||'VIIRS').slice(0,30),source:'NASA FIRMS',status:'thermal_anomaly_not_verified_fire'}};
 }).filter(Boolean);
}
function parseCsvLine(line){const out=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){out.push(value);value='';}else value+=c;}out.push(value);return out;}
export function parsePower(body,location){const parameters=body?.properties?.parameter;if(!parameters||!Object.hasOwn(CITIES,location))throw Error('NASA POWER response missing parameters');
 const rainfall=parameters.PRECTOTCORR,solar=parameters.ALLSKY_SFC_SW_DWN;if(!rainfall||!solar)throw Error('NASA POWER response missing requested series');
 const result=[];for(const [day,rain] of Object.entries(rainfall)){
 if(!/^\d{8}$/.test(day))continue;const sun=solar[day] == null || solar[day] === '' ? NaN : Number(solar[day]);const precip=rain == null || rain === '' ? NaN : Number(rain);
 const observedAt=`${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6,8)}T00:00:00Z`;
 if(Number.isFinite(precip)&&precip>=0&&precip<900)result.push({metric:'rainfall',location,observationKey:location,observedAt,payload:{value:precip,unit:'mm/day',source:'NASA POWER PRECTOTCORR',kind:'daily_model_corrected_estimate',notGpm:true}});
 if(Number.isFinite(sun)&&sun>=0&&sun<100)result.push({metric:'solar',location,observationKey:location,observedAt,payload:{value:sun,unit:'kWh/m²/day',source:'NASA POWER ALLSKY_SFC_SW_DWN',kind:'daily_satellite_derived_estimate'}});
 }return result;
}
