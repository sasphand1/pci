/** Read-only discovery of real satellite granule/scene metadata. No inferred raster measurements.
 * All remote hosts, dataset IDs, and the Pakistan region are fixed in source code. */
export const SCIENCE_DATASETS=Object.freeze({
 landsat:{source:'USGS LandsatLook STAC',collection:'landsat-c2l2-st',kind:'surface_temperature_scene_only'},
 ecostress:{source:'NASA Earthdata CMR',shortName:'ECO_L4T_ESI',kind:'evaporative_stress_granule_only'},
 smap:{source:'NASA Earthdata CMR',shortName:'SPL3SMP_E',kind:'soil_moisture_granule_only'},
 blackmarble:{source:'NASA Earthdata CMR',shortName:'VNP46A2',kind:'nightlight_granule_only'}
});
const BBOX='60,23,78,38';
export function discoveryUrl(id,now=new Date()){
 const ds=SCIENCE_DATASETS[id];if(!ds)throw Error('Unapproved science dataset');
 if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))throw Error('Invalid date');
 const since=new Date(now.valueOf()-30*86400000).toISOString();
 if(id==='landsat'){
  const u=new URL('https://landsatlook.usgs.gov/stac-server/collections/landsat-c2l2-st/items');
  u.searchParams.set('bbox',BBOX);u.searchParams.set('datetime',since+'/'+now.toISOString());u.searchParams.set('limit','30');return u.toString();
 }
 const u=new URL('https://cmr.earthdata.nasa.gov/search/granules.json');
 u.searchParams.set('short_name',ds.shortName);u.searchParams.set('bounding_box',BBOX);u.searchParams.set('temporal',since+','+now.toISOString());
 u.searchParams.set('page_size','30');u.searchParams.set('sort_key','-start_date');return u.toString();
}
function withinTime(s,now){const n=Date.parse(s);return Number.isFinite(n)&&n<=now+86400000&&n>=now-35*86400000;}
function safeId(s){return typeof s==='string'&&s.length>0&&s.length<=240&&/^[\w.:-]+$/.test(s);}
export function parseDiscovery(id,data,now=Date.now()){
 const ds=SCIENCE_DATASETS[id];if(!ds)throw Error('Unsupported science provider');
 const rows=id==='landsat'?data?.features:data?.feed?.entry;
 if(!Array.isArray(rows))throw Error('Malformed satellite discovery response');
 const result=[];
 for(const entry of rows.slice(0,30)){
  const itemId=id==='landsat'?entry?.id:entry?.id;
  const acquired=id==='landsat'?(entry?.properties?.datetime??entry?.properties?.start_datetime):entry?.time_start;
  if(!safeId(itemId)||typeof acquired!=='string'||!withinTime(acquired,now))continue;
  if(id==='landsat'&&(entry?.type!=='Feature'||!Array.isArray(entry.bbox)||entry.bbox.length<4))continue;
  // CMR search itself applies bounding_box; footprints are not reported as regional measurements.
  result.push({metric:'science_scene',location:'bounding-box',observationKey:itemId,observedAt:new Date(acquired).toISOString(),payload:{productId:itemId,dataset:ds.shortName??ds.collection,source:ds.source,kind:ds.kind,provider:id,derivedAnalysisAvailable:false,provenance:'catalogue_record_only',scientificMeasurement:null}});
 }
 return result;
}
