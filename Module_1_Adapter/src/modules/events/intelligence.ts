/** Isolated PCI Events Intelligence management APIs: no creator/satellite dependencies.
 * Mounted beneath existing /api/v1/admin/events authentication and CSRF middleware.
 */
import {Router} from 'express';
import {z} from 'zod';
import {query,pool} from '../../lib/db.js';
import {handler,HttpError,logger} from '../../lib/errors.js';
import {roles,audit,type AdminIdentity} from '../auth/auth.js';
import {classifyEvent,EVENT_CATEGORIES,canonicalCategory,ENGINE_VERSION} from './classifier.mjs';

export const intelligenceRoutes=Router();
const uuid=z.string().uuid();
const canonicalIds=EVENT_CATEGORIES.map((c:{id:string})=>c.id);
const categories=new Set(canonicalIds);
const geoBounds:Record<string,[number,number,number,number]>={
 Karachi:[24.6,25.3,66.6,67.5],Lahore:[31.1,31.8,74,74.7],Islamabad:[33.4,33.9,72.7,73.5]
};
const effectiveCategory=(expr:string)=>`COALESCE(${expr}.classification_category, CASE ${expr}.category WHEN 'expos' THEN 'business' WHEN 'conferences' THEN 'education' ELSE ${expr}.category END)`;
intelligenceRoutes.get('/categories',(_req,res)=>res.json({data:{engineVersion:ENGINE_VERSION,categories:EVENT_CATEGORIES}}));

intelligenceRoutes.get('/overview',handler(async(_req,res)=>{
 const [counts,sources,breakdown]=await Promise.all([
  query(`SELECT COUNT(*)::int AS total,
   COUNT(*) FILTER(WHERE e.approved AND e.active AND e.start_at>now() AND s.enabled AND s.official_confirmed AND s.rights_confirmed)::int AS published,
   COUNT(*) FILTER(WHERE NOT e.approved AND e.active AND e.start_at>now() AND e.review_decision<>'rejected')::int AS pending,
   COUNT(*) FILTER(WHERE e.review_decision='rejected')::int AS rejected,
   COUNT(*) FILTER(WHERE e.classification_category IS NULL)::int AS unclassified,
   COUNT(*) FILTER(WHERE e.classification_state='needs_review' AND e.start_at>now())::int AS ambiguous
   FROM pci_events e JOIN event_sources s ON s.id=e.source_id`),
  query(`SELECT id,name,feed_type,enabled,official_confirmed,rights_confirmed,last_status,last_error,
   last_sync_at,last_success_at,last_imported,
   (last_success_at IS NOT NULL AND last_success_at>=now()-interval '48 hours') AS recently_healthy
   FROM event_sources ORDER BY name LIMIT 100`),
  query(`SELECT category,COUNT(*)::int AS total,COUNT(*) FILTER(WHERE approved AND end_at>now())::int AS published
   FROM (
    SELECT ${effectiveCategory('e')} AS category,(e.approved AND s.enabled AND s.official_confirmed AND s.rights_confirmed) AS approved,e.start_at AS end_at FROM pci_events e JOIN event_sources s ON s.id=e.source_id WHERE e.active
    UNION ALL
    SELECT CASE p.category WHEN 'expos' THEN 'business' WHEN 'conferences' THEN 'education' ELSE p.category END,
     p.approved,p.end_at FROM pci_editorial_events p
   ) all_categories GROUP BY category ORDER BY total DESC`)
 ]);
 const editorial=await query(`SELECT COUNT(*)::int AS total,
  COUNT(*) FILTER(WHERE approved AND end_at>now())::int AS published
  FROM pci_editorial_events`);
 res.setHeader('Cache-Control','no-store');
 res.json({data:{counts:{...counts.rows[0],editorial_total:editorial.rows[0]?.total??0,
  editorial_published:editorial.rows[0]?.published??0},categories:EVENT_CATEGORIES,breakdown:breakdown.rows,sources:sources.rows,
  engineVersion:ENGINE_VERSION,safety:{automaticPublication:false,manualReviewRequired:true,sourceRightsRequired:true}}});
}));

const bucketQuery=z.object({category:z.string().max(32).default('all'),status:z.enum(['all','pending','published','rejected','expired']).default('all'),
 search:z.string().trim().max(100).default(''),limit:z.coerce.number().int().min(1).max(100).default(50),
 offset:z.coerce.number().int().min(0).max(2000).default(0)});
intelligenceRoutes.get('/bucket',handler(async(req,res)=>{
 const filters=bucketQuery.parse(req.query);
 if(filters.category!=='all'&&!categories.has(filters.category))throw new HttpError(400,'INVALID_CATEGORY','Unknown event category');
 const search=filters.search.replace(/[\\%_]/g,'\\$&');
 const result=await query(`WITH all_entries AS (
  SELECT e.id,'feed'::text AS origin,e.name,e.city,e.venue,e.start_at,e.start_at AS end_at,e.latitude,e.longitude,
   ${effectiveCategory('e')} AS category,e.classification_confidence AS confidence,e.classification_state AS classification_state,
   e.classification_reason AS reason,e.approved,e.review_decision,
   e.event_url AS source_url,s.name AS source_name,
   (s.enabled AND s.official_confirmed AND s.rights_confirmed) AS source_ready
  FROM pci_events e JOIN event_sources s ON s.id=e.source_id WHERE e.active
  UNION ALL
  SELECT p.id,'editorial'::text,p.name,p.city,p.venue,p.start_at,p.end_at,p.latitude,p.longitude,
   CASE p.category WHEN 'expos' THEN 'business' WHEN 'conferences' THEN 'education' ELSE p.category END,
   100::integer,'manual'::text,'Human-confirmed organizer announcement'::text,p.approved,
   CASE WHEN p.approved THEN 'approved' ELSE p.review_decision END,p.source_url,
   'PCI editorial'::text,true
  FROM pci_editorial_events p
 ) SELECT *, (COUNT(*) OVER(PARTITION BY LOWER(name),date_trunc('day',start_at AT TIME ZONE 'Asia/Karachi'),city)>1) AS possible_duplicate FROM all_entries
 WHERE ($1='all' OR category=$1)
 AND ($2='all' OR CASE
  WHEN $2='expired' THEN end_at<now()
  WHEN $2='published' THEN approved AND source_ready AND end_at>=now()
  WHEN $2='rejected' THEN NOT approved AND review_decision='rejected'
  ELSE NOT approved AND review_decision<>'rejected' AND end_at>=now() END)
 AND ($3='' OR name ILIKE $3 ESCAPE '\\' OR venue ILIKE $3 ESCAPE '\\')
 ORDER BY CASE WHEN start_at<now() THEN 1 ELSE 0 END,start_at ASC,id ASC LIMIT $4 OFFSET $5`,
 [filters.category,filters.status,search?`%${search}%`:'',filters.limit,filters.offset]);
 res.setHeader('Cache-Control','no-store');res.json({data:result.rows,meta:{limit:filters.limit,offset:filters.offset}});
}));

const change=z.object({category:z.string().max(32),decision:z.enum(['categorize','approve','reject','review']).default('categorize')}).strict();
intelligenceRoutes.patch('/bucket/:origin/:id',roles('owner'),handler(async(req,res)=>{
 const origin=z.enum(['feed','editorial']).parse(req.params.origin);
 const id=uuid.parse(req.params.id);
 const b=change.parse(req.body);
 if(!categories.has(b.category))throw new HttpError(422,'INVALID_CATEGORY','Unknown event category');
 const actor=(res.locals.admin as AdminIdentity).id;
 if(origin==='feed'){
  const current=await query(`SELECT e.*,s.enabled,s.official_confirmed,s.rights_confirmed
   FROM pci_events e JOIN event_sources s ON s.id=e.source_id WHERE e.id=$1`,[id]);
  const e=current.rows[0];
  if(!e)throw new HttpError(404,'EVENT_NOT_FOUND','Event not found');
  if(b.decision==='approve'){
   const bounds=geoBounds[e.city];
   if(!e.enabled||!e.official_confirmed||!e.rights_confirmed)
    throw new HttpError(409,'SOURCE_NOT_APPROVED','Enable and verify source origin and reuse rights first');
   if(!bounds||typeof e.latitude!=='number'||typeof e.longitude!=='number'||
     e.latitude<bounds[0]||e.latitude>bounds[1]||e.longitude<bounds[2]||e.longitude>bounds[3])
    throw new HttpError(422,'VENUE_COORDINATES','Verify the actual venue coordinates in Event sources first');
   if(new Date(e.start_at).getTime()<=Date.now())throw new HttpError(422,'EVENT_EXPIRED','Expired events cannot be published');
  }
  const approved=b.decision==='approve'?true:b.decision==='categorize'?(e.approved&&canonicalCategory(e.classification_category||e.category)===b.category):false;
  const decision=b.decision==='reject'?'rejected':approved?'approved':'pending';
  const update=await query(`UPDATE pci_events SET classification_category=$2,classification_confidence=100,
   classification_state='manual',classification_reason='Owner category override',classified_at=now(),
   approved=$3,review_decision=$4,updated_at=now() WHERE id=$1 RETURNING id`,[id,b.category,approved,decision]);
  await audit(actor,'events.intelligence.review',id,{origin,category:b.category,decision:b.decision});
  res.json({data:{id:update.rows[0].id,category:b.category,approved,review_decision:decision}});return;
 }
 const current=await query('SELECT * FROM pci_editorial_events WHERE id=$1',[id]);
 const e=current.rows[0];if(!e)throw new HttpError(404,'EDITORIAL_NOT_FOUND','Editorial event not found');
 if(b.decision==='approve'&&new Date(e.end_at).getTime()<=Date.now())throw new HttpError(422,'EVENT_EXPIRED','Expired events cannot be published');
 const previous=canonicalCategory(e.category);
 const approved=b.decision==='approve'?true:b.decision==='categorize'?(e.approved&&previous===b.category):false;
 await query('UPDATE pci_editorial_events SET category=$2,approved=$3,review_decision=$4,updated_at=now() WHERE id=$1',[id,b.category,approved,b.decision==='reject'?'rejected':approved?'approved':'pending']);
 await audit(actor,'events.intelligence.editorial_review',id,{origin,category:b.category,decision:b.decision});
 res.json({data:{id,category:b.category,approved,review_decision:approved?'approved':b.decision==='reject'?'rejected':'pending'}});
}));

/** Backfill only unclassified rows; never alter publication or manual overrides. */
export async function classifyPendingEvents(limit=100){
 const count=Math.min(100,Math.max(1,Math.floor(limit)));
 const client=await pool.connect();let locked=false;
 try{
  const claim=await client.query('SELECT pg_try_advisory_lock(710331) AS ok');
  if(!claim.rows[0]?.ok)return {processed:0,alreadyRunning:true};
  locked=true;
  const rows=await client.query(`SELECT e.id,e.name,e.description,e.venue,s.category AS source_category
   FROM pci_events e JOIN event_sources s ON s.id=e.source_id
   WHERE e.classification_category IS NULL AND e.start_at>=now()-interval '30 days'
   ORDER BY e.created_at ASC LIMIT $1`,[count]);
  let processed=0;
  for(const row of rows.rows){
   try{
    const c=classifyEvent({name:row.name,description:row.description,venue:row.venue,sourceCategory:row.source_category});
    await client.query(`UPDATE pci_events SET classification_category=$2,classification_confidence=$3,
     classification_reason=$4,classification_state=$5,classified_at=now()
     WHERE id=$1 AND classification_category IS NULL`,[row.id,c.category,c.confidence,c.reason,c.state]);
    processed++;
   }catch(error){logger.warn({eventId:row.id,err:error},'Events classification backfill skipped row');}
  }
  return {processed,alreadyRunning:false};
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(710331)');}finally{client.release();}}
}
intelligenceRoutes.post('/classify-pending',roles('owner'),handler(async(_req,res)=>{
 const result=await classifyPendingEvents();res.json({data:result});
}));
