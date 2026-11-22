/** PCI Events Intelligence installer; supports dry-run; never changes creator/Satellite modules. */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(process.argv[2]||process.cwd());
const dry=process.argv.includes('--dry-run');
const manifest=JSON.parse(fs.readFileSync(path.join(here,'MANIFEST.json'),'utf8'));
const normalized=s=>s.replace(/\r\n/g,'\n');
const targets=new Map();
function load(rel){
 if(targets.has(rel))return targets.get(rel);
 const filename=path.join(root,rel);
 if(!fs.existsSync(filename))throw Error('Missing expected PCI file: '+rel);
 const value=normalized(fs.readFileSync(filename,'utf8'));targets.set(rel,value);return value;
}
function update(rel,find,replacement,label){
 let s=load(rel);
 if(s.includes(replacement)&&(replacement.includes(find)||!s.includes(find)))return;
 const n=s.split(find).length-1;
 if(n!==1)throw Error(`${label}: expected one anchor in ${rel}, found ${n}. No files were changed.`);
 targets.set(rel,s.replace(find,replacement));
}
function addAfter(rel,anchor,insertion,label){
 let s=load(rel);
 if(s.includes(insertion))return;
 const n=s.split(anchor).length-1;
 if(n!==1)throw Error(`${label}: expected one anchor in ${rel}, found ${n}. No files were changed.`);
 targets.set(rel,s.replace(anchor,anchor+insertion));
}
function insertBefore(rel,anchor,insertion,label){
 let s=load(rel);
 if(s.includes(insertion))return;
 const n=s.split(anchor).length-1;
 if(n!==1)throw Error(`${label}: expected one anchor in ${rel}, found ${n}. No files were changed.`);
 targets.set(rel,s.replace(anchor,insertion+anchor));
}
function addOnce(rel,marker,addition){let s=load(rel);if(!s.includes(marker))targets.set(rel,s.replace(/\s*$/,'\n')+addition+'\n');}
function file(rel){
 const actual=path.join(here,'payload',rel);if(!fs.existsSync(actual))throw Error('Package missing '+rel);
 const bytes=fs.readFileSync(actual);
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(manifest[rel]!==digest)throw Error('Package integrity check failed for '+rel);
 const v=normalized(bytes.toString('utf8'));
 const dest=path.join(root,rel);
 if(fs.existsSync(dest)){
  const existing=normalized(fs.readFileSync(dest,'utf8'));
  if(existing!==v)throw Error('Update conflict, existing file differs: '+rel+'; no files changed.');
  return;
 }
 targets.set(rel,v);
}
const B='Module_1_Adapter/';const W='Module_2_Public_Website/';const A='Module_3_Admin_Panel/';
file(B+'database/migrations/099_events_intelligence.sql');
file(B+'src/modules/events/classifier.mjs');
file(B+'src/modules/events/classifier.d.mts');
file(B+'src/modules/events/intelligence.ts');
file(B+'tests/events-intelligence.test.mjs');
file(A+'src/app/events/intelligence/page.tsx');
file(A+'vendor/pci-ui/src/styles/events-intelligence.css');
file(A+'tests/events-intelligence.test.mjs');
file(W+'tests/events-intelligence-public.test.mjs');

// Bootstrap SQL is loaded under the existing events-specific advisory lock.
addAfter(B+'src/lib/events-schema.ts',"  await client.query(editorialSql);", "\n  const intelligenceSql=await readFile(fileURLToPath(new URL('../../database/migrations/099_events_intelligence.sql',import.meta.url)),'utf8');\n  await client.query(intelligenceSql);",'bootstrap migration');

// TypeScript does not emit .mjs; copy the pure classifier into dist for production startup.
// Register the runtime asset by parsing the declared list rather than assuming a
// particular Satellite version, entry ordering, or formatting of copy-assets.mjs.
// Supports the one-line array used by current PCI and the original multi-line array.
function ensureClassifierRuntimeAsset(rel){
 const s=load(rel);
 const matches=[...s.matchAll(/\bconst\s+runtimeModules\s*=\s*\[([\s\S]*?)\]/g)];
 if(matches.length!==1)throw Error(`production runtime classifier asset: expected one runtimeModules array in ${rel}, found ${matches.length}. No files were changed.`);
 const whole=matches[0][0],entries=matches[0][1];
 const asset="'modules/events/classifier.mjs'";
 if(entries.includes('modules/events/classifier.mjs'))return;
 const indentation=(entries.match(/\n([ \t]+)['"]modules\//)||[])[1]||'  ';
 const updated=entries.startsWith('\n')?`\n${indentation}${asset},${entries}`:`${asset},${entries}`;
 targets.set(rel,s.replace(whole,whole.replace(entries,updated)));
}
ensureClassifierRuntimeAsset(B+'scripts/copy-assets.mjs');

// Feed data passes through the deterministic classifier before it reaches PostgreSQL.
addAfter(B+'src/modules/events/service.ts',"import {logger} from '../../lib/errors.js';", "\nimport {classifyEvent} from './classifier.mjs';",'classifier dependency');
update(B+'src/modules/events/service.ts',
 'seen.add(item.external_id);accepted.push(item);',
 "seen.add(item.external_id);\n  const classification=classifyEvent({name:item.name,description:item.description,venue:item.venue,sourceCategory:source.category});\n  accepted.push({...item,classification_category:classification.category,classification_confidence:classification.confidence,classification_reason:classification.reason,classification_state:classification.state});",
 'classification at ingestion');
update(B+'src/modules/events/service.ts','fingerprint,approved,active)',
 'fingerprint,approved,active,classification_category,classification_confidence,classification_reason,classification_state,review_decision,classified_at)',
 'new event columns');
update(B+'src/modules/events/service.ts',
 'VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,true)',
 "VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,true,$17,$18,$19,$20,'pending',now())",
 'new event values');
update(B+'src/modules/events/service.ts',
 'fingerprint=EXCLUDED.fingerprint,active=true,last_seen_at=now()',
 "fingerprint=EXCLUDED.fingerprint,active=true,\n     classification_category=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_category ELSE EXCLUDED.classification_category END,\n     classification_confidence=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_confidence ELSE EXCLUDED.classification_confidence END,\n     classification_reason=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_reason ELSE EXCLUDED.classification_reason END,\n     classification_state=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_state ELSE EXCLUDED.classification_state END,\n     review_decision=CASE WHEN pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.review_decision ELSE 'pending' END,\n     classified_at=now(),last_seen_at=now()",
 'preserve owner overrides and re-review changed event');
update(B+'src/modules/events/service.ts',
 'item.ticket_type,item.price_text,item.fingerprint]);',
 'item.ticket_type,item.price_text,item.fingerprint,item.classification_category,item.classification_confidence,item.classification_reason,item.classification_state]);',
 'classification SQL params');

// Existing administrative auth/CSRF chain also protects the Events Intelligence APIs.
addAfter(B+'src/modules/events/routes.ts',"import {validateHttpsUrl} from './parse.js';", "\nimport {intelligenceRoutes} from './intelligence.js';",'intelligence router import');
addAfter(B+'src/modules/events/routes.ts',"adminEventsRoutes.use(requireAdmin,roles('owner','editor'));",
 "\nadminEventsRoutes.use('/intelligence',intelligenceRoutes);",'router authorization mount');

// Old five-category source aliases continue working; all seven new categories are allowed.
const oldCategory="['sports','arts','expos','conferences','community']";
const newCategory="['sports','education','gaming','technology','business','arts','community','expos','conferences']";
update(B+'src/modules/events/routes.ts',"const category=z.enum("+oldCategory+");", "const category=z.enum("+newCategory+");",'seven route categories');
for(const kind of ['parse.mjs','parse.ts']){
 update(B+'src/modules/events/'+kind,"export const CATEGORIES="+oldCategory+";",
  'export const CATEGORIES='+newCategory+';','parser category allowlist');
}
// Publish new canonical categories to existing map/table readers while retaining legacy records.
update(B+'src/modules/events/routes.ts',
 'e.all_day,e.city,e.category,e.venue,e.latitude',
 "e.all_day,e.city,COALESCE(e.classification_category,CASE e.category WHEN 'expos' THEN 'business' WHEN 'conferences' THEN 'education' ELSE e.category END) AS category,e.venue,e.latitude",
 'public feed category');
update(B+'src/modules/events/routes.ts',
 'false AS all_day,city,category,venue,latitude',
 "false AS all_day,city,CASE category WHEN 'expos' THEN 'business' WHEN 'conferences' THEN 'education' ELSE category END AS category,venue,latitude",
 'public editorial category');

// Keep backfill small and independent, never prevent other cron jobs from running.
addAfter(B+'src/modules/sync/scheduler.ts',"import {syncApprovedEventSources} from '../events/service.js';",
 "\nimport {classifyPendingEvents} from '../events/intelligence.js';",'bounded classification scheduler import');
insertBefore(B+'src/modules/sync/scheduler.ts'," tasks.push(cron.schedule('*/10 * * * *',()=>recoverStalledJobs()",
 " tasks.push(cron.schedule('15 */6 * * *',()=>{void classifyPendingEvents(100).catch(err=>logger.warn({err},'Events backfill skipped'));},{timezone:'Asia/Karachi'}));\n",
 'bounded classification job');

// Admin: one Events Intelligence menu entry next to existing Event sources; Satellite untouched.
addAfter(A+'src/lib/nav.ts',"{title:'Event sources',href:'/events/sources',icon:'settings',roles:['owner','editor']},",
 "\n  {title:'Events Intelligence',href:'/events/intelligence',icon:'settings',roles:['owner','editor']},",'management link');
addOnce(A+'vendor/pci-ui/src/styles.css','./styles/events-intelligence.css',"@import './styles/events-intelligence.css';");

const catLine="const CATEGORY_OPTIONS=[['sports','Sports'],['arts','Arts & Culture'],['expos','Expos & Business'],['conferences','Conferences & Workshops'],['community','Community & Festivals']];";
const catsNew="const CATEGORY_OPTIONS=[['sports','Sports'],['education','Education & Learning'],['gaming','Gaming & Esports'],['technology','Technology & Innovation'],['business','Business & Expos'],['arts','Arts & Entertainment'],['community','Community & Festivals'],['expos','Legacy: Expos'],['conferences','Legacy: Conferences']];";
update(A+'src/app/events/sources/page.tsx',catLine,catsNew,'source admin category options');

const radar=W+'public/events-radar.html';
const oldRadar="const CATEGORIES = [\n  {id:'all', label:'All Events'},\n  {id:'sports',label:'Sports'},\n  {id:'arts',label:'Arts & Culture'},\n  {id:'expos',label:'Expos & Business'},\n  {id:'conferences',label:'Conferences & Workshops'},\n  {id:'community',label:'Community & Festivals'}\n];";
const newRadar="const CATEGORIES = [\n  {id:'all',label:'All Events'},\n  {id:'sports',label:'Sports'},\n  {id:'education',label:'Education & Learning'},\n  {id:'gaming',label:'Gaming & Esports'},\n  {id:'technology',label:'Technology & Innovation'},\n  {id:'business',label:'Business & Expos'},\n  {id:'arts',label:'Arts & Entertainment'},\n  {id:'community',label:'Community & Festivals'}\n];";
update(radar,oldRadar,newRadar,'map category tabs');
update(radar,
 " if(!CATEGORIES.some(c=>c.id===item.category))return null;",
 " const category=item.category==='expos'?'business':item.category==='conferences'?'education':item.category;\n if(!CATEGORIES.some(c=>c.id===category))return null;",
 'map legacy categories');
// Accept bookmarked legacy filter IDs without creating duplicate public category tabs.
insertBefore(radar,'function eligibleEvents(){',
 "function categoryMatches(event){const selected=state.category==='expos'?'business':state.category==='conferences'?'education':state.category;return selected==='all'||event.category===selected;}\n",
 'legacy map category filter');
{
 const source=load(radar),old="(state.category==='all'||event.category===state.category) &&",next='categoryMatches(event) &&';
 if(source.includes(next)&&!source.includes(old)){}else if(source.split(old).length-1===2){targets.set(radar,source.split(old).join(next));}
 else throw Error('Map filter anchor changed; no files were modified.');
}
update(radar,'name:item.name,city:item.city,category:item.category,date,time,venue:item.venue,lat,lng,',
 'name:item.name,city:item.city,category,date,time,venue:item.venue,lat,lng,','map normalize label');

const evtTable=W+'src/lib/event-table.mjs';
update(evtTable,
 "export const EVENT_CATEGORY_LABELS=Object.freeze({sports:'Sports',arts:'Arts & Culture',expos:'Expos & Business',conferences:'Conferences & Workshops',community:'Community & Festivals'});",
 "export const EVENT_CATEGORY_LABELS=Object.freeze({sports:'Sports',education:'Education & Learning',gaming:'Gaming & Esports',technology:'Technology & Innovation',business:'Business & Expos',arts:'Arts & Entertainment',community:'Community & Festivals'});",
 'seven table labels');
update(evtTable,
 "const category=typeof event.category==='string'?event.category.toLowerCase().trim():'other';",
 "const rawCategory=typeof event.category==='string'?event.category.toLowerCase().trim():'other';\n    const category=rawCategory==='expos'?'business':rawCategory==='conferences'?'education':rawCategory;",
 'legacy table categories');

update(evtTable,
 "  const cutoff=window==='week'?now+7*86400000:window==='month'?now+30*86400000:Infinity;",
 "  const selectedCategory=category==='expos'?'business':category==='conferences'?'education':category;\n  const cutoff=window==='week'?now+7*86400000:window==='month'?now+30*86400000:Infinity;",
 'legacy table category filter');
update(evtTable,"(category==='all'||e.category===category)&&", "(selectedCategory==='all'||e.category===selectedCategory)&&",'table filter compatibility');

// Previous table test uses a retired display label; update its expectation to the new category.
const tableTest=W+'tests/events-table.test.mjs';
update(tableTest,"assert.equal(eventCategoryLabel('arts'),'Arts & Culture');",
 "assert.equal(eventCategoryLabel('arts'),'Arts & Entertainment');",'updated arts category label');

const evtComponent=W+'src/components/EventsTable.tsx';
update(evtComponent,
 'const categories=useMemo(()=>[...new Set(events.map(e=>e.category))].sort(),[events]);',
 "const categories=useMemo(()=>['sports','education','gaming','technology','business','arts','community'],[]);",
 'show all seven category filters');

// All pattern checking is complete before the first write. Preserve backups of changed existing files.
const changes=[...targets].filter(([rel,s])=>{
 const fn=path.join(root,rel);return !fs.existsSync(fn)||normalized(fs.readFileSync(fn,'utf8'))!==s;
});
if(dry){console.info(`DRY RUN OK: ${changes.length} file(s) would change`);changes.forEach(([p])=>console.info('  '+p));process.exit(0);}
const backup=path.join(root,'.pci-event-intelligence-backups',new Date().toISOString().replaceAll(':','-'));
const written=[];
try{
 for(const [rel,value] of changes){
  const fn=path.join(root,rel);fs.mkdirSync(path.dirname(fn),{recursive:true});
  if(fs.existsSync(fn)){
   const save=path.join(backup,rel);fs.mkdirSync(path.dirname(save),{recursive:true});fs.copyFileSync(fn,save);
  }
  fs.writeFileSync(fn,value,'utf8');written.push({rel,fn});
 }
}catch(e){for(const x of written.reverse()){
 const previous=path.join(backup,x.rel);
 if(fs.existsSync(previous))fs.copyFileSync(previous,x.fn);else fs.rmSync(x.fn,{force:true});
}throw e;}
console.info(`PCI Events Intelligence installed: ${changes.length} file(s) updated.`);
console.info('Seven categories; deterministic classification; bounded backfill; owner review; source health.');
console.info('Run: npm --prefix Module_1_Adapter run check');
console.info('Run: npm --prefix Module_2_Public_Website run check');
console.info('Run: npm --prefix Module_3_Admin_Panel run check');
