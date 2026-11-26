import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {aqiBand,RIVER_POINTS,gdacsUrl,parseGdacs,parseKp,geomagneticScale,parseCelestrak,parseOpenaqLocations,parseOpenaqLatest,openaqLatestUrl,GIBS_EXTRA_LAYERS,gibsLayerProbeUrl,gibsLayerTemplate,gibsMaxZoom} from '../src/modules/satellite/open-data.mjs';
import {buildObservationBatch} from '../src/modules/satellite/bulk.mjs';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const NOW=Date.parse('2026-11-25T12:30:00Z');

import {camsRows,cityPoints,glofasRows,usAqi,camsRequest,glofasRequest} from '../src/modules/satify/copernicus.mjs';
// Grid over Pakistan at 0.4° (like a CAMS download) with one constant value per field.
const field=(validTime,value,di=0.4)=>{const ni=Math.round(19/di)+1,nj=Math.round(15/di)+1;return {lat1:38,lon1:60,lat2:23,lon2:79,di,dj:di,ni,nj,scan:0,validTime,values:new Float64Array(ni*nj).fill(value)};};
test('air quality: Copernicus CAMS (ADS) fields become hourly rows with the next-24h peak; no Open-Meteo',()=>{
 const r=camsRequest('particulate_matter_2.5um',NOW);assert.equal(r.dataset,'cams-global-atmospheric-composition-forecasts');assert.deepEqual(r.inputs.area,[38,60,23,79]);
 const pm25=[field('2026-11-25T12:00:00Z',170e-9),field('2026-11-25T15:00:00Z',190e-9),field('2026-11-26T03:00:00Z',250e-9)];
 const pm10=[field('2026-11-25T12:00:00Z',200e-9)];
 const rows=camsRows(cityPoints(pm25),cityPoints(pm10),NOW).filter(x=>x.location==='lahore');
 assert.equal(rows.length,1);assert.equal(rows[0].observedAt,'2026-11-25T12:00:00.000Z');assert.equal(rows[0].payload.values.pm2_5,170);
 assert.equal(rows[0].payload.values.us_aqi,usAqi(170,200));assert.deepEqual(rows[0].payload.next24h,{maxUsAqi:usAqi(250,null),maxPm2_5:250});
 assert.match(rows[0].payload.source,/Copernicus CAMS/);
 assert.equal(aqiBand(210),'Very unhealthy');assert.equal(aqiBand(40),'Good');assert.equal(aqiBand(null),null);
 assert.equal(usAqi(9,null),50);assert.equal(usAqi(35.4,null),100);assert.equal(usAqi(500,null),500);
 assert.throws(()=>camsRows([],[],NOW));
});
test('river flow: GloFAS (EWDS) daily discharge, forecast peak and ratio at every river point',()=>{
 assert.ok(Object.keys(RIVER_POINTS).length>=7);
 assert.equal(glofasRequest(NOW).dataset,'cems-glofas-forecast');
 const days=[1100,1500,2400,1300].map((v,i)=>field(new Date(Date.parse('2026-11-25T00:00:00Z')+i*86400000).toISOString(),v,0.05));
 const rows=glofasRows(days,NOW);const r=rows.find(x=>x.location==='indus-sukkur');
 assert.equal(rows.length,Object.keys(RIVER_POINTS).length);assert.equal(r.payload.dischargeM3s,1100);
 assert.deepEqual(r.payload.peak30,{date:'2026-11-27',max:2400});assert.equal(r.payload.peakToTodayRatio,2.18);assert.equal(r.payload.river,'Indus');
 assert.doesNotMatch(JSON.stringify(r),/Open-Meteo/);
});
test('GDACS: Pakistan and Arabian Sea events kept, others dropped, one row per event',()=>{
 const u=new URL(gdacsUrl(new Date(NOW)));assert.equal(u.hostname,'www.gdacs.org');assert.equal(u.searchParams.get('alertlevel'),'green;orange;red');
 const f=(id,coords,extra={})=>({type:'Feature',geometry:{type:'Point',coordinates:coords},properties:{eventtype:'TC',eventid:id,episodeid:3,name:'Cyclone X',alertlevel:'Orange',alertscore:2,fromdate:'2026-11-20T00:00:00',country:'',url:{report:'https://www.gdacs.org/report.aspx?eventid='+id},...extra}});
 const out=parseGdacs({features:[f(1,[66,22]),f(1,[66,22]),f(2,[-80,20]),f(3,[120,10],{iso3:'PAK'}),{properties:{eventtype:'bad'}}]});
 assert.equal(out.length,2);assert.equal(out[0].payload.alertLevel,'Orange');assert.equal(out[0].payload.kind,'international_alert_not_ndma_instruction');assert.ok(out.some(x=>x.payload.eventId==='3'&&x.payload.affectsPakistan));
 assert.throws(()=>parseGdacs({}));
});
test('space weather: object and array formats, G-scale',()=>{
 const objs=[{time_tag:'2026-11-25T11:00:00',kp_index:2,estimated_kp:2.33},{time_tag:'2026-11-25T12:00:00',kp_index:5,estimated_kp:5.33}];
 const [k]=parseKp(objs,NOW);assert.equal(k.payload.kp,5.33);assert.equal(k.payload.scale,'G1');assert.equal(k.observedAt,'2026-11-25T12:00:00.000Z');
 const [a]=parseKp([['time_tag','Kp'],['2026-11-25 09:00:00.000','3.67']],NOW);assert.equal(a.payload.kp,3.67);assert.equal(a.payload.scale,'Quiet');
 assert.equal(geomagneticScale(9),'G5');assert.throws(()=>parseKp([],NOW));
});
test('orbits: valid OMM element sets only, ISS flagged',()=>{
 const iss={OBJECT_NAME:'ISS (ZARYA)',OBJECT_ID:'1998-067A',EPOCH:'2026-11-25T08:00:00.000',MEAN_MOTION:15.5,ECCENTRICITY:0.0004,INCLINATION:51.64,RA_OF_ASC_NODE:100,ARG_OF_PERICENTER:50,MEAN_ANOMALY:300,BSTAR:0.0002,NORAD_CAT_ID:25544};
 const out=parseCelestrak([iss,{...iss,NORAD_CAT_ID:'x'},{...iss,NORAD_CAT_ID:1,EPOCH:'2020-01-01T00:00:00'}],NOW);
 assert.equal(out.length,1);assert.equal(out[0].payload.isIss,true);assert.throws(()=>parseCelestrak([],NOW));
});
test('OpenAQ: recent Pakistan stations, readings mapped to parameters',()=>{
 const locs=parseOpenaqLocations({results:[{id:7,name:'Lahore US Consulate',locality:'Lahore',coordinates:{latitude:31.56,longitude:74.33},datetimeLast:{utc:'2026-11-25T11:00:00Z'},sensors:[{id:70,parameter:{name:'pm25',units:'µg/m³',displayName:'PM2.5'}}]},{id:8,coordinates:{latitude:51,longitude:0},datetimeLast:{utc:'2026-11-25T11:00:00Z'},sensors:[]}]},NOW);
 assert.equal(locs.length,1);assert.equal(openaqLatestUrl(7),'https://api.openaq.org/v3/locations/7/latest');assert.throws(()=>openaqLatestUrl(-1));
 const [r]=parseOpenaqLatest({results:[{sensorsId:70,value:180.5,datetime:{utc:'2026-11-25T11:00:00Z'}},{sensorsId:99,value:1,datetime:{utc:'2026-11-25T11:00:00Z'}}]},locs[0],NOW);
 assert.equal(r.payload.readings.length,1);assert.equal(r.payload.readings[0].parameter,'pm25');assert.equal(r.metric,'aq_station');
});
test('extra GIBS layers are allowlisted and need a verified probe',()=>{
 const l=GIBS_EXTRA_LAYERS[0];const [m,e]=l.candidates[0];
 assert.match(gibsLayerProbeUrl(l.layer,m,e,'2026-11-24'),/^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\//);
 assert.match(gibsLayerTemplate(l.layer,m,e,'2026-11-24'),/\{z\}\/\{y\}\/\{x\}/);assert.equal(gibsMaxZoom('GoogleMapsCompatible_Level8'),8);
 assert.throws(()=>gibsLayerTemplate('EVIL','GoogleMapsCompatible_Level8','png','2026-11-24'));assert.throws(()=>gibsLayerProbeUrl(l.layer,m,e,'../x'));
});
test('new metrics and providers pass the parameterized batch builder; removed ones do not',()=>{
 for(const [p,metric] of [['airquality','air_quality'],['weather','weather'],['flood','river_flow'],['gdacs','disaster_alert'],['swpc','space_weather'],['celestrak','orbit'],['openaq','aq_station']])
  assert.equal(buildObservationBatch(p,[{metric,location:'x',observationKey:'k',observedAt:'2026-11-25T00:00:00Z',payload:{}}]).values[0],p);
 assert.throws(()=>buildObservationBatch('sentinel2',[{metric:'scene',location:'x',observationKey:'k',observedAt:'2026-11-25T00:00:00Z',payload:{}}]));
 assert.throws(()=>buildObservationBatch('firms',[{metric:'science_scene',location:'x',observationKey:'k',observedAt:'2026-11-25T00:00:00Z',payload:{}}]));
});
test('satellite data is a sub-bucket of the hub: sources registered, health reported, negatives allowed only outside creators',()=>{
 const hub=src('../database/migrations/119_hub_satellite.sql');const ddl=src('../src/lib/hub-schema.ts');
 assert.ok(ddl.includes(hub.trim()),'startup DDL equals the migration');
 for(const id of ['firms','power','eonet','usgs','gibs','gpm','airquality','weather','flood','gdacs','swpc','celestrak','openaq'])assert.match(hub,new RegExp(`'sat_${id}\\.api'`));
 assert.match(hub,/'satellite'/);assert.match(hub,/entity_kind NOT IN \('account','content','comment'\)/);
 const svc=src('../src/modules/satellite/service.ts');assert.match(svc,/writeHub\(provider,observations\)/);assert.match(svc,/reportHub\(id,true\)/);assert.match(svc,/reportHub\(id,false,message\)/);
 assert.match(src('../src/modules/satellite/routes.ts'),/setHubEnabled\(id,changes\.enabled\)/);
 assert.match(src('../scripts/copy-assets.mjs'),/modules\/satellite\/open-data\.mjs/);
});
