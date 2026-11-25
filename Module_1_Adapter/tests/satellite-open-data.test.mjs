import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {airQualityUrl,parseAirQuality,aqiBand,weatherUrl,parseWeather,RIVER_POINTS,floodUrl,parseFlood,gdacsUrl,parseGdacs,parseKp,geomagneticScale,parseCelestrak,parseOpenaqLocations,parseOpenaqLatest,openaqLatestUrl,GIBS_EXTRA_LAYERS,gibsLayerProbeUrl,gibsLayerTemplate,gibsMaxZoom} from '../src/modules/satellite/open-data.mjs';
import {buildObservationBatch} from '../src/modules/satellite/bulk.mjs';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8').replace(/\r\n/g,'\n');
const NOW=Date.parse('2026-11-25T12:30:00Z');

test('air quality: fixed Open-Meteo host, Lahore coordinates, past hours stored and next-24h peak attached',()=>{
 const u=new URL(airQualityUrl('lahore'));assert.equal(u.hostname,'air-quality-api.open-meteo.com');assert.equal(u.searchParams.get('latitude'),'31.5204');assert.match(u.searchParams.get('hourly'),/pm2_5/);
 assert.throws(()=>airQualityUrl('london'));
 const body={hourly_units:{pm2_5:'μg/m³',us_aqi:'USAQI'},hourly:{time:['2026-11-25T10:00','2026-11-25T11:00','2026-11-25T12:00','2026-11-25T13:00','2026-11-26T05:00'],pm2_5:[150.2,160.5,170,190,250],us_aqi:[200,205,210,230,300],pm10:[1,2,3,4,5],nitrogen_dioxide:[null,null,null,null,null],ozone:[1,1,1,1,1],dust:[0,0,0,0,0],uv_index:[1,1,1,0,0]}};
 const rows=parseAirQuality(body,'lahore',NOW);
 assert.equal(rows.length,3);assert.equal(rows[0].observedAt,'2026-11-25T12:00:00.000Z');assert.equal(rows[0].payload.values.pm2_5,170);
 assert.deepEqual(rows[0].payload.next24h,{maxUsAqi:300,maxPm2_5:250});assert.equal(rows[0].metric,'air_quality');
 assert.equal(aqiBand(210),'Very unhealthy');assert.equal(aqiBand(40),'Good');assert.equal(aqiBand(null),null);
 assert.throws(()=>parseAirQuality({},'lahore'));
});
test('weather: current conditions, 7 days and heat days; negative temperatures allowed',()=>{
 assert.equal(new URL(weatherUrl('quetta')).hostname,'api.open-meteo.com');
 const body={current:{time:'2026-11-25T12:15',temperature_2m:-3.4,apparent_temperature:-7,relative_humidity_2m:40,precipitation:0,wind_speed_10m:12,weather_code:1},daily:{time:['2026-11-25','2026-11-26'],temperature_2m_max:[42,10],temperature_2m_min:[-5,-6],apparent_temperature_max:[44,8],precipitation_sum:[0,1.2],precipitation_probability_max:[0,40],uv_index_max:[4,3],wind_speed_10m_max:[20,22],weather_code:[1,61]}};
 const [w]=parseWeather(body,'quetta');assert.equal(w.payload.current.temperatureC,-3.4);assert.equal(w.payload.daily.length,2);assert.equal(w.payload.heatDays,1);assert.equal(w.observedAt,'2026-11-25T12:15:00.000Z');
 assert.throws(()=>parseWeather({current:{time:'x'},daily:{time:[]}},'quetta'));
});
test('river flow: today discharge, 30-day forecast peak and ratio; unknown points rejected',()=>{
 assert.ok(Object.keys(RIVER_POINTS).length>=10);assert.throws(()=>floodUrl('thames'));
 const u=new URL(floodUrl('indus-sukkur'));assert.equal(u.hostname,'flood-api.open-meteo.com');assert.equal(u.searchParams.get('forecast_days'),'30');
 const body={daily:{time:['2026-11-24','2026-11-25','2026-11-26','2026-11-27'],river_discharge:[1000,1100,1200,1500],river_discharge_median:[null,null,1150,1400],river_discharge_max:[null,null,1600,2400]}};
 const [r]=parseFlood(body,'indus-sukkur',NOW);
 assert.equal(r.payload.dischargeM3s,1100);assert.deepEqual(r.payload.peak30,{date:'2026-11-27',max:2400});assert.equal(r.payload.peakToTodayRatio,2.18);assert.equal(r.payload.river,'Indus');
 assert.throws(()=>parseFlood({daily:{time:['2026-12-01'],river_discharge:[5]}},'indus-sukkur',NOW));
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
