/** PCI Events Intelligence v2 — directory, controlled discovery and tamper-evident soft deletion.
 * Mounted INSIDE the existing authenticated/CSRF-protected admin Events router.
 */
import {Router} from 'express';
import {z} from 'zod';
import {pool} from '../../lib/db.js';
import {handler,HttpError,logger} from '../../lib/errors.js';
import {roles,audit,type AdminIdentity} from '../auth/auth.js';
import {OFFICIAL_EVENT_DIRECTORY} from './directory.js';
import {discoverCategory,DISCOVERY_CATEGORIES} from './discovery.js';

export const eventsIntegrationsRoutes=Router();
const originSchema=z.enum(['feed','editorial']);
const idSchema=z.string().uuid();
const reasonSchema=z.string().trim().min(5).max(240);
const deletionSchema=z.object({confirm:z.literal('DELETE'),reason:reasonSchema}).strict();
const restoreSchema=z.object({confirm:z.literal('RESTORE'),reason:reasonSchema}).strict();

eventsIntegrationsRoutes.get('/directory',(_req,res)=>{
 res.setHeader('Cache-Control','no-store');
 res.json({data:OFFICIAL_EVENT_DIRECTORY,meta:{disclaimer:'Official announcement pages are discovery/verification sources, not machine-readable APIs. Only permission-checked JSON, RSS and ICS feeds may be configured for import.'}});
});

eventsIntegrationsRoutes.get('/discover',handler(async(req,res)=>{
 const {category}=z.object({category:z.string().refine(value=>DISCOVERY_CATEGORIES.includes(value),'Unknown discovery category')}).strict().parse(req.query);
 const result=await discoverCategory(category);
 res.setHeader('Cache-Control','no-store');res.json({data:result});
}));

/** Owner-only reversible deletion, written with an atomic immutable change-log entry.
 * Deleted feed events remain tombstoned under source+external_id and cannot be revived by sync.
 */
async function mutateDeleted(origin:'feed'|'editorial',id:string,actorId:string,mode:'delete'|'restore',reason:string){
 const table=origin==='feed'?'pci_events':'pci_editorial_events';
 const c=await pool.connect();
 try{
  await c.query('BEGIN');
  const found=await c.query(`SELECT id,deleted_at FROM ${table} WHERE id=$1 FOR UPDATE`,[id]);
  if(!found.rows[0])throw new HttpError(404,'EVENT_NOT_FOUND','Event does not exist');
  if(mode==='delete'&&found.rows[0].deleted_at)throw new HttpError(409,'EVENT_ALREADY_DELETED','Event was already deleted');
  if(mode==='restore'&&!found.rows[0].deleted_at)throw new HttpError(409,'EVENT_NOT_DELETED','Event is not deleted');
  if(mode==='delete'){
   if(origin==='feed')await c.query(`UPDATE pci_events SET approved=false,active=false,deleted_at=now(),deleted_by=$2,deletion_reason=$3,review_decision='rejected',updated_at=now() WHERE id=$1`,[id,actorId,reason]);
   else await c.query(`UPDATE pci_editorial_events SET approved=false,deleted_at=now(),deleted_by=$2,deletion_reason=$3,review_decision='rejected',updated_at=now() WHERE id=$1`,[id,actorId,reason]);
  }else{
   if(origin==='feed')await c.query(`UPDATE pci_events SET approved=false,active=true,deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL,review_decision='pending',updated_at=now() WHERE id=$1`,[id]);
   else await c.query(`UPDATE pci_editorial_events SET approved=false,deleted_at=NULL,deleted_by=NULL,deletion_reason=NULL,review_decision='pending',updated_at=now() WHERE id=$1`,[id]);
  }
  await c.query(`INSERT INTO pci_event_action_log(event_id,origin,actor_id,action,reason) VALUES($1,$2,$3,$4,$5)`,[id,origin,actorId,mode,reason]);
  await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}
 finally{c.release();}
 return {id,origin,deleted:mode==='delete',approved:false,requires_reapproval:true};
}
eventsIntegrationsRoutes.delete('/bucket/:origin/:id',roles('owner'),handler(async(req,res)=>{
 const origin=originSchema.parse(req.params.origin),id=idSchema.parse(req.params.id);
 const {reason}=deletionSchema.parse(req.body);
 const actorId=(res.locals.admin as AdminIdentity).id;
 const result=await mutateDeleted(origin,id,actorId,'delete',reason);
 // The durable action log above is committed atomically with deletion.
 // Existing system audit is additional traceability and never replaces that log.
 try{await audit(actorId,'events.intelligence.delete',id,{origin,reason});}catch(err){logger.error({err,id},'Secondary event audit unavailable; immutable action log is committed');}
 res.setHeader('Cache-Control','no-store');res.json({data:result});
}));
eventsIntegrationsRoutes.post('/bucket/:origin/:id/restore',roles('owner'),handler(async(req,res)=>{
 const origin=originSchema.parse(req.params.origin),id=idSchema.parse(req.params.id);
 const {reason}=restoreSchema.parse(req.body);
 const actorId=(res.locals.admin as AdminIdentity).id;
 const result=await mutateDeleted(origin,id,actorId,'restore',reason);
 try{await audit(actorId,'events.intelligence.restore',id,{origin,reason});}catch(err){logger.error({err,id},'Secondary event audit unavailable; immutable action log is committed');}
 res.setHeader('Cache-Control','no-store');res.json({data:result});
}));
