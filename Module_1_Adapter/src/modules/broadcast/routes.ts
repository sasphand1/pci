import {createHash,timingSafeEqual} from 'node:crypto';
import {Router} from 'express';
import {z} from 'zod';
import {handler,HttpError} from '../../lib/errors.js';
import {requireAdmin,roles,type AdminIdentity} from '../auth/auth.js';
import {destinations} from './model.js';
import {cancelJob,claimDelivery,confirmJob,createDraft,getJob,listJobs,lookupClaim,recordReceipt} from './service.js';

const uuid=z.string().uuid();
const destination=z.enum(destinations);
const assetRef=z.string().trim().min(1).max(512).regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/).refine(ref=>ref.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'),'Use a controlled asset reference, not a URL or filesystem traversal');
const draft=z.object({requestId:uuid,title:z.string().trim().min(1).max(160),body:z.string().trim().max(5000),mediaRef:assetRef.nullable(),destinations:z.array(destination).min(1).max(destinations.length).refine(d=>new Set(d).size===d.length,'Duplicate destinations')}).strict();
const confirmation=z.object({confirm:z.literal(true)}).strict();
const receipt=z.object({claimId:uuid,outcome:z.enum(['delivered','failed','uncertain']),externalId:z.string().trim().min(1).max(512).nullable(),code:z.string().regex(/^[A-Za-z0-9_.-]{1,100}$/).nullable()}).strict().refine(r=>r.outcome==='delivered'?r.externalId!==null:r.externalId===null&&r.code!==null,'Delivery requires provider ID; failures require a code');
const digest=(s:string)=>createHash('sha256').update(s).digest();
function dispatchToken(){const t=process.env.PCI_BROADCAST_DISPATCH_TOKEN??'';return t.length>=32&&t.length<=256?t:null;}
export const broadcastAdminRoutes=Router();
broadcastAdminRoutes.use(requireAdmin,roles('owner','editor'));
broadcastAdminRoutes.get('/',handler(async(_req,res)=>{res.json({data:{jobs:await listJobs(),dispatchConfigured:Boolean(dispatchToken()),destinations}});}));
broadcastAdminRoutes.post('/',handler(async(req,res)=>{res.status(201).json({data:await createDraft((res.locals.admin as AdminIdentity).id,draft.parse(req.body))});}));
broadcastAdminRoutes.get('/:id',handler(async(req,res)=>{res.json({data:await getJob(uuid.parse(req.params.id))});}));
broadcastAdminRoutes.post('/:id/confirm',handler(async(req,res)=>{confirmation.parse(req.body);res.json({data:await confirmJob(uuid.parse(req.params.id),(res.locals.admin as AdminIdentity).id)});}));
broadcastAdminRoutes.post('/:id/cancel',handler(async(req,res)=>{confirmation.parse(req.body);res.json({data:await cancelJob(uuid.parse(req.params.id),(res.locals.admin as AdminIdentity).id)});}));

// Server-to-server, separate from human admin sessions. No credentials or claims in public/admin reads.
export const broadcastDispatchRoutes=Router();
broadcastDispatchRoutes.use((req,_res,next)=>{
 const token=dispatchToken();
 if(!token)return next(new HttpError(503,'BROADCAST_DISPATCH_DISABLED','Broadcast dispatch is not configured'));
 const header=req.header('authorization')??'';
 if(!header.startsWith('Bearer ')||!timingSafeEqual(digest(header.slice(7)),digest(token)))return next(new HttpError(401,'BROADCAST_DISPATCH_AUTH','Invalid dispatch credential'));
 next();
});
broadcastDispatchRoutes.post('/claim',handler(async(req,res)=>{
 const b=z.object({destination,claimId:uuid}).strict().parse(req.body);
 res.json({data:await claimDelivery(b.destination,b.claimId)});
}));
broadcastDispatchRoutes.get('/claims/:claimId',handler(async(req,res)=>{res.json({data:await lookupClaim(uuid.parse(req.params.claimId))});}));
broadcastDispatchRoutes.post('/deliveries/:id/receipt',handler(async(req,res)=>{
 const {claimId,...result}=receipt.parse(req.body);
 res.json({data:await recordReceipt(uuid.parse(req.params.id),claimId,result)});
}));
