/** Satify engine: every minute it collects data, checks each live pack's daily time and urgent rules,
 * creates one event per pack + place, and delivers it to that pack's subscribers.
 * Safety: never sends when required data is missing or stale; repeats are blocked by dedupe keys,
 * cooldowns and a per-day limit. SATIFY_DELIVERY_MODE=dry_run (default) logs messages instead of sending. */
import {pool,query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {SATIFY_CITIES,ROUTES,scopeLabel} from './catalog.mjs';
import {renderTemplate,missingSignals,evalRule,dailyDue,pktDate,parseCommand,maskPhone,type Rule} from './derive.mjs';
import {collectSatify,signalsFor} from './service.js';
import {runJobs} from './jobs.js';
import {deliveryMode,sendMessage,whatsappStatus,type Inbound} from './whatsapp.js';

export type Pack={slug:string;code:string;name:string;status:string;card_type:string;daily_at:string|null;scope_type:string;
 signals:string[];urgent_rules:Rule[];template:string;sponsor:string|null;cooldown_hours:number;max_per_day:number};

export async function livePacks():Promise<Pack[]>{
 return (await query<Pack>(`SELECT slug,code,name,status,card_type,daily_at,scope_type,signals,urgent_rules,template,sponsor,cooldown_hours,max_per_day
  FROM satify.packs WHERE status='live' AND card_type='alert' ORDER BY sort_order`)).rows;
}
export function composeMessage(pack:Pack,scope:string,signals:Awaited<ReturnType<typeof signalsFor>>,headline?:string):string{
 const body=renderTemplate(pack.template||`{${pack.signals[0]??'city'}}`,scope,signals);
 const lines=[headline?`⚠️ ${headline}`:null,body,pack.sponsor?`\n${pack.sponsor}`:null,`\nReply STOP ${pack.code} to stop · Satify: every number shows its source`];
 return lines.filter(Boolean).join('\n');
}
/** Body + what is missing, for the admin preview and the engine. */
export async function preview(pack:Pack,scope:string,headline?:string){
 const signals=await signalsFor(scope);
 const missing=missingSignals(pack.signals,signals);
 return {body:composeMessage(pack,scope,signals,headline),missing,signals};
}

async function note(pack:string,scope:string,text:string){
 await query(`INSERT INTO satify.engine_notes(pack_slug,scope,note) SELECT $1,$2,$3 WHERE NOT EXISTS(
  SELECT 1 FROM satify.engine_notes WHERE pack_slug=$1 AND scope=$2 AND note=$3 AND created_at>now()-interval '6 hours')`,[pack,scope,text.slice(0,300)]).catch(()=>undefined);
}
async function sentToday(pack:string,scope:string):Promise<number>{
 const r=await query<{n:number}>(`SELECT count(*)::int AS n FROM satify.events WHERE pack_slug=$1 AND scope=$2 AND kind<>'test'
  AND created_at>=(date_trunc('day',now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')`,[pack,scope]);
 return r.rows[0]?.n??0;
}
async function createEvent(pack:string,scope:string,kind:'daily'|'urgent'|'test',key:string,body:string):Promise<number|null>{
 const r=await query<{id:number}>(`INSERT INTO satify.events(pack_slug,scope,kind,dedupe_key,body) VALUES($1,$2,$3,$4,$5) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,[pack,scope,kind,key,body]);
 return r.rows[0]?.id??null;
}

/** Delivers an event to every active subscriber of that pack + place. */
export async function deliver(eventId:number,pack:Pack,scope:string,body:string){
 const subs=await query<{id:number;phone:string;inside:boolean}>(`SELECT s.id,s.phone,(s.last_inbound_at>now()-interval '23 hours') AS inside
  FROM satify.subscriptions x JOIN satify.subscribers s ON s.id=x.subscriber_id
  WHERE x.pack_slug=$1 AND x.scope=$2 AND x.active AND s.opted_out_at IS NULL`,[pack.slug,scope]);
 const mode=deliveryMode(),configured=whatsappStatus().configured;
 for(const s of subs.rows){
  const ins=await query<{id:number}>(`INSERT INTO satify.deliveries(event_id,subscriber_id,phone_tail,status) VALUES($1,$2,$3,'queued') ON CONFLICT (event_id,subscriber_id) DO NOTHING RETURNING id`,[eventId,s.id,maskPhone(s.phone)]);
  const id=ins.rows[0]?.id;if(!id)continue;
  if(mode!=='live'||!configured){await query(`UPDATE satify.deliveries SET status='dry_run' WHERE id=$1`,[id]);continue;}
  try{
   const mid=await sendMessage(s.phone,{text:body,packName:pack.name,scopeName:scopeLabel(scope),stopCode:pack.code},Boolean(s.inside));
   await query(`UPDATE satify.deliveries SET status='sent',provider_message_id=$2 WHERE id=$1`,[id,mid]);
  }catch(err){await query(`UPDATE satify.deliveries SET status='failed',error=$2 WHERE id=$1`,[id,(err instanceof Error?err.message:'failed').slice(0,300)]);}
 }
 return subs.rowCount??0;
}

async function runPacks(now=Date.now()){
 for(const pack of await livePacks()){
  const scopes=(await query<{scope:string}>(`SELECT DISTINCT x.scope FROM satify.subscriptions x JOIN satify.subscribers s ON s.id=x.subscriber_id
   WHERE x.pack_slug=$1 AND x.active AND s.opted_out_at IS NULL`,[pack.slug])).rows.map(r=>r.scope);
  for(const scope of scopes){
   try{
    const signals=await signalsFor(scope);
    const missing=missingSignals(pack.signals,signals,now);
    const day=pktDate(now);
    if(pack.daily_at&&dailyDue(pack.daily_at,now)){
     const key=`daily:${pack.slug}:${scope}:${day}`;
     if(missing.length)await note(pack.slug,scope,`Daily brief held back: missing or stale ${missing.join(', ')}`);
     else{const body=composeMessage(pack,scope,signals);const id=await createEvent(pack.slug,scope,'daily',key,body);if(id)await deliver(id,pack,scope,body);}
    }
    for(const [i,rule] of (Array.isArray(pack.urgent_rules)?pack.urgent_rules:[]).entries()){
     const hit=evalRule(rule,signals);if(!hit)continue;
     // exists-rules fire once per distinct notice; threshold rules once per cooldown window.
     const bucket=rule.op==='exists'?'once':String(Math.floor(now/(pack.cooldown_hours*3600000)));
     const key=`urgent:${pack.slug}:${scope}:${i}:${hit}:${bucket}`;
     if((await query('SELECT 1 FROM satify.events WHERE dedupe_key=$1',[key])).rowCount)continue;
     if(missing.length){await note(pack.slug,scope,`Urgent alert held back: missing or stale ${missing.join(', ')}`);continue;}
     if(await sentToday(pack.slug,scope)>=pack.max_per_day){await note(pack.slug,scope,`Urgent alert skipped: daily limit of ${pack.max_per_day} reached`);continue;}
     const body=composeMessage(pack,scope,signals,rule.label||'Alert');
     const id=await createEvent(pack.slug,scope,'urgent',key,body);if(id)await deliver(id,pack,scope,body);
    }
   }catch(err){logger.warn({err,pack:pack.slug,scope},'Satify pack run failed');}
  }
 }
}

let running=false;
/** Called every minute by the scheduler. An advisory lock keeps it to one process (API or worker). */
export async function satifyTick(){
 if(running)return;running=true;
 const client=await pool.connect().catch(()=>null);
 if(!client){running=false;return;}
 try{
  const got=(await client.query<{ok:boolean}>('SELECT pg_try_advisory_lock(710442) AS ok')).rows[0]?.ok;
  if(!got)return;
  try{await collectSatify();await runJobs();await runPacks();}
  finally{await client.query('SELECT pg_advisory_unlock(710442)').catch(()=>undefined);}
 }catch(err){logger.warn({err},'Satify tick failed (schema may not be ready yet)');}
 finally{client.release();running=false;}
}

// ---------- Inbound WhatsApp commands ----------
async function reply(to:string,text:string){
 if(!whatsappStatus().configured){logger.info({to:maskPhone(to)},'Satify reply not sent: WhatsApp not configured');return;}
 await sendMessage(to,{text,packName:'Satify',scopeName:'',stopCode:''},true).catch(err=>logger.warn({err},'Satify reply failed'));
}
async function helpText(){
 const live=(await query<{code:string;name:string;scope_type:string}>(`SELECT code,name,scope_type FROM satify.packs WHERE status='live' AND card_type='alert' ORDER BY sort_order`)).rows;
 const cities=Object.keys(SATIFY_CITIES).map(c=>c.toUpperCase()).join(', '),routes=Object.keys(ROUTES).map(r=>r.toUpperCase()).join(', ');
 return `Satify: Satisfy yourself. Every number shows its source.\n\nJoin a pack:\n${live.map(p=>`• JOIN ${p.code}${p.scope_type==='city'?' <CITY>':p.scope_type==='route'?' <ROUTE>':''} (${p.name})`).join('\n')}\n\nCities: ${cities}\nRoutes: ${routes}\nLIST shows your packs · STOP leaves all.`;
}
export async function handleInbound(m:Inbound){
 const cmd=parseCommand(m.text);
 const sub=(await query<{id:number}>(`INSERT INTO satify.subscribers(phone,last_inbound_at) VALUES($1,now())
  ON CONFLICT (phone) DO UPDATE SET last_inbound_at=now() RETURNING id`,[m.from])).rows[0]!;
 if(cmd.type==='join'){
  const pack=(await query<Pack&{scope_type:string}>(`SELECT slug,code,name,status,card_type,daily_at,scope_type,signals,urgent_rules,template,sponsor,cooldown_hours,max_per_day FROM satify.packs WHERE code=$1`,[cmd.code])).rows[0];
  if(!pack||pack.card_type!=='alert')return reply(m.from,`Sorry, there is no pack called ${cmd.code}.\n\n${await helpText()}`);
  if(pack.status!=='live')return reply(m.from,`${pack.name} is coming soon. We will tell you when it starts.`);
  let scope:string|null=pack.scope_type==='national'?'pk':cmd.place;
  if(pack.scope_type==='city'&&(!scope||!Object.hasOwn(SATIFY_CITIES,scope)))return reply(m.from,`Which city? Reply e.g. JOIN ${pack.code} LAHORE\nCities: ${Object.keys(SATIFY_CITIES).map(c=>c.toUpperCase()).join(', ')}`);
  if(pack.scope_type==='route'&&(!scope||!Object.hasOwn(ROUTES,scope)))return reply(m.from,`Which route? Reply e.g. JOIN ${pack.code} M2\nRoutes: ${Object.entries(ROUTES).map(([k,v])=>`${k.toUpperCase()} (${v.label})`).join(', ')}`);
  await query(`UPDATE satify.subscribers SET opted_out_at=NULL WHERE id=$1`,[sub.id]);
  await query(`INSERT INTO satify.subscriptions(subscriber_id,pack_slug,scope) VALUES($1,$2,$3) ON CONFLICT (subscriber_id,pack_slug,scope) DO UPDATE SET active=true`,[sub.id,pack.slug,scope!]);
  const now=await preview(pack,scope!);
  return reply(m.from,`✅ You joined ${pack.name} for ${scopeLabel(scope!)}.\n\nRight now:\n${now.body}`);
 }
 if(cmd.type==='stop'){
  if(cmd.code){
   const r=await query(`UPDATE satify.subscriptions x SET active=false FROM satify.packs p WHERE p.slug=x.pack_slug AND p.code=$2 AND x.subscriber_id=$1 AND x.active`,[sub.id,cmd.code]);
   return reply(m.from,r.rowCount?`You left ${cmd.code}. Send LIST to see your other packs.`:`You are not in ${cmd.code}. Send LIST to see your packs.`);
  }
  await query(`UPDATE satify.subscriptions SET active=false WHERE subscriber_id=$1`,[sub.id]);
  await query(`UPDATE satify.subscribers SET opted_out_at=now() WHERE id=$1`,[sub.id]);
  return reply(m.from,'You left all Satify packs. Send JOIN <PACK> any time to come back.');
 }
 if(cmd.type==='list'){
  const r=await query<{name:string;code:string;scope:string}>(`SELECT p.name,p.code,x.scope FROM satify.subscriptions x JOIN satify.packs p ON p.slug=x.pack_slug WHERE x.subscriber_id=$1 AND x.active ORDER BY p.sort_order`,[sub.id]);
  return reply(m.from,r.rows.length?`Your packs:\n${r.rows.map(x=>`• ${x.name}: ${scopeLabel(x.scope)} (STOP ${x.code} to leave)`).join('\n')}`:`You have no packs yet.\n\n${await helpText()}`);
 }
 return reply(m.from,await helpText());
}
