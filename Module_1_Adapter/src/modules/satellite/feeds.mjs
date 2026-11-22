/** Provider-specific, deterministic validation. Never infer impacts from catalogue metadata. */
export const PAKISTAN_BBOX = Object.freeze([60, 23, 78, 38]);
export const COPERNICUS_IDS = Object.freeze({sentinel1:'SENTINEL-1',sentinel2:'SENTINEL-2',sentinel5p:'SENTINEL-5P'});
export const GIBS_LAYER = 'MODIS_Terra_CorrectedReflectance_TrueColor';
export function inRegion(lon,lat){return Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=60&&lon<=78&&lat>=23&&lat<=38;}
export function eonetUrl(){return 'https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=30&limit=200';}
export function copernicusUrl(id,now=new Date()){
 const collection=COPERNICUS_IDS[id];if(!collection)throw Error('Unapproved Copernicus collection');
 const from=new Date(now.valueOf()-14*86400000).toISOString().replace(/\.\d{3}Z$/,'Z');
 const polygon="POLYGON((60 23,78 23,78 38,60 38,60 23))";
 const filter=`Collection/Name eq '${collection}' and ContentDate/Start gt ${from} and OData.CSC.Intersects(area=geography'SRID=4326;${polygon}')`;
 const url=new URL('https://catalogue.dataspace.copernicus.eu/odata/v1/Products');
 url.searchParams.set('$filter',filter);url.searchParams.set('$orderby','ContentDate/Start desc');url.searchParams.set('$top','30');url.searchParams.set('$select','Id,Name,ContentDate,GeoFootprint');
 return url.toString();
}
export function parseEonet(body){
 if(!body||!Array.isArray(body.events))throw Error('Malformed NASA EONET response');
 const out=[];
 for(const event of body.events.slice(0,200)){
  if(typeof event?.id!=='string'||typeof event?.title!=='string'||!Array.isArray(event.geometry))continue;
  // Only Point geometries. Polygons must not be reduced to misleading point locations.
  for(const geo of event.geometry.slice(-5)){
   if(geo?.type!=='Point'||!Array.isArray(geo.coordinates)||geo.coordinates.length!==2)continue;
   const [longitude,latitude]=geo.coordinates;if(!inRegion(longitude,latitude))continue;
   if(typeof geo.date!=='string'||!Number.isFinite(Date.parse(geo.date)))continue;
   const categories=Array.isArray(event.categories)?event.categories.map(c=>String(c?.title||'')).filter(Boolean).slice(0,3):[];
   out.push({metric:'natural_event',location:'bounding-box',observationKey:`${event.id}:${geo.date}`,observedAt:geo.date,payload:{eventId:event.id,title:event.title.slice(0,200),latitude,longitude,categories,source:'NASA EONET',status:'curated_event_metadata_not_hazard_warning'}});
  }
 }
 return out;
}
export function parseCopernicus(body,id){
 if(!COPERNICUS_IDS[id]||!body||!Array.isArray(body.value))throw Error('Malformed Copernicus catalogue response');
 const out=[];
 for(const row of body.value.slice(0,30)){
  const observedAt=row?.ContentDate?.Start;
  if(typeof row?.Id!=='string'||typeof row?.Name!=='string'||typeof observedAt!=='string'||!Number.isFinite(Date.parse(observedAt)))continue;
  // Query already constrains geographic intersection. Retain footprint for provenance only;
  // no invented flood, vegetation, or atmospheric concentration measurements.
  const footprint=row.GeoFootprint&&typeof row.GeoFootprint==='object'?row.GeoFootprint:null;
  out.push({metric:'scene',location:'bounding-box',observationKey:row.Id,observedAt,payload:{productId:row.Id,name:row.Name.slice(0,240),mission:id,source:'Copernicus Data Space OData',footprint,kind:'scene_catalogue_only',derivedAnalysisAvailable:false}});
 }
 return out;
}
export function gibsTileURL(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z')))throw Error('Invalid imagery date');
 return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${day}/GoogleMapsCompatible_Level9/4/6/11.jpg`;
}
export function gibsDisplayTemplate(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Invalid imagery date');
 return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${day}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

export function gpmWmsURL(day,templated=false){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T00:00:00Z')))throw Error('Invalid GPM imagery date');
 const url=new URL('https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi');
 const params={SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:'IMERG_Precipitation_Rate',STYLES:'',FORMAT:'image/png',TRANSPARENT:'true',SRS:'EPSG:3857',WIDTH:'256',HEIGHT:'256',TIME:day};
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
 url.searchParams.set('BBOX',templated?'{bbox-epsg-3857}':'7347086,2753408,8595584,4001906');
 return templated?url.toString().replace('%7Bbbox-epsg-3857%7D','{bbox-epsg-3857}'):url.toString();
}
