import {Router} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {handler,HttpError} from '../../lib/errors.js';
import {requireAdmin,roles,audit,type AdminIdentity} from '../auth/auth.js';
import {validateHttpsUrl} from './parse.js';
import {syncSource,testSource,type EventSource} from './service.js';

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
 const r=await query(`SELECT e.id,e.name,e.start_at,e.all_day,e.city,e.category,e.venue,e.latitude,e.longitude,e.description,e.event_url,e.organizer,e.ticket_type,e.price_text,s.name AS source_name
 FROM pci_events e JOIN event_sources s ON s.id=e.source_id
 WHERE e.approved=true AND e.active=true AND e.start_at>=now() AND s.enabled=true AND s.official_confirmed=true AND s.rights_confirmed=true
 AND e.latitude IS NOT NULL AND e.longitude IS NOT NULL
 ORDER BY e.start_at ASC LIMIT 400`);
 res.setHeader('Cache-Control','public, max-age=60');res.json({data:r.rows});
}));
