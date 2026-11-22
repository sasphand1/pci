import {Router} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {requireAdmin,roles,audit,type AdminIdentity} from '../auth/auth.js';
import {validateHttpsUrl} from './parse.js';
import {syncSource,testSource,type EventSource} from './service.js';
import {EVENT_FEED_CATALOG,catalogEntry,catalogSourceInput} from './catalog.js';

export const publicEventsRoutes=Router();
export const adminEventsRoutes=Router();
const uuid=z.string().uuid();
const city=z.enum(['Karachi','Lahore','Islamabad']);
const category=z.enum(['sports','arts','expos','conferences','community']);
const input=z.object({
 name:z.string().trim().min(2).max(140),feed_type:z.enum(['rss','ics','json']),feed_url:z.string().trim().min(12).max(1900),category,
 city_hint:city.nullable(),enabled:z.boolean(),official_confirmed:z.boolean(),rights_confirmed:z.boolean()
}).strict();
function safeSource(body:unknown){const v=input.parse(body);try{validateHttpsUrl(v.feed_url);}catch(e){throw new HttpError(400,'FEED_URL_UNSAFE',String(e instanceof Error?e.message:e));}return v;}
async function sourceById(id:string){const r=await query<EventSource>('SELECT * FROM event_sources WHERE id=$1',[id]);if(!r.rows[0])throw new HttpError(404,'SOURCE_NOT_FOUND','Unknown event source');return r.rows[0];}
const actor=(res:any)=>(res.locals.admin as AdminIdentity).id;
adminEventsRoutes.use(requireAdmin,roles('owner','editor'));
// Editorial notices are individual owner-confirmed records, not third-party feed imports.
// An explicit source link and a venue coordinate check are required before publication.
const editorialBounds:Record<string,[number,number,number,number]>={Karachi:[24.6,25.3,66.6,67.5],Lahore:[31.1,31.8,74,74.7],Islamabad:[33.4,33.9,72.7,73.5]};
const editorialInput=z.object({
 name:z.string().trim().min(4).max(180),
 start_at:z.string().datetime({offset:true}),end_at:z.string().datetime({offset:true}),
 city,category,venue:z.string().trim().min(3).max(200),
 latitude:z.number().finite(),longitude:z.number().finite(),
 source_url:z.string().url().max(1900),
 organizer:z.string().trim().max(160).default(''),
 description:z.string().trim().max(500).default(''),
 confirmed_official:z.literal(true)
}).strict();
adminEventsRoutes.get('/editorial',handler(async(_req,res)=>{
 const r=await query(`SELECT id,name,start_at,end_at,city,category,venue,latitude,longitude,source_url,organizer,approved,verified_at
 FROM pci_editorial_events WHERE end_at>=now()-interval '30 days' ORDER BY start_at LIMIT 200`);
 res.json({data:r.rows});
}));
adminEventsRoutes.post('/editorial',roles('owner'),handler(async(req,res)=>{
 const event=editorialInput.parse(req.body);
 if(!event.source_url.startsWith('https://')||!new URL(event.source_url).hostname.includes('.'))
   throw new HttpError(400,'SOURCE_URL_REQUIRED','Provide a genuine HTTPS organizer or venue announcement');
 const start=Date.parse(event.start_at),end=Date.parse(event.end_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<=Date.now()||end<=start)
   throw new HttpError(422,'INVALID_EVENT_DATE','Event must start in the future and end after it starts');
 const box=editorialBounds[event.city];
 if(!box||event.latitude<box[0]||event.latitude>box[1]||event.longitude<box[2]||event.longitude>box[3])
   throw new HttpError(422,'VENUE_COORDINATES','Verify the real event venue location; city centre coordinates are not a substitute');
 const created=await query(`INSERT INTO pci_editorial_events
 (name,start_at,end_at,city,category,venue,latitude,longitude,source_url,organizer,description,approved)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true)
 ON CONFLICT(name,start_at,city) DO UPDATE SET end_at=EXCLUDED.end_at,category=EXCLUDED.category,venue=EXCLUDED.venue,
 latitude=EXCLUDED.latitude,longitude=EXCLUDED.longitude,source_url=EXCLUDED.source_url,organizer=EXCLUDED.organizer,
 description=EXCLUDED.description,approved=true,verified_at=now(),updated_at=now()
 RETURNING *`,[event.name,event.start_at,event.end_at,event.city,event.category,event.venue,event.latitude,event.longitude,event.source_url,event.organizer,event.description]);
 await audit(actor(res),'events.editorial.publish',created.rows[0].id,{sourceUrl:event.source_url,city:event.city});
 res.status(201).json({data:created.rows[0]});
}));
adminEventsRoutes.patch('/editorial/:id/visibility',roles('owner'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);const {approved}=z.object({approved:z.boolean()}).strict().parse(req.body);
 const updated=await query('UPDATE pci_editorial_events SET approved=$2,updated_at=now() WHERE id=$1 RETURNING *',[id,approved]);
 if(!updated.rows[0])throw new HttpError(404,'EDITORIAL_NOT_FOUND','Editorial event not found');
 await audit(actor(res),'events.editorial.visibility',id,{approved});
 res.json({data:updated.rows[0]});
}));
// Provider presets contain genuine endpoint URLs, not events or implied permissions.
adminEventsRoutes.get('/catalog',(_req,res)=>res.json({data:EVENT_FEED_CATALOG}));
adminEventsRoutes.post('/catalog/:key/test',roles('owner'),handler(async(req,res)=>{
 const preset=catalogEntry(req.params.key);
 if(!preset)throw new HttpError(404,'CATALOG_SOURCE_UNKNOWN','Unknown public data feed');
 try{res.json({data:await testSource(catalogSourceInput(preset))});}
 catch(e){throw new HttpError(422,'CATALOG_TEST_FAILED',e instanceof Error?e.message:'Provider cannot be read');}
}));
adminEventsRoutes.post('/catalog/:key/install',roles('owner'),handler(async(req,res)=>{
 const preset=catalogEntry(req.params.key);
 if(!preset)throw new HttpError(404,'CATALOG_SOURCE_UNKNOWN','Unknown public data feed');
 const previous=await query('SELECT * FROM event_sources WHERE feed_url=$1 ORDER BY created_at LIMIT 1',[preset.feed_url]);
 if(previous.rows[0])return res.json({data:previous.rows[0],alreadyInstalled:true});
 // All new sources are disabled. The owner must verify rights, content and origin.
 const result=await query(`INSERT INTO event_sources(name,feed_type,feed_url,category,city_hint,enabled,official_confirmed,rights_confirmed)
 VALUES($1,$2,$3,$4,$5,false,false,false) RETURNING *`,
 [preset.name,preset.feed_type,preset.feed_url,preset.category,preset.city_hint]);
 await audit(actor(res),'events.catalog.install',result.rows[0].id,{key:preset.key});
 res.status(201).json({data:result.rows[0],alreadyInstalled:false});
}));
adminEventsRoutes.get('/sources',handler(async(_req,res)=>{
 const r=await query(`SELECT s.*, (SELECT COUNT(*)::int FROM pci_events e WHERE e.source_id=s.id) AS total_events,
  (SELECT COUNT(*)::int FROM pci_events e WHERE e.source_id=s.id AND e.approved) AS reviewed_events
  FROM event_sources s ORDER BY s.name ASC`);
 res.json({data:r.rows});
}));
adminEventsRoutes.post('/sources',roles('owner'),handler(async(req,res)=>{
 const s=safeSource(req.body);
 const r=await query(`INSERT INTO event_sources(name,feed_type,feed_url,category,city_hint,enabled,official_confirmed,rights_confirmed)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[s.name,s.feed_type,s.feed_url,s.category,s.city_hint,s.enabled,s.official_confirmed,s.rights_confirmed]);
 await audit(actor(res),'events.source.create',r.rows[0].id,{name:s.name,feed_type:s.feed_type});
 res.status(201).json({data:r.rows[0]});
}));
adminEventsRoutes.patch('/sources/:id',roles('owner'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);const s=safeSource(req.body);const previous=await sourceById(id);
 const r=await query(`UPDATE event_sources SET name=$2,feed_type=$3,feed_url=$4,category=$5,city_hint=$6,enabled=$7,
 official_confirmed=$8,rights_confirmed=$9,updated_at=now() WHERE id=$1 RETURNING *`,
 [id,s.name,s.feed_type,s.feed_url,s.category,s.city_hint,s.enabled,s.official_confirmed,s.rights_confirmed]);
 // Provenance changes require renewed event review before publication.
 if(previous.feed_url!==s.feed_url||previous.feed_type!==s.feed_type||previous.category!==s.category||previous.city_hint!==s.city_hint)
  await query(`UPDATE pci_events SET approved=false,updated_at=now() WHERE source_id=$1`,[id]);
 await audit(actor(res),'events.source.update',id,{name:s.name,enabled:s.enabled,official_confirmed:s.official_confirmed,rights_confirmed:s.rights_confirmed});
 res.json({data:r.rows[0]});
}));
adminEventsRoutes.post('/sources/:id/test',roles('owner'),handler(async(req,res)=>{
 const source=await sourceById(uuid.parse(req.params.id));
 try{res.json({data:await testSource(source)});}catch(e){throw new HttpError(422,'FEED_TEST_FAILED',e instanceof Error?e.message:'Feed test failed');}
}));
adminEventsRoutes.post('/sources/:id/sync',roles('owner'),handler(async(req,res)=>{
 const source=await sourceById(uuid.parse(req.params.id));
 if(!source.enabled||!source.official_confirmed||!source.rights_confirmed)throw new HttpError(409,'SOURCE_NOT_APPROVED','Enable the source and confirm official origin and data reuse rights');
 try{const r=await syncSource(source,'manual');await audit(actor(res),'events.source.sync',source.id,{imported:r.imported,rejected:r.rejected});res.json({data:r});}
 catch(e){throw new HttpError(422,'FEED_SYNC_FAILED',e instanceof Error?e.message:'Feed sync failed');}
}));
adminEventsRoutes.get('/list',handler(async(req,res)=>{
 const limit=z.coerce.number().int().min(1).max(300).default(100).parse(req.query.limit);
 const r=await query(`SELECT e.*,s.name AS source_name,s.feed_url AS source_feed_url,s.enabled AS source_enabled
 FROM pci_events e JOIN event_sources s ON s.id=e.source_id
 WHERE e.start_at>=now()-interval '1 day' ORDER BY e.approved ASC,e.start_at ASC LIMIT $1`,[limit]);
 res.json({data:r.rows});
}));
adminEventsRoutes.patch('/list/:id',roles('owner'),handler(async(req,res)=>{
 const id=uuid.parse(req.params.id);
 const b=z.object({approved:z.boolean(),latitude:z.number().min(23).max(35).nullable(),longitude:z.number().min(66).max(76).nullable()}).strict().parse(req.body);
 const current=await query(`SELECT e.*,s.official_confirmed,s.rights_confirmed,s.enabled FROM pci_events e JOIN event_sources s ON s.id=e.source_id WHERE e.id=$1`,[id]);
 const e=current.rows[0];if(!e)throw new HttpError(404,'EVENT_NOT_FOUND','Event does not exist');
 const bounds:{[key:string]:[number,number,number,number]}={Karachi:[24.6,25.3,66.6,67.5],Lahore:[31.1,31.8,74.0,74.7],Islamabad:[33.4,33.9,72.7,73.5]};
 const box=bounds[e.city];
 if(b.approved){
  if(!e.enabled||!e.official_confirmed||!e.rights_confirmed)throw new HttpError(409,'SOURCE_NOT_APPROVED','Source is not verified and enabled');
  if(b.latitude===null||b.longitude===null||!box||b.latitude<box[0]||b.latitude>box[1]||b.longitude<box[2]||b.longitude>box[3])throw new HttpError(400,'COORDINATES_REQUIRED','Verified coordinates within this city are required to publish');
 }
 const result=await query('UPDATE pci_events SET approved=$2,latitude=$3,longitude=$4,updated_at=now() WHERE id=$1 RETURNING *',[id,b.approved,b.latitude,b.longitude]);
 await audit(actor(res),'events.item.review',id,{approved:b.approved,coordinatesEdited:b.latitude!==e.latitude||b.longitude!==e.longitude});
 res.json({data:result.rows[0]});
}));
adminEventsRoutes.get('/runs',handler(async(_req,res)=>{
 const r=await query('SELECT r.*,s.name AS source_name FROM event_source_runs r JOIN event_sources s ON s.id=r.source_id ORDER BY r.created_at DESC LIMIT 50');res.json({data:r.rows});
}));
publicEventsRoutes.get('/events',handler(async(_req,res)=>{
 // Source feeds are restricted to approved, geolocated, future entries.
 const [feed,editorial,status]=await Promise.all([
  query(`SELECT e.id,e.name,e.start_at,e.start_at AS end_at,e.all_day,e.city,e.category,e.venue,e.latitude,e.longitude,e.description,e.event_url,e.organizer,e.ticket_type,e.price_text,s.name AS source_name
   FROM pci_events e JOIN event_sources s ON s.id=e.source_id
   WHERE e.approved=true AND e.active=true AND e.start_at>=now() AND s.enabled=true AND s.official_confirmed=true AND s.rights_confirmed=true
   AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL ORDER BY e.start_at ASC LIMIT 400`),
  query(`SELECT id,name,start_at,end_at,false AS all_day,city,category,venue,latitude,longitude,description,
   source_url AS event_url,organizer,'unknown'::text AS ticket_type,''::text AS price_text,
   'PCI editorial · verified official source'::text AS source_name
   FROM pci_editorial_events WHERE approved=true AND end_at>now() ORDER BY start_at ASC LIMIT 200`),
  query(`SELECT (SELECT COUNT(*)::int FROM event_sources) AS sources_configured,
   (SELECT COUNT(*)::int FROM event_sources WHERE enabled AND official_confirmed AND rights_confirmed) AS sources_enabled,
   (SELECT COUNT(*)::int FROM pci_events WHERE approved=false AND active AND start_at>=now()) AS awaiting_review`)
 ]);
 const data=[...feed.rows,...editorial.rows].sort((a,b)=>new Date(a.start_at).valueOf()-new Date(b.start_at).valueOf());
 res.setHeader('Cache-Control','public, max-age=60');
 res.json({data,meta:{...status.rows[0],editorial_published:editorial.rows.length,feed_published:feed.rows.length}});
}));
