import {readFileSync,writeFileSync,mkdirSync,cpSync,existsSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(process.argv[2]||process.cwd());
const dry=process.argv.includes('--dry-run');
const patches=new Map();
function get(path){const full=join(root,path);if(!existsSync(full))throw Error(`Missing expected PCI file: ${path}`);return readFileSync(full,'utf8');}
function put(path,content){if(patches.has(path))throw Error(`Duplicate patch ${path}`);patches.set(path,content);}
function replace(path,find,repl,label){const s=get(path);let matches=typeof find==='string'?s.split(find).length-1:[...s.matchAll(new RegExp(find.source,find.flags.includes('g')?find.flags:find.flags+'g'))].length;
 if(matches!==1)throw Error(`${label} expected once in ${path}; got ${matches}. PCI version changed. No files written.`);
 put(path,s.replace(find,repl));}
function edit(path,mutate){const before=patches.get(path)??get(path);const after=mutate(before);if(after===before)throw Error(`No change in ${path}`);patches.set(path,after);}
const M1='Module_1_Adapter/', M2='Module_2_Public_Website/', M3='Module_3_Admin_Panel/';
const p=M1+'src/modules/satellite/catalog.mjs';
replace(p,/([ ]sentinel5p:\{[^\n]+\})\n\}\);/,`$1,\n usgs:{label:'USGS Earthquake Reports (not early warning)',kind:'earthquake',implemented:true,auth:null,minMinutes:60},\n landsat:{label:'USGS Landsat Surface Temperature (analysis not implemented)',kind:'thermal raster',implemented:false,auth:null,minMinutes:1440},\n ecostress:{label:'NASA ECOSTRESS Water Stress (analysis not implemented)',kind:'evapotranspiration raster',implemented:false,auth:'NASA_EARTHDATA_TOKEN',minMinutes:1440},\n smap:{label:'NASA SMAP Regional Soil Moisture (analysis not implemented)',kind:'soil moisture raster',implemented:false,auth:'NASA_EARTHDATA_TOKEN',minMinutes:1440},\n blackmarble:{label:'NASA VIIRS Black Marble Night Lights (analysis not implemented)',kind:'night lights raster',implemented:false,auth:'NASA_EARTHDATA_TOKEN',minMinutes:1440}\n});`,'provider allowlist');
const policy=M1+'src/modules/satellite/policy.mjs';
replace(policy,'  sentinel5p:1440\n','  sentinel5p:1440,\n  usgs:60,\n  landsat:1440,\n  ecostress:1440,\n  smap:1440,\n  blackmarble:1440\n','provider cooldown');
const bulk=M1+'src/modules/satellite/bulk.mjs';
edit(bulk,s=>s.replace("'sentinel5p'].includes(provider)","'sentinel5p','usgs'].includes(provider)").replace("'imagery'].includes(record.metric)","'imagery','earthquake'].includes(record.metric)"));
const bulkTypes=M1+'src/modules/satellite/bulk.d.mts';
edit(bulkTypes,s=>s.replace("'natural_event'|'scene'|'imagery';location:","'natural_event'|'scene'|'imagery'|'earthquake';location:").replace("'sentinel1'|'sentinel2'|'sentinel5p',observations:","'sentinel1'|'sentinel2'|'sentinel5p'|'usgs',observations:"));
const mig=M1+'database/migrations/099_earth_science_sources.sql';
put(mig,`-- PCI Earth Intelligence: additive provider registry and earthquake observations.
-- Earth observation raster products are deliberately disabled until scientifically verified.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_check' AND pg_get_constraintdef(oid) NOT LIKE '%blackmarble%') THEN
  ALTER TABLE satellite.providers DROP CONSTRAINT providers_id_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_check') THEN
  ALTER TABLE satellite.providers ADD CONSTRAINT providers_id_check CHECK (id IN ('firms','power','gpm','sentinel1','sentinel2','sentinel5p','eonet','gibs','usgs','landsat','ecostress','smap','blackmarble'));
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_check' AND pg_get_constraintdef(oid) NOT LIKE '%earthquake%') THEN
  ALTER TABLE satellite.observations DROP CONSTRAINT observations_metric_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_check') THEN
  ALTER TABLE satellite.observations ADD CONSTRAINT observations_metric_check CHECK (metric IN ('fire','rainfall','solar','natural_event','scene','imagery','earthquake'));
 END IF;
END $$;
INSERT INTO satellite.providers(id,enabled,refresh_minutes) VALUES
 ('usgs',false,60),('landsat',false,1440),('ecostress',false,1440),('smap',false,1440),('blackmarble',false,1440)
ON CONFLICT (id) DO NOTHING;
`);
const boot=M1+'src/lib/satellite-schema.ts';
replace(boot,"'098_satellite_feeds.sql'","'098_satellite_feeds.sql','099_earth_science_sources.sql'",'runtime migration list');
const feeds=M1+'src/modules/satellite/feeds.mjs';
edit(feeds,s=>s+`
/** Official USGS FDSN catalog, bounded to Pakistan-region box. Reports arrive AFTER events. */
export function usgsUrl(now=new Date()) {
 const url=new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
 const start=new Date(now.valueOf()-7*86400000).toISOString();
 for(const [k,v] of Object.entries({format:'geojson',starttime:start,minlatitude:'23',maxlatitude:'38',minlongitude:'60',maxlongitude:'78',minmagnitude:'2.5',limit:'200',orderby:'time'}))url.searchParams.set(k,v);
 return url.toString();
}
export function parseUsgs(body) {
 if(!body||body.type!=='FeatureCollection'||!Array.isArray(body.features))throw Error('Malformed USGS GeoJSON');
 const result=[];
 for(const feature of body.features.slice(0,200)){
  const id=feature?.id, prop=feature?.properties, geometry=feature?.geometry;
  if(typeof id!=='string'||!/^[-_a-zA-Z0-9]{1,80}$/.test(id)||geometry?.type!=='Point'||!Array.isArray(geometry.coordinates))continue;
  const [longitude,latitude,depthKm]=geometry.coordinates;
  const magnitude=prop?.mag,time=prop?.time;
  if(!inRegion(longitude,latitude)||typeof magnitude!=='number'||!Number.isFinite(magnitude)||magnitude<0||magnitude>10||typeof depthKm!=='number'||!Number.isFinite(depthKm)||depthKm< -5||depthKm>800||typeof time!=='number'||!Number.isFinite(time)||time<0||time>Date.now()+3600000)continue;
  if(typeof prop?.type==='string'&&prop.type!=='earthquake')continue;
  const observedAt=new Date(time).toISOString();
  const place=typeof prop?.place==='string'?prop.place.slice(0,180):'Location not specified';
  result.push({metric:'earthquake',location:'bounding-box',observationKey:id,observedAt,payload:{eventId:id,magnitude,latitude,longitude,depthKm,place,source:'USGS ComCat',reviewed:prop?.status==='reviewed',status:'reported_earthquake_not_early_warning',sourceUrl:'https://earthquake.usgs.gov/earthquakes/eventpage/'+id}});
 }
 return result;
}
`);
const types=M1+'src/modules/satellite/feeds.d.mts';
edit(types,s=>s+`\nexport declare function usgsUrl(now?:Date):string;\nexport declare function parseUsgs(body:unknown):Array<{metric:'earthquake';location:string;observationKey:string;observedAt:string;payload:Record<string,unknown>}>;\n`);
const svc=M1+'src/modules/satellite/service.ts';
edit(svc,s=>{
 const from="gibsTileURL,gpmWmsURL} from './feeds.mjs';";if(!s.includes(from))throw Error('Expected service feeds import missing');s=s.replace(from,"gibsTileURL,gpmWmsURL,usgsUrl,parseUsgs} from './feeds.mjs';");
 const provider="'sentinel1'|'sentinel2'|'sentinel5p',observations:";if(!s.includes(provider))throw Error('Expected batch provider union missing');s=s.replace(provider,"'sentinel1'|'sentinel2'|'sentinel5p'|'usgs',observations:");
 const metric="'natural_event'|'scene'|'imagery';location:";if(!s.includes(metric))throw Error('Expected batch metric union missing');s=s.replace(metric,"'natural_event'|'scene'|'imagery'|'earthquake';location:");
 const anchor='async function ingestEonet(){';if(!s.includes(anchor))throw Error('Expected ingestEonet missing');s=s.replace(anchor,`async function ingestUsgs(){
 const body=JSON.parse(await fetchText(usgsUrl()));
 return storeBatch('usgs',parseUsgs(body));
}
${anchor}`);
 const cascade="id==='eonet'?await ingestEonet():id==='gibs'";if(!s.includes(cascade))throw Error('Expected ingest cascade missing');s=s.replace(cascade,"id==='eonet'?await ingestEonet():id==='usgs'?await ingestUsgs():id==='gibs'");
 return s;
});
const routes=M1+'src/modules/satellite/routes.ts';
edit(routes,s=>{
 const met="'natural_event'|'scene'|'imagery',location:";if(!s.includes(met))throw Error('Route metric type mismatch');s=s.replace(met,"'natural_event'|'scene'|'imagery'|'earthquake',location:");
 const docs="'/natural-events/latest','/scenes/latest'";if(!s.includes(docs))throw Error('OpenAPI routes mismatch');s=s.replace(docs,"'/natural-events/latest','/earthquakes/latest','/scenes/latest'");
 const anchor="satellitePublicRoutes.get('/natural-events/latest',handler(";if(!s.includes(anchor))throw Error('Missing natural events endpoint');s=s.replace(anchor,`// Earthquakes are USGS agency reports, NOT satellite predictions or advance warnings.
satellitePublicRoutes.get('/earthquakes/latest',handler(async(req,res)=>{
 const n=limit.parse(req.query.limit);
 res.json({data:await list('earthquake','bounding-box',n,7,'usgs'),meta:{source:'USGS ComCat',region:'Pakistan-region bounding box',notEarlyWarning:true,notPrediction:true,mayIncludeNeighboringCountries:true}});
}));
${anchor}`);
 return s;
});
const proxy=M2+'src/app/api/satellite/route.ts';
replace(proxy,"else if(metric==='natural-events'&&!city&&!mission)path='natural-events/latest';","else if(metric==='natural-events'&&!city&&!mission)path='natural-events/latest';\n else if(metric==='earthquakes'&&!city&&!mission)path='earthquakes/latest';",'same-origin earthquake proxy');
const dash=M2+'src/components/SatelliteDashboard.tsx';
edit(dash,s=>{
 const anchor="const [naturalEvents,setNaturalEvents]=useState<Datum[]>([])";if(!s.includes(anchor))throw Error('Missing source state');s=s.replace(anchor,"const [earthquakes,setEarthquakes]=useState<Datum[]>([]);\n "+anchor);
 const filter="'natural-events','imagery'";if(!s.includes(filter))throw Error('Missing source filters');s=s.replace(filter,"'natural-events','imagery'");
 const scenes="setScenes({sentinel1:value(3),sentinel2:value(4),sentinel5p:value(5)});";if(!s.includes(scenes))throw Error('Missing data result indexing');s=s.replace(scenes,"setScenes({sentinel1:value(3),sentinel2:value(4),sentinel5p:value(5)}); setEarthquakes(value(6));");
 const filters="'scenes&mission=sentinel5p'];";if(!s.includes(filters))throw Error('Missing source filter last');s=s.replace(filters,"'scenes&mission=sentinel5p','earthquakes'];");
 const target="{(category==='environment'||category==='disasters'||category==='discover')&&<article className=\"pci-science-finding\"><h3>NASA natural-event records</h3>";if(!s.includes(target))throw Error('Missing finding cards anchor');
 s=s.replace(target,`{(category==='disasters'||category==='discover')&&<article className="pci-science-finding"><h3>Recent reported earthquakes</h3><strong>{earthquakes.length?earthquakes.length+' USGS events in the available feed':'No current USGS report available'}</strong><p>{earthquakes.length?'Most recent: M '+String(earthquakes[0]?.magnitude??'?')+' · '+String(earthquakes[0]?.place??'Unknown'):'The source may be disabled or unavailable. Missing reports do not mean there were no earthquakes.'}</p><small>USGS catalog. Not an early warning, prediction or official local shaking assessment. Events may occur in neighboring countries.</small></article>}
    ${target}`);
 return s;
});
const admin=M3+'src/app/satellite/page.tsx';
edit(admin,s=>{
 const anchor="<p className=\"fineprint\">{!value.implemented?";if(!s.includes(anchor))throw Error('Missing admin help text');s=s.replace(anchor,`{value.id==='usgs'&&<p className="fineprint">USGS earthquake reports arrive after earthquakes. This is NOT an earthquake early-warning system. Initially disabled until the Owner enables ingestion.</p>}
 {['landsat','ecostress','smap','blackmarble'].includes(value.id)&&<p className="fineprint">Scientific raster-processing connector is not implemented. This source is intentionally locked and cannot be enabled; no measurements or map overlays are fabricated.</p>}
 ${anchor}`);
 return s;
});
const catTest=M1+'tests/satellite-catalog.test.mjs';
replace(catTest,'Object.keys(PROVIDERS).length,8','Object.keys(PROVIDERS).length,13','provider count test');
const unit=M1+'tests/earth-science-sources.test.mjs';
put(unit,`import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PROVIDERS} from '../src/modules/satellite/catalog.mjs';
import {usgsUrl,parseUsgs} from '../src/modules/satellite/feeds.mjs';
import {minimumIntervalMinutes} from '../src/modules/satellite/policy.mjs';
import {buildObservationBatch} from '../src/modules/satellite/bulk.mjs';
const src=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('USGS is supported and four raster providers fail closed',()=>{assert.equal(PROVIDERS.usgs.implemented,true);for(const id of ['landsat','ecostress','smap','blackmarble'])assert.equal(PROVIDERS[id].implemented,false);assert.equal(minimumIntervalMinutes('usgs'),60);});
test('USGS upstream query is strictly constrained',()=>{const x=new URL(usgsUrl(new Date('2026-11-22T00:00:00Z')));assert.equal(x.hostname,'earthquake.usgs.gov');assert.equal(x.searchParams.get('minlongitude'),'60');assert.equal(x.searchParams.get('minmagnitude'),'2.5');assert.equal(x.searchParams.get('limit'),'200');});
test('USGS parser accepts reported local earthquakes only, not invented alerts',()=>{const body={type:'FeatureCollection',features:[{type:'Feature',id:'us7000abc',geometry:{type:'Point',coordinates:[74,32,18]},properties:{mag:4.6,time:1795262400000,place:'Kashmir region',type:'earthquake',status:'automatic'}},{type:'Feature',id:'outside',geometry:{type:'Point',coordinates:[5,5,10]},properties:{mag:5,time:1795262400000,type:'earthquake'}}]};const out=parseUsgs(body);assert.equal(out.length,1);assert.equal(out[0].payload.magnitude,4.6);assert.equal(out[0].payload.status,'reported_earthquake_not_early_warning');assert.equal(out[0].payload.reviewed,false);});
test('USGS rejects malformed, missing and fabricated data',()=>{assert.throws(()=>parseUsgs({}));assert.deepEqual(parseUsgs({type:'FeatureCollection',features:[{id:'x',geometry:{type:'Point',coordinates:[70,30,10]},properties:{mag:null,time:1795262400000,type:'earthquake'}}]}),[]);});
test('Earthquake batch is parameterized',()=>{const b=buildObservationBatch('usgs',[{metric:'earthquake',location:'bounding-box',observationKey:'us7000abc',observedAt:'2026-11-20T00:00:00Z',payload:{magnitude:4.2}}]);assert.equal(b.values[0],'usgs');assert.match(b.sql,/ON CONFLICT DO NOTHING/);});
test('new provider migration and runtime bootstrap are wired',()=>{assert.match(src('../database/migrations/099_earth_science_sources.sql'),/blackmarble/);assert.match(src('../src/lib/satellite-schema.ts'),/099_earth_science_sources.sql/);assert.match(src('../src/modules/satellite/routes.ts'),/earthquakes\\/latest/);assert.match(src('../../Module_2_Public_Website/src/app/api/satellite/route.ts'),/earthquakes/);});
`);
// Do not change any file if its existing baseline didn't match every required patch.
for(const path of patches.keys()) if(!path.endsWith('099_earth_science_sources.sql')&&!path.endsWith('earth-science-sources.test.mjs')&&!existsSync(join(root,path)))throw Error(`No existing file: ${path}`);
const backup=join(root,'.pci-earth-source-backups',new Date().toISOString().replaceAll(':','-'));
console.log(`${dry?'DRY RUN':'APPLY'}: ${patches.size} files validated in ${root}`);
for(const path of patches.keys())console.log('  '+path);
if(dry){console.log('No files written.');process.exit(0);}
for(const [path,data] of patches){const abs=join(root,path);if(existsSync(abs)){const dest=join(backup,path);mkdirSync(dirname(dest),{recursive:true});cpSync(abs,dest);}mkdirSync(dirname(abs),{recursive:true});writeFileSync(abs,data,'utf8');}
console.log(`Applied. Backups: ${backup}`);
console.log('RUN ALL THREE MODULE TEST SUITES AND BUILDS BEFORE COMMITTING. DO NOT PUSH IF CI FAILS.');
