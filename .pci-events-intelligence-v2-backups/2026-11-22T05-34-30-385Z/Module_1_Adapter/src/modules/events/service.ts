import {pool,query} from '../../lib/db.js';
import {fetchFeed} from './fetch.js';
import {parseJsonFeed,parseRssFeed,parseIcsFeed,normalizeEvent} from './parse.js';
import {logger} from '../../lib/errors.js';
import {classifyEvent} from './classifier.mjs';

export type EventSource={id:string;name:string;feed_type:'rss'|'ics'|'json';feed_url:string;category:string;city_hint:string|null;enabled:boolean;official_confirmed:boolean;rights_confirmed:boolean};
export async function readAndParse(source:EventSource){
 const text=await fetchFeed(source.feed_url);
 const raw=source.feed_type==='rss'?parseRssFeed(text):source.feed_type==='ics'?parseIcsFeed(text):parseJsonFeed(text);
 const accepted:any[]=[];const seen=new Set<string>();let rejected=0;
 for(const event of raw){
  const value=normalizeEvent(event,source);
  if(!value.ok){rejected++;continue;}
  const item=value.item;
  if (!item) continue;  if(seen.has(item.external_id))continue;
  seen.add(item.external_id);
  const classification=classifyEvent({name:item.name,description:item.description,venue:item.venue,sourceCategory:source.category});
  accepted.push({...item,classification_category:classification.category,classification_confidence:classification.confidence,classification_reason:classification.reason,classification_state:classification.state});
 }
 return {accepted,rejected,inspected:raw.length};
}
export async function testSource(source:EventSource){
 const r=await readAndParse(source);
 return {inspected:r.inspected,candidates:r.accepted.length,rejected:r.rejected,geolocated:r.accepted.filter(e=>e.latitude!==null&&e.longitude!==null).length,published:0,note:'Preview only. No event is published until an Owner approves it.'};
}
export async function syncSource(source:EventSource,trigger:'manual'|'scheduled'){
 if(!source.enabled||!source.official_confirmed||!source.rights_confirmed)throw new Error('Enable and confirm official origin and reuse rights before syncing');
 const c=await pool.connect();
 let locked=false;
 try{
  const l=await c.query('SELECT pg_try_advisory_lock(710330,hashtext($1)) AS locked',[source.id]);
  if(!l.rows[0].locked)throw new Error('This source is already syncing');locked=true;
  const {accepted,rejected,inspected}=await readAndParse(source);
  await c.query('BEGIN');
  try{
   for(const item of accepted){
    await c.query(`INSERT INTO pci_events(source_id,external_id,name,start_at,all_day,city,category,venue,latitude,longitude,description,event_url,organizer,ticket_type,price_text,fingerprint,approved,active,classification_category,classification_confidence,classification_reason,classification_state,review_decision,classified_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,false,true,$17,$18,$19,$20,'pending',now())
     ON CONFLICT(source_id,external_id) DO UPDATE SET
     name=EXCLUDED.name,start_at=EXCLUDED.start_at,all_day=EXCLUDED.all_day,city=EXCLUDED.city,category=EXCLUDED.category,
     venue=EXCLUDED.venue,latitude=COALESCE(EXCLUDED.latitude,pci_events.latitude),longitude=COALESCE(EXCLUDED.longitude,pci_events.longitude),
     description=EXCLUDED.description,event_url=EXCLUDED.event_url,organizer=EXCLUDED.organizer,
     ticket_type=EXCLUDED.ticket_type,price_text=EXCLUDED.price_text,
     approved=CASE WHEN pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.approved ELSE false END,
     fingerprint=EXCLUDED.fingerprint,active=true,
     classification_category=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_category ELSE EXCLUDED.classification_category END,
     classification_confidence=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_confidence ELSE EXCLUDED.classification_confidence END,
     classification_reason=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_reason ELSE EXCLUDED.classification_reason END,
     classification_state=CASE WHEN pci_events.classification_state='manual' AND pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.classification_state ELSE EXCLUDED.classification_state END,
     review_decision=CASE WHEN pci_events.fingerprint=EXCLUDED.fingerprint THEN pci_events.review_decision ELSE 'pending' END,
     classified_at=now(),last_seen_at=now(),updated_at=now()`,
     [source.id,item.external_id,item.name,item.start_at,item.all_day,item.city,item.category,item.venue,item.latitude,item.longitude,item.description,item.event_url,item.organizer,item.ticket_type,item.price_text,item.fingerprint,item.classification_category,item.classification_confidence,item.classification_reason,item.classification_state]);
   }
   await c.query(`UPDATE event_sources SET last_status='success',last_sync_at=now(),last_success_at=now(),last_error=NULL,last_imported=$2,updated_at=now() WHERE id=$1`,[source.id,accepted.length]);
   await c.query(`INSERT INTO event_source_runs(source_id,trigger,status,imported,rejected,detail) VALUES($1,$2,'success',$3,$4,$5)`,[source.id,trigger,accepted.length,rejected,`${inspected} input entries; all entries require human review`]);
   await c.query('COMMIT');
  }catch(err){await c.query('ROLLBACK');throw err;}
  return {inspected,imported:accepted.length,rejected,note:'Imported events are pending review; the public map shows only approved records.'};
 }catch(error){
  const message=error instanceof Error?error.message:'Unknown feed failure';
  try{
   await query(`UPDATE event_sources SET last_status='error',last_sync_at=now(),last_error=$2 WHERE id=$1`,[source.id,message.slice(0,400)]);
   await query(`INSERT INTO event_source_runs(source_id,trigger,status,detail) VALUES($1,$2,'error',$3)`,[source.id,trigger,message.slice(0,400)]);
  }catch(e){logger.error({err:e},'Event source error persistence failed');}
  throw error;
 }finally{
  try{if(locked)await c.query('SELECT pg_advisory_unlock(710330,hashtext($1))',[source.id]);}finally{c.release();}
 }
}
export async function syncApprovedEventSources(){
 const r=await query<EventSource>(`SELECT * FROM event_sources WHERE enabled=true AND official_confirmed=true AND rights_confirmed=true ORDER BY updated_at DESC LIMIT 30`);
 let done=0,failed=0;
 for(const source of r.rows){try{await syncSource(source,'scheduled');done++;}catch(e){failed++;logger.warn({err:e,sourceId:source.id},'Scheduled event-source sync failed');}}
 return {done,failed};
}
