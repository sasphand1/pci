import {Router,type Request} from 'express';
import {z} from 'zod';
import {query} from '../../lib/db.js';
import {boundedLimit} from '../../lib/redis.js';
import {pseudonym} from '../../lib/security.js';
import {handler,HttpError,logger} from '../../lib/errors.js';
import {requireAdmin,roles,audit,type AdminIdentity} from '../auth/auth.js';
import {SIGNALS,SATIFY_CITIES,ROUTES,BADGES,scopeLabel,scopesFor} from './catalog.mjs';
import {validRule,templateTokens,normalisePhone,maskPhone} from './derive.mjs';
import {signalsFor,validScope,collectSatify} from './service.js';
import {preview,deliver,type Pack} from './engine.js';
import {handleInbound} from './engine.js';
import {verifyChallenge,validSignature,inboundMessages,whatsappStatus,whatsappNumber,registerTemplate} from './whatsapp.js';

export const satifyPublicRoutes=Router();
export const satifyAdminRoutes=Router();
export const satifyWebhookRoutes=Router();

const PACK_COLS=`slug,code,name,icon,group_id,sort_order,featured,status,card_type,tagline,bullets,schedule_label,daily_at,price,scope_type,languages,signals,urgent_rules,template,sponsor,cooldown_hours,max_per_day,cta_label,updated_at`;
const GROUPS=[{id:'featured',name:'Featured'},{id:'family',name:'Family & Health'},{id:'travel',name:'Travel & Roads'},{id:'work',name:'Work & Business'},{id:'money',name:'Money'},{id:'schools',name:'For Schools'}];
const admin=(res:any)=>res.locals.admin as AdminIdentity;
async function limit(req:Request,bucket:string,max:number,windowSeconds:number){
 let ok=true;try{ok=await boundedLimit(`satify:${bucket}:${pseudonym(req.ip??'unknown')}`,max,windowSeconds);}catch{ok=true;}
 if(!ok)throw new HttpError(429,'RATE_LIMIT','Too many requests, try again later');
}

// ---------------- Public ----------------
satifyPublicRoutes.get('/now',handler(async(req,res)=>{
 const scope=String(req.query.city??req.query.scope??'lahore').toLowerCase();
 if(!validScope(scope))throw new HttpError(400,'INVALID_SCOPE','Unknown city or route');
 const s=await signalsFor(scope);
 const data=Object.entries(s).filter(([id])=>{const def=SIGNALS[id];return def&&(def.scope==='pk'||def.scope===(Object.hasOwn(ROUTES,scope)?'route':'city'));})
  .map(([id,v])=>({id,label:SIGNALS[id].label,unit:SIGNALS[id].unit,value:v.value,text:v.text,badge:v.badge,source:v.source,observedAt:v.observedAt,sourceUrl:(v as any).sourceUrl??null}));
 res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=120');
 res.json({data,meta:{scope,scopeName:scopeLabel(scope),badges:BADGES}});
}));
satifyPublicRoutes.get('/packs',handler(async(_req,res)=>{
 const r=await query(`SELECT slug,code,name,icon,group_id,sort_order,featured,status,card_type,tagline,bullets,schedule_label,price,scope_type,cta_label
  FROM satify.packs WHERE status IN ('live','soon') ORDER BY featured DESC,sort_order,name`);
 res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');
 res.json({data:r.rows.map(p=>({...p,joinText:p.card_type==='alert'?`JOIN ${p.code}`:null})),
  meta:{groups:GROUPS,whatsappNumber:whatsappNumber(),cities:SATIFY_CITIES,routes:Object.fromEntries(Object.entries(ROUTES).map(([k,v])=>[k,v.label]))}});
}));
satifyPublicRoutes.get('/sources',handler(async(_req,res)=>{
 const r=await query(`SELECT id,label,kind,last_success_at FROM satify.sources ORDER BY id`);
 res.json({data:{badges:BADGES,signals:Object.entries(SIGNALS).map(([id,d])=>({id,label:d.label,badge:d.badge,source:d.source})),connectors:r.rows}});
}));
const interestBody=z.object({pack:z.string().regex(/^[a-z0-9-]{2,40}$/),contact:z.string().trim().min(5).max(120),city:z.string().max(40).optional()});
satifyPublicRoutes.post('/interest',handler(async(req,res)=>{
 await limit(req,'interest',10,3600);
 const b=interestBody.parse(req.body);
 const phone=normalisePhone(b.contact),email=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.contact)?b.contact.toLowerCase():null;
 if(!phone&&!email)throw new HttpError(400,'INVALID_CONTACT','Enter a WhatsApp number or an email address');
 const pack=await query(`SELECT 1 FROM satify.packs WHERE slug=$1 AND status='soon'`,[b.pack]);
 if(!pack.rowCount)throw new HttpError(404,'PACK_NOT_FOUND','Pack not found');
 await query(`INSERT INTO satify.interest(pack_slug,contact,scope) VALUES($1,$2,$3) ON CONFLICT (pack_slug,contact) DO NOTHING`,[b.pack,phone??email,b.city&&validScope(b.city)?b.city:null]);
 res.status(201).json({data:{ok:true}});
}));
const schoolBody=z.object({schoolName:z.string().trim().min(2).max(120),city:z.string().trim().min(2).max(60),contactName:z.string().trim().min(2).max(80),
 phone:z.string().trim().min(7).max(20),email:z.string().trim().email().max(120).optional().or(z.literal('')),parentsEstimate:z.coerce.number().int().min(0).max(100000).optional()});
satifyPublicRoutes.post('/schools',handler(async(req,res)=>{
 await limit(req,'schools',5,3600);
 const b=schoolBody.parse(req.body);const phone=normalisePhone(b.phone);
 if(!phone)throw new HttpError(400,'INVALID_PHONE','Enter a valid phone number');
 await query(`INSERT INTO satify.school_registrations(school_name,city,contact_name,phone,email,parents_estimate) VALUES($1,$2,$3,$4,$5,$6)`,
  [b.schoolName,b.city,b.contactName,phone,b.email||null,b.parentsEstimate??null]);
 res.status(201).json({data:{ok:true}});
}));

// ---------------- WhatsApp webhook (raw body; mounted before express.json) ----------------
satifyWebhookRoutes.get('/',(req,res)=>{const c=verifyChallenge(req.query as Record<string,unknown>);if(c)res.type('text/plain').send(c);else res.sendStatus(403);});
satifyWebhookRoutes.post('/',handler(async(req,res)=>{
 const raw=Buffer.isBuffer(req.body)?req.body:Buffer.from('');
 if(!validSignature(raw,req.header('x-hub-signature-256')))throw new HttpError(401,'BAD_SIGNATURE','Invalid webhook signature');
 let body:unknown;try{body=JSON.parse(raw.toString('utf8'));}catch{throw new HttpError(400,'BAD_JSON','Invalid JSON');}
 res.sendStatus(200); // Meta expects a fast 200; commands are handled after replying.
 for(const m of inboundMessages(body).slice(0,20))await handleInbound(m).catch(err=>logger.warn({err},'Satify inbound message failed'));
}));

// ---------------- Admin ----------------
satifyAdminRoutes.use(requireAdmin,roles('owner','editor'));
satifyAdminRoutes.get('/overview',handler(async(_req,res)=>{
 const [subs,perPack,today,sources,notes,schools,interest,stale]=await Promise.all([
  query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE opted_out_at IS NULL)::int AS active FROM satify.subscribers`),
  query(`SELECT p.slug,p.name,p.status,count(x.id) FILTER (WHERE x.active AND s.opted_out_at IS NULL)::int AS subscribers
   FROM satify.packs p LEFT JOIN satify.subscriptions x ON x.pack_slug=p.slug LEFT JOIN satify.subscribers s ON s.id=x.subscriber_id GROUP BY p.slug ORDER BY p.featured DESC,p.sort_order`),
  query(`SELECT status,count(*)::int AS n FROM satify.deliveries WHERE created_at>now()-interval '24 hours' GROUP BY status`),
  query(`SELECT id,label,kind,min_minutes,enabled,last_attempt_at,last_success_at,last_error,fail_count FROM satify.sources ORDER BY id`),
  query(`SELECT pack_slug,scope,note,created_at FROM satify.engine_notes ORDER BY created_at DESC LIMIT 20`),
  query(`SELECT count(*) FILTER (WHERE status='new')::int AS new FROM satify.school_registrations`),
  query(`SELECT pack_slug,count(*)::int AS n FROM satify.interest GROUP BY pack_slug ORDER BY n DESC`),
  query(`SELECT signal_id,count(*)::int AS scopes,max(observed_at) AS newest FROM satify.signals_latest GROUP BY signal_id ORDER BY signal_id`)]);
 const jobs=await query(`SELECT connector,run_key,status,error,attempts,updated_at FROM satify.jobs ORDER BY updated_at DESC LIMIT 12`).catch(()=>({rows:[]}));
 res.json({data:{subscribers:subs.rows[0],packs:perPack.rows,deliveries24h:Object.fromEntries(today.rows.map(r=>[r.status,r.n])),sources:sources.rows,
  notes:notes.rows,newSchools:schools.rows[0]?.new??0,interest:interest.rows,signals:stale.rows,jobs:jobs.rows,whatsapp:whatsappStatus(),
  copernicus:{ads:Boolean(process.env.COPERNICUS_ADS_KEY),ewds:Boolean(process.env.COPERNICUS_EWDS_KEY||process.env.COPERNICUS_ADS_KEY)}}});
}));
satifyAdminRoutes.get('/catalog',handler(async(_req,res)=>{
 res.json({data:{signals:Object.entries(SIGNALS).map(([id,d])=>({id,...d})),cities:SATIFY_CITIES,routes:ROUTES,badges:BADGES,groups:GROUPS,ops:['>=','<=','==','exists']}});
}));
satifyAdminRoutes.get('/signals',handler(async(req,res)=>{
 const scope=String(req.query.scope??'lahore');if(!validScope(scope))throw new HttpError(400,'INVALID_SCOPE','Unknown scope');
 res.json({data:await signalsFor(scope)});
}));
satifyAdminRoutes.post('/sources/refresh',handler(async(_req,res)=>{
 await collectSatify(true);await audit(admin(res).id,'satify.sources.refresh',null,{});
 res.json({data:{ok:true}});
}));

const packBody=z.object({
 slug:z.string().regex(/^[a-z0-9-]{2,40}$/),code:z.string().regex(/^[A-Z0-9]{2,20}$/),name:z.string().trim().min(2).max(60),icon:z.string().max(8).default('📡'),
 group_id:z.enum(['featured','family','travel','work','money','schools']),sort_order:z.coerce.number().int().min(0).max(999),featured:z.boolean(),
 status:z.enum(['draft','soon','testing','live','paused']),card_type:z.enum(['alert','business']),tagline:z.string().max(120),
 bullets:z.array(z.string().max(90)).max(4),schedule_label:z.string().max(60),daily_at:z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/).nullable(),
 price:z.enum(['free','paid','business']),scope_type:z.enum(['city','route','national']),languages:z.array(z.enum(['en','ur'])).min(1).max(2),
 signals:z.array(z.string()).max(20),urgent_rules:z.array(z.any()).max(5),template:z.string().max(1200),sponsor:z.string().max(120).nullable(),
 cooldown_hours:z.coerce.number().int().min(1).max(72),max_per_day:z.coerce.number().int().min(1).max(6),cta_label:z.string().max(40).nullable()
});
function checkPack(p:z.infer<typeof packBody>){
 const bad=p.signals.filter(s=>!Object.hasOwn(SIGNALS,s));if(bad.length)throw new HttpError(400,'UNKNOWN_SIGNAL',`Unknown signals: ${bad.join(', ')}`);
 if(!p.urgent_rules.every(validRule))throw new HttpError(400,'INVALID_RULE','Each urgent rule needs a known signal, an operator and a value');
 const tokens=templateTokens(p.template).filter(t=>!['city','route','scope'].includes(t)&&!Object.hasOwn(SIGNALS,t));
 if(tokens.length)throw new HttpError(400,'UNKNOWN_TOKEN',`Template uses unknown data: ${tokens.join(', ')}`);
 if(p.status==='live'&&p.card_type==='alert'&&(!p.template.trim()||!p.signals.length))throw new HttpError(400,'PACK_INCOMPLETE','A live pack needs data and a message template');
}
satifyAdminRoutes.get('/packs',handler(async(_req,res)=>{
 const r=await query(`SELECT ${PACK_COLS} FROM satify.packs ORDER BY featured DESC,sort_order,name`);res.json({data:r.rows});
}));
satifyAdminRoutes.post('/packs',handler(async(req,res)=>{
 const p=packBody.parse(req.body);checkPack(p);
 const r=await query(`INSERT INTO satify.packs(slug,code,name,icon,group_id,sort_order,featured,status,card_type,tagline,bullets,schedule_label,daily_at,price,scope_type,languages,signals,urgent_rules,template,sponsor,cooldown_hours,max_per_day,cta_label)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20,$21,$22,$23) ON CONFLICT DO NOTHING RETURNING ${PACK_COLS}`,
  [p.slug,p.code,p.name,p.icon,p.group_id,p.sort_order,p.featured,p.status,p.card_type,p.tagline,JSON.stringify(p.bullets),p.schedule_label,p.daily_at,p.price,p.scope_type,p.languages,p.signals,JSON.stringify(p.urgent_rules),p.template,p.sponsor,p.cooldown_hours,p.max_per_day,p.cta_label]);
 if(!r.rowCount)throw new HttpError(409,'PACK_EXISTS','A pack with this slug or join code already exists');
 await audit(admin(res).id,'satify.pack.create',p.slug,{status:p.status});res.status(201).json({data:r.rows[0]});
}));
satifyAdminRoutes.put('/packs/:slug',handler(async(req,res)=>{
 const p=packBody.parse({...req.body,slug:req.params.slug});checkPack(p);
 const r=await query(`UPDATE satify.packs SET code=$2,name=$3,icon=$4,group_id=$5,sort_order=$6,featured=$7,status=$8,card_type=$9,tagline=$10,bullets=$11::jsonb,schedule_label=$12,daily_at=$13,price=$14,
  scope_type=$15,languages=$16,signals=$17,urgent_rules=$18::jsonb,template=$19,sponsor=$20,cooldown_hours=$21,max_per_day=$22,cta_label=$23,updated_at=now() WHERE slug=$1 RETURNING ${PACK_COLS}`,
  [p.slug,p.code,p.name,p.icon,p.group_id,p.sort_order,p.featured,p.status,p.card_type,p.tagline,JSON.stringify(p.bullets),p.schedule_label,p.daily_at,p.price,p.scope_type,p.languages,p.signals,JSON.stringify(p.urgent_rules),p.template,p.sponsor,p.cooldown_hours,p.max_per_day,p.cta_label]).catch(e=>{if(String(e?.code)==='23505')throw new HttpError(409,'CODE_TAKEN','Join code already used by another pack');throw e;});
 if(!r.rowCount)throw new HttpError(404,'PACK_NOT_FOUND','Pack not found');
 await audit(admin(res).id,'satify.pack.update',p.slug,{status:p.status});res.json({data:r.rows[0]});
}));
const previewBody=z.object({scope:z.string().max(40),phone:z.string().max(20).optional(),headline:z.string().max(80).optional()});
async function packBySlug(slug:string):Promise<Pack>{
 const r=await query<Pack>(`SELECT slug,code,name,status,card_type,daily_at,scope_type,signals,urgent_rules,template,sponsor,cooldown_hours,max_per_day FROM satify.packs WHERE slug=$1`,[slug]);
 if(!r.rows[0])throw new HttpError(404,'PACK_NOT_FOUND','Pack not found');return r.rows[0];
}
satifyAdminRoutes.post('/packs/:slug/preview',handler(async(req,res)=>{
 const b=previewBody.parse(req.body);const pack=await packBySlug(String(req.params.slug));
 const scope=pack.scope_type==='national'?'pk':b.scope;if(!scopesFor(pack.scope_type).includes(scope))throw new HttpError(400,'INVALID_SCOPE','Pick a place that fits this pack');
 const p=await preview(pack,scope,b.headline);res.json({data:{body:p.body,missing:p.missing}});
}));
/** Sends a real test message to one number (needs WhatsApp configured; ignores dry-run so you can see it). */
satifyAdminRoutes.post('/packs/:slug/test',handler(async(req,res)=>{
 const b=previewBody.parse(req.body);const pack=await packBySlug(String(req.params.slug));
 const phone=normalisePhone(b.phone);if(!phone)throw new HttpError(400,'INVALID_PHONE','Enter the phone number for the test');
 const scope=pack.scope_type==='national'?'pk':b.scope;if(!scopesFor(pack.scope_type).includes(scope))throw new HttpError(400,'INVALID_SCOPE','Pick a place that fits this pack');
 const p=await preview(pack,scope,b.headline);
 const sub=(await query<{id:number}>(`INSERT INTO satify.subscribers(phone) VALUES($1) ON CONFLICT (phone) DO UPDATE SET phone=EXCLUDED.phone RETURNING id`,[phone])).rows[0]!;
 const ev=(await query<{id:number}>(`INSERT INTO satify.events(pack_slug,scope,kind,dedupe_key,body) VALUES($1,$2,'test',$3,$4) RETURNING id`,[pack.slug,scope,`test:${pack.slug}:${scope}:${Date.now()}:${sub.id}`,p.body])).rows[0]!;
 const {sendMessage}=await import('./whatsapp.js');
 let status='dry_run',error:string|null=null;
 if(whatsappStatus().configured){try{await sendMessage(phone,{text:p.body,packName:pack.name,scopeName:scopeLabel(scope),stopCode:pack.code},false);status='sent';}catch(e){status='failed';error=e instanceof Error?e.message:'failed';}}
 await query(`INSERT INTO satify.deliveries(event_id,subscriber_id,phone_tail,status,error) VALUES($1,$2,$3,$4,$5)`,[ev.id,sub.id,maskPhone(phone),status,error]);
 await audit(admin(res).id,'satify.pack.test',pack.slug,{scope,status});
 res.json({data:{status,error,body:p.body,missing:p.missing}});
}));
/** Sends the current message to all subscribers of one place now (e.g. after entering an official notice). */
satifyAdminRoutes.post('/packs/:slug/send-now',handler(async(req,res)=>{
 const b=previewBody.parse(req.body);const pack=await packBySlug(String(req.params.slug));
 if(pack.status!=='live')throw new HttpError(400,'PACK_NOT_LIVE','Only live packs can send');
 const scope=pack.scope_type==='national'?'pk':b.scope;if(!scopesFor(pack.scope_type).includes(scope))throw new HttpError(400,'INVALID_SCOPE','Pick a place that fits this pack');
 const p=await preview(pack,scope,b.headline);if(p.missing.length)throw new HttpError(409,'DATA_MISSING',`Not sent: missing ${p.missing.join(', ')}`);
 const ev=(await query<{id:number}>(`INSERT INTO satify.events(pack_slug,scope,kind,dedupe_key,body) VALUES($1,$2,'urgent',$3,$4) RETURNING id`,[pack.slug,scope,`manual:${pack.slug}:${scope}:${Date.now()}`,p.body])).rows[0]!;
 const n=await deliver(ev.id,pack,scope,p.body);
 await audit(admin(res).id,'satify.pack.send_now',pack.slug,{scope,recipients:n});res.json({data:{recipients:n}});
}));

const MANUAL_IDS=Object.entries(SIGNALS).filter(([,d])=>d.manual).map(([id])=>id) as [string,...string[]];
const manualBody=z.object({signal:z.enum(MANUAL_IDS),scope:z.string().max(40),value:z.coerce.number().finite().nullable().optional(),text:z.string().trim().max(300).nullable().optional(),
 sourceUrl:z.string().trim().url().max(400).nullable().optional().or(z.literal('')),note:z.string().max(300).optional(),validHours:z.coerce.number().int().min(1).max(24*90).optional()});
satifyAdminRoutes.get('/manual',handler(async(_req,res)=>{
 const r=await query(`SELECT id,signal_id,scope,value_numeric,value_text,source_url,note,valid_until,active,created_at FROM satify.manual_signals ORDER BY created_at DESC LIMIT 200`);
 res.json({data:r.rows,meta:{signals:MANUAL_IDS.map(id=>({id,label:SIGNALS[id].label,scope:SIGNALS[id].scope,unit:SIGNALS[id].unit}))}});
}));
satifyAdminRoutes.get('/manual-meta',handler(async(_req,res)=>{res.json({data:{signals:MANUAL_IDS.map(id=>({id,label:SIGNALS[id].label,scope:SIGNALS[id].scope,unit:SIGNALS[id].unit}))}});}));
satifyAdminRoutes.post('/manual',handler(async(req,res)=>{
 const b=manualBody.parse(req.body);const def=SIGNALS[b.signal];
 const scope=def.scope==='pk'?'pk':b.scope;
 if(!(scope==='pk'||scopesFor(def.scope==='route'?'route':'city').includes(scope)))throw new HttpError(400,'INVALID_SCOPE','Pick a place that fits this signal');
 if((b.value===null||b.value===undefined)&&!b.text)throw new HttpError(400,'EMPTY','Enter a value or text');
 const r=await query(`INSERT INTO satify.manual_signals(signal_id,scope,value_numeric,value_text,source_url,note,valid_until,created_by)
  VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $7::int IS NULL THEN NULL ELSE now()+make_interval(hours=>$7::int) END,$8) RETURNING id`,
  [b.signal,scope,b.value??null,b.text||null,b.sourceUrl||null,b.note??null,b.validHours??null,admin(res).id]);
 await audit(admin(res).id,'satify.manual.create',b.signal,{scope});res.status(201).json({data:{id:r.rows[0].id}});
}));
satifyAdminRoutes.delete('/manual/:id',handler(async(req,res)=>{
 const id=z.coerce.number().int().positive().parse(req.params.id);
 await query(`UPDATE satify.manual_signals SET active=false WHERE id=$1`,[id]);await audit(admin(res).id,'satify.manual.deactivate',String(id),{});res.json({data:{ok:true}});
}));

satifyAdminRoutes.get('/subscribers',handler(async(_req,res)=>{
 const r=await query(`SELECT s.id,s.phone,s.created_at,s.opted_out_at,s.last_inbound_at,
  coalesce(json_agg(json_build_object('pack',x.pack_slug,'scope',x.scope)) FILTER (WHERE x.active),'[]') AS packs
  FROM satify.subscribers s LEFT JOIN satify.subscriptions x ON x.subscriber_id=s.id GROUP BY s.id ORDER BY s.created_at DESC LIMIT 500`);
 res.json({data:r.rows.map(s=>({...s,phone:maskPhone(s.phone)}))});
}));
satifyAdminRoutes.get('/messages',handler(async(_req,res)=>{
 const r=await query(`SELECT e.id,e.pack_slug,e.scope,e.kind,e.body,e.created_at,
  count(d.id)::int AS recipients,count(d.id) FILTER (WHERE d.status='sent')::int AS sent,count(d.id) FILTER (WHERE d.status='failed')::int AS failed,
  count(d.id) FILTER (WHERE d.status='dry_run')::int AS dry_run,max(d.error) AS last_error
  FROM satify.events e LEFT JOIN satify.deliveries d ON d.event_id=e.id GROUP BY e.id ORDER BY e.created_at DESC LIMIT 200`);
 res.json({data:r.rows});
}));
satifyAdminRoutes.get('/schools',handler(async(_req,res)=>{
 const r=await query(`SELECT id,school_name,city,contact_name,phone,email,parents_estimate,status,created_at FROM satify.school_registrations ORDER BY created_at DESC LIMIT 500`);
 res.json({data:r.rows});
}));
satifyAdminRoutes.patch('/schools/:id',handler(async(req,res)=>{
 const id=z.coerce.number().int().positive().parse(req.params.id);const {status}=z.object({status:z.enum(['new','contacted','active','declined'])}).parse(req.body);
 await query(`UPDATE satify.school_registrations SET status=$2 WHERE id=$1`,[id,status]);await audit(admin(res).id,'satify.school.status',String(id),{status});res.json({data:{ok:true}});
}));
satifyAdminRoutes.post('/whatsapp/template',handler(async(_req,res)=>{
 const r=await registerTemplate().catch(e=>{throw new HttpError(400,'TEMPLATE_FAILED',e instanceof Error?e.message:'Template request failed');});
 await audit(admin(res).id,'satify.whatsapp.template',r.id,{status:r.status});res.json({data:r});
}));
