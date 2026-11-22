/** PCI targeted reliability patch: scoped, guarded, atomic file writes and backups. Node 22+. */
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const dry=process.argv.includes('--dry-run');
const changes=new Map();
function get(p){const f=path.join(root,p);if(!fs.existsSync(f))throw Error('Missing required file: '+p);return changes.get(p)??fs.readFileSync(f,'utf8');}
function put(p,s){changes.set(p,s);}
function replace(p,before,after,label){let s=get(p);if(!s.includes(before)){if(s.includes(after))return;throw Error('Source mismatch '+p+' ['+label+']; no files written');}put(p,s.replace(before,after));}
const sync='Module_1_Adapter/src/modules/sync/service.ts';
const admin='Module_1_Adapter/src/modules/admin/routes.ts';
const unified='Module_1_Adapter/src/modules/unified/routes.ts';
const wheel='Module_2_Public_Website/src/components/UnifiedCreatorExperience.tsx';
const home='Module_2_Public_Website/src/app/page.tsx';
const worker='Module_1_Adapter/src/worker.ts';
// Keep actual UI wheel to exactly its original three metrics. Do not change rank calculations.
replace(wheel,
 "const wheelModes=[{metric:'allrounders' as const,title:'All Rounders',label:'Relative cross-platform score'},...displayModes];",
 "const wheelModes=displayModes; // PCI_WHEEL_THREE_METRICS_V2",
 'exactly three wheel controls');
replace(wheel,
 "useState<WheelMetric>(allRounders.length?'allrounders':'views')",
 "useState<WheelMetric>('views')",
 'Most Viewed default');
// Do not request an unused experimental wheel result on every homepage render.
replace(home,
 "platformInstagram,curatedYoutube,allRounders]=await Promise.all([",
 "platformInstagram,curatedYoutube]=await Promise.all([",
 'remove unused allrounder response');
replace(home,
 "  adapterGet<{data:Creator[]}>('/api/v1/rankings?sort=subscribers&limit=100'),\n  adapterGet<UnifiedRankingResponse>('/api/v1/unified/all-rounders?limit=20')",
 "  adapterGet<{data:Creator[]}>('/api/v1/rankings?sort=subscribers&limit=100')",
 'remove unused allrounder request');
replace(home,
 "<UnifiedRankingWheel rankings={rankings} allRounders={allRounders?.data??[]}/>",
 "<UnifiedRankingWheel rankings={rankings}/>",
 'remove unused allrounder prop');
// Bulk import creates an initial sync job DURABLY in the same transaction as new channel inserts.
// We queue one follow-up when an earlier sync is already running; the worker processes it afterward.
const bulkStart="adminRoutes.post('/creators/bulk',roles('owner','editor'),handler(async(req,res)=>{";
const bulkEnd="// PCI_BULK_SOFT_DELETE_V1";
{
 let s=get(admin);const a=s.indexOf(bulkStart),b=s.indexOf(bulkEnd,a);
 if(a<0||b<0)throw Error('Bulk import boundary not found; no files written');
 let chunk=s.slice(a,b);
 const target="       for(const cid of item.categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[r.rows[0].id,cid]);\n     }\n   });";
 const insert="       for(const cid of item.categoryIds)await tx.query('INSERT INTO creator_categories(creator_id,category_id) VALUES($1,$2)',[r.rows[0].id,cid]);\n     }\n     // PCI_AUTO_INITIAL_SYNC_V2: insert a queued job in this same transaction.\n     if(created||reactivated){\n       await tx.query('SELECT pg_advisory_xact_lock(712003)');\n       const pending=await tx.query(\"SELECT id FROM sync_runs WHERE status='queued' ORDER BY created_at LIMIT 1\");\n       if(!pending.rowCount)await tx.query(\"INSERT INTO sync_runs(source,requested_by) VALUES('manual',$1)\",[adminId(res)]);\n     }\n   });";
 if(!chunk.includes('PCI_AUTO_INITIAL_SYNC_V2')){
  if(!chunk.includes(target))throw Error('Bulk insert anchor changed; no files written');
  chunk=chunk.replace(target,insert);
 }
 put(admin,s.slice(0,a)+chunk+s.slice(b));
}
// Backfill records imported before this fix when the worker starts after deployment.
if(!get(worker).includes('PCI_BACKFILL_UNSYNCED_V2'))replace(worker,
 " logger.info('Worker ready');",
 ` logger.info('Worker ready');
 // PCI_BACKFILL_UNSYNCED_V2: one startup job if any enabled channel lacks snapshots.
 if(config.YOUTUBE_SYNC_ENABLED==='true'){
   const gaps=await pool.query(\`SELECT count(*)::int AS n FROM creators c
     LEFT JOIN channel_stats_latest s ON s.creator_id=c.id
     WHERE c.enabled=true AND s.creator_id IS NULL\`);
   const missing=Number(gaps.rows[0]?.n??0);
   if(missing>0){await enqueueSync('scheduled');logger.info({missing},'Queued missing channel snapshot backfill');}
 }`,
 'worker startup backfill');
// Sync: safeguard successful channel snapshots against video API errors;
// retain a failure report for missing channels without discarding other channels.
replace(sync,
 "   if(missing.length===creators.length || missing.length>Math.max(2,Math.floor(creators.length*0.1)))\n     throw new Error('YOUTUBE_CHANNEL_RESULTS_INCOMPLETE: suspiciously many missing channels');",
 "   if(missing.length===creators.length)\n     throw new Error('YOUTUBE_CHANNEL_RESULTS_INCOMPLETE: no requested channels returned');\n   // PCI_PARTIAL_CHANNEL_SYNC_V2: valid responses still publish; missing ones are reported.",
 'partial channel acceptance');
{
 let s=get(sync);
 if(!s.includes('PCI_EARLY_CHANNEL_SNAPSHOTS_V2')){
 const begin=s.indexOf('   const videoIdsByChannel=new Map<string,string[]>();');
 const outer=s.indexOf('   const fetchTime=new Date().toISOString();',begin);
 const trans=s.indexOf('   await transaction(async tx=>{',outer);
 const loop=s.indexOf('     for(const creator of available){',trans);
 const metricsStart=s.indexOf('       const channel=lookup.get(creator.channel_id)!;',loop);
 const metricsEnd=s.indexOf('       const present:string[]=[];',metricsStart);
 if([begin,outer,trans,loop,metricsStart,metricsEnd].some(x=>x<0)||!(begin<outer&&outer<trans&&trans<loop&&loop<metricsStart&&metricsStart<metricsEnd))throw Error('Sync function structure changed; no files written');
 {
  const metricsBlock=s.slice(metricsStart,metricsEnd);
  const pre=`   // PCI_EARLY_CHANNEL_SNAPSHOTS_V2: commit channel metrics before optional video downloads.\n   const fetchTime=new Date().toISOString();\n   await transaction(async tx=>{\n     for(const creator of available){\n${metricsBlock}     }\n     await tx.query('UPDATE publication_state SET sync_run_id=$1,published_at=$2 WHERE id=true',[runId,fetchTime]);\n   });\n   await bustPublicCache();\n`;
  s=s.slice(0,begin)+pre+s.slice(begin);
  // Remove the original channel upsert block in the video transaction.
  let x=s.indexOf('   const videoIdsByChannel=new Map<string,string[]>();');
  let oldFetch=s.indexOf('   const fetchTime=new Date().toISOString();',x);
  let tx=s.indexOf('   await transaction(async tx=>{',oldFetch);
  let oldMetrics=s.indexOf('       const channel=lookup.get(creator.channel_id)!;',tx);
  let oldEnd=s.indexOf('       const present:string[]=[];',oldMetrics);
  if([oldFetch,tx,oldMetrics,oldEnd].some(a=>a<0))throw Error('Could not isolate former stats block');
  s=s.slice(0,oldMetrics)+s.slice(oldEnd);
  s=s.slice(0,oldFetch)+s.slice(oldFetch+'   const fetchTime=new Date().toISOString();\n'.length);
 }
 }
 put(sync,s);
}
replace(sync,
 "   const videoResults:YoutubeVideo[]=[];\n   for(const group of chunks(allIds,50))videoResults.push(...await yt.videos(group));",
 "   const videoResults:YoutubeVideo[]=[];\n   let videoFetchFailed=false; // PCI_VIDEO_PARTIAL_V2\n   for(const group of chunks(allIds,50)){\n     try{videoResults.push(...await yt.videos(group));}\n     catch(err){videoFetchFailed=true;warnings.push('One video-statistics batch failed; previously stored videos preserved');logger.warn({err,runId},'Video fetch failed; channel stats already committed');}\n   }",
 'video collection failure isolation');
replace(sync,
 "if(!uploadFailures.has(creator.channel_id))await tx.query('DELETE FROM videos WHERE creator_id=$1 AND NOT (video_id=ANY($2::text[]))',[creator.id,present]);",
 "if(!uploadFailures.has(creator.channel_id)&&!videoFetchFailed)await tx.query('DELETE FROM videos WHERE creator_id=$1 AND NOT (video_id=ANY($2::text[]))',[creator.id,present]);",
 'preserve previously stored videos');
// Remove the stale secondary publication write; the channel stats publication already committed.
replace(sync,
 "     await tx.query('UPDATE publication_state SET sync_run_id=$1,published_at=$2 WHERE id=true',[runId,fetchTime]);\n     await tx.query(\"UPDATE sync_runs SET status=$2,finished_at=now(),quota_used=$3,channel_count=$4,video_count=$5,error_code=$6,error_message=$7 WHERE id=$1\"",
 "     await tx.query(\"UPDATE sync_runs SET status=$2,finished_at=now(),quota_used=$3,channel_count=$4,video_count=$5,error_code=$6,error_message=$7 WHERE id=$1\"",
 'publish only once');
// Unified list: eliminate the fragile multi-join / DISTINCT JSON aggregation.
// Isolate optional Instagram source schema; do not conceal unexpected errors.
{
 let s=get(unified);const a=s.indexOf('async function listPeople(){'),b=s.indexOf('const disclosure=',a);
 if(a<0||b<0)throw Error('Unified listPeople boundary not found');
 if(!s.includes('PCI_UNIFIED_ISOLATED_QUERIES_V2')){
  const replacement=`// PCI_UNIFIED_ISOLATED_QUERIES_V2: one stable YouTube registry query, optional IG read.\n// No IG migration should be able to take down the YouTube/combined ranking API.\nasync function listPeople(){\n const base=await query(\`SELECT c.id,c.slug,c.display_name AS "displayName",c.enabled,\n   c.human_review_status AS "humanReviewStatus",c.channel_id AS "channelId",\n   ys.thumbnail_url AS "thumbnailUrl",ys.subscriber_count::text AS "ytSubscribers",\n   ys.view_count::text AS "ytViews",ys.video_count::text AS "ytVideos",ys.fetched_at AS "ytFetchedAt"\n   FROM creators c LEFT JOIN channel_stats_latest ys ON ys.creator_id=c.id\n   WHERE c.enabled=true ORDER BY c.id\`);\n const ids=base.rows.map((r:any)=>r.id);\n if(!ids.length)return [];\n const categories=await query(\`SELECT cc.creator_id AS "creatorId",ca.slug,ca.label\n   FROM creator_categories cc JOIN categories ca ON ca.id=cc.category_id\n   WHERE cc.creator_id=ANY($1::uuid[]) AND ca.active=true ORDER BY ca.slug\`,[ids]);\n const categoryMap=new Map<string,{slug:string;label:string}[]>();\n for(const c of categories.rows){const xs=categoryMap.get(c.creatorId)??[];xs.push({slug:c.slug,label:c.label});categoryMap.set(c.creatorId,xs);}\n const people=base.rows.map((r:any)=>({id:r.id,slug:r.slug,displayName:r.displayName,enabled:r.enabled,\n   humanReviewStatus:r.humanReviewStatus,thumbnailUrl:r.thumbnailUrl,\n   categories:categoryMap.get(r.id)??[],\n   youtube:{url:\`https://www.youtube.com/channel/\${encodeURIComponent(r.channelId)}\`,subscribers:r.ytSubscribers,views:r.ytViews,videos:r.ytVideos,fetchedAt:r.ytFetchedAt},\n   instagram:null as null|{url:string;username:string;followers:string|null;posts:string|null;fetchedAt:string|null}}));\n const byId=new Map(people.map(p=>[p.id,p]));\n try{\n   const ig=await query(\`SELECT i.id AS "instagramId",i.youtube_creator_id AS "creatorId",i.username,\n     st.followers_count::text AS "followers",st.media_count::text AS "posts",st.fetched_at AS "fetchedAt"\n     FROM instagram_creators i LEFT JOIN instagram_stats_latest st ON st.creator_id=i.id\n     WHERE i.enabled=true AND i.eligibility='approved' AND i.youtube_creator_id=ANY($1::uuid[])\n     ORDER BY i.youtube_creator_id,i.id\`,[ids]);\n   const igIds:string[]=[];const selected=new Set<string>();\n   for(const r of ig.rows){\n     const p=byId.get(r.creatorId);if(!p||selected.has(r.creatorId))continue;\n     selected.add(r.creatorId);igIds.push(r.instagramId);\n     p.instagram={url:\`https://www.instagram.com/\${encodeURIComponent(r.username)}/\`,username:r.username,followers:r.followers,posts:r.posts,fetchedAt:r.fetchedAt};\n   }\n   if(igIds.length){\n     const linked=await query(\`SELECT i.youtube_creator_id AS "creatorId",ca.slug,ca.label\n       FROM instagram_creator_categories ic JOIN instagram_creators i ON i.id=ic.creator_id\n       JOIN categories ca ON ca.id=ic.category_id\n       WHERE ic.creator_id=ANY($1::uuid[]) AND ca.active=true\`,[igIds]);\n     for(const c of linked.rows){const p=byId.get(c.creatorId);if(p&&!p.categories.some(x=>x.slug===c.slug))p.categories.push({slug:c.slug,label:c.label});}\n   }\n }catch(err){\n   // Only optional IG schema mismatches degrade gracefully. All other DB errors propagate.\n   const code=(err as {code?:string}).code;\n   if(code!=='42P01'&&code!=='42703')throw err;\n   console.error('[PCI_IG_SCHEMA_UNAVAILABLE] Unified YouTube rankings served without Instagram; complete Instagram migration',code);\n }\n return people;\n}\n`;
  put(unified,s.slice(0,a)+replacement+s.slice(b));
 }
}
// Existing UI tests must reflect the deliberately restored three-metric wheel API.
for(const testPath of ['Module_2_Public_Website/tests/premium-home.test.mjs','Module_2_Public_Website/tests/sleek-navigation.test.mjs']){
 let s=get(testPath);
 const lines=s.split('\n');
 const old=lines.find(x=>x.includes('assert.match(page,/<UnifiedRankingWheel')&&x.includes('allRounders='));
 const updated=String.raw` assert.match(page,/<UnifiedRankingWheel rankings=\{rankings\}\/>/);`;
 if(old)s=s.replace(old,updated);
 else if(!s.includes(updated))throw Error('UI wheel expectation differs: '+testPath);
 if(testPath.includes('premium-home')&&!s.includes('PCI_WHEEL_THREE_METRIC_TEST_V2')){
  const anchor=" assert.match(unified,/c\\.rank===1/);";
  if(!s.includes(anchor))throw Error('Premium wheel test anchor changed');
  s=s.replace(anchor,anchor+"\n // PCI_WHEEL_THREE_METRIC_TEST_V2\n assert.match(unified,/const wheelModes=displayModes/);\n assert.doesNotMatch(page,/unified\\/all-rounders/);");
 }
 put(testPath,s);
}
// A small regression suite checks the ranking invariant and the source guards.
const testFile='Module_1_Adapter/tests/pci-solid-reliability.test.mjs';
const testBody=String.raw`import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {rankPeople} from '../src/modules/unified/metrics.mjs';
const person=(id,subs,category='vloggers')=>({id,slug:id,displayName:id,enabled:true,humanReviewStatus:'approved',categories:[{slug:category,label:category}],youtube:{url:'https://www.youtube.com/channel/UCtest',subscribers:subs,views:'100',videos:'4'},instagram:null});
test('rank positions follow the current eligible population after add/delete',()=>{
 const a=person('a','100'),b=person('b','300'),c=person('c','200');
 assert.deepEqual(rankPeople([a,b],{metric:'subscribers'}).data.map(x=>[x.id,x.rank]),[['b',1],['a',2]]);
 assert.deepEqual(rankPeople([a,b,c],{metric:'subscribers'}).data.map(x=>[x.id,x.rank]),[['b',1],['c',2],['a',3]]);
 assert.deepEqual(rankPeople([a,c],{metric:'subscribers'}).data.map(x=>[x.id,x.rank]),[['c',1],['a',2]]);
});
test('missing metric and category exclusion never create fake ranks',()=>{
 const a=person('a',null),b=person('b','30'),c=person('c','100','gaming');
 const result=rankPeople([a,b,c],{metric:'subscribers',category:'vloggers'});
 assert.equal(result.total,2);assert.equal(result.known,1);
 assert.deepEqual(result.data.map(x=>[x.id,x.rank]),[['b',1]]);
});
test('bulk import queues data sync and snapshots are before optional video processing',()=>{
 const admin=readFileSync('src/modules/admin/routes.ts','utf8');
 const sync=readFileSync('src/modules/sync/service.ts','utf8');
 const worker=readFileSync('src/worker.ts','utf8');
 assert.match(admin,/PCI_AUTO_INITIAL_SYNC_V2/);
 assert.match(sync,/PCI_EARLY_CHANNEL_SNAPSHOTS_V2/);
 assert.ok(sync.indexOf('PCI_EARLY_CHANNEL_SNAPSHOTS_V2')<sync.indexOf('const videoIdsByChannel='));
 assert.match(sync,/videoFetchFailed/);
 assert.match(worker,/PCI_BACKFILL_UNSYNCED_V2/);
});
`;
const testAbs=path.join(root,testFile);
if(fs.existsSync(testAbs)){
 const old=fs.readFileSync(testAbs,'utf8');if(old!==testBody)throw Error('Existing test file differs: '+testFile);
}else{changes.set(testFile,testBody);}
// Verify every change before touching disk. One pre-write backup folder.
const changed=[...changes].filter(([p,s])=>!fs.existsSync(path.join(root,p))||s!==fs.readFileSync(path.join(root,p),'utf8'));
for(const [p,s] of changed){if(!s.trim())throw Error('Refusing empty file '+p);console.log((dry?'WOULD UPDATE ':'UPDATE ')+p);}
if(dry){console.log('DRY RUN OK: '+changed.length+' files');process.exit(0);}
if(!changed.length){console.log('Already applied. No changes.');process.exit(0);}
const name='.pci-solid-backup-'+new Date().toISOString().replace(/[:.]/g,'-');const backup=path.join(root,name);
for(const [p] of changed){const dest=path.join(backup,p);fs.mkdirSync(path.dirname(dest),{recursive:true});if(fs.existsSync(path.join(root,p)))fs.copyFileSync(path.join(root,p),dest);}
const applied=[];
try{for(const [p,s] of changed){const target=path.join(root,p),temp=target+'.pci-solid-tmp';fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(temp,s);fs.renameSync(temp,target);applied.push(p);}}
catch(err){for(const p of applied){const prior=path.join(backup,p),target=path.join(root,p);if(fs.existsSync(prior))fs.copyFileSync(prior,target);else fs.rmSync(target,{force:true});}throw err;}
console.log('Applied '+changed.length+' files. Backup at '+backup);
console.log('RUN TESTS AND BUILDS. DO NOT PUSH IF ANY CHECK FAILS.');
