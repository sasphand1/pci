/** WhatsApp Cloud API for Satify: send, receive (JOIN/STOP), and register the shared alert template.
 * One shared utility template ("satify_alert") serves every pack, so a new pack built in the admin panel
 * works at once without its own Meta approval. Inside the 24-hour window after a user writes, plain text is used. */
import {createHmac,timingSafeEqual} from 'node:crypto';
import {flattenForTemplate} from './derive.mjs';

const env=()=>({
 token:process.env.WHATSAPP_TOKEN??'',phoneId:process.env.WHATSAPP_PHONE_ID??'',wabaId:process.env.WHATSAPP_WABA_ID??'',
 verify:process.env.WHATSAPP_VERIFY_TOKEN??'',secret:process.env.WHATSAPP_APP_SECRET??'',
 version:/^v\d{2}\.\d$/.test(process.env.WHATSAPP_GRAPH_VERSION??'')?process.env.WHATSAPP_GRAPH_VERSION!:'v23.0',
 template:/^[a-z0-9_]{1,60}$/.test(process.env.SATIFY_WA_TEMPLATE??'')?process.env.SATIFY_WA_TEMPLATE!:'satify_alert',
 lang:/^[a-z]{2}(_[A-Z]{2})?$/.test(process.env.SATIFY_WA_TEMPLATE_LANG??'')?process.env.SATIFY_WA_TEMPLATE_LANG!:'en'
});
export const deliveryMode=()=>process.env.SATIFY_DELIVERY_MODE==='live'?'live':'dry_run';
export const whatsappNumber=()=>(process.env.WHATSAPP_NUMBER??'').replace(/[^0-9]/g,'')||null;
export function whatsappStatus(){const e=env();return {configured:Boolean(e.token&&e.phoneId),webhookReady:Boolean(e.verify&&e.secret),templateReady:Boolean(e.wabaId),
 mode:deliveryMode(),number:whatsappNumber(),template:e.template,graphVersion:e.version};}

export function verifyChallenge(q:Record<string,unknown>):string|null{
 const e=env();
 return q['hub.mode']==='subscribe'&&e.verify&&q['hub.verify_token']===e.verify&&typeof q['hub.challenge']==='string'?q['hub.challenge']:null;
}
/** X-Hub-Signature-256 check over the raw body. Without an app secret the webhook refuses everything. */
export function validSignature(raw:Buffer,header:string|undefined):boolean{
 const {secret}=env();if(!secret||!header?.startsWith('sha256='))return false;
 const expected=Buffer.from('sha256='+createHmac('sha256',secret).update(raw).digest('hex'));
 const given=Buffer.from(header);
 return expected.length===given.length&&timingSafeEqual(expected,given);
}
export type Inbound={from:string;text:string;id:string};
export function inboundMessages(body:any):Inbound[]{
 const out:Inbound[]=[];
 for(const entry of Array.isArray(body?.entry)?body.entry:[])for(const ch of Array.isArray(entry?.changes)?entry.changes:[])
  for(const m of Array.isArray(ch?.value?.messages)?ch.value.messages:[]){
   const text=m?.type==='text'?m.text?.body:m?.type==='button'?m.button?.text:m?.type==='interactive'?(m.interactive?.button_reply?.title??m.interactive?.list_reply?.title):null;
   if(typeof m?.from==='string'&&/^[0-9]{8,15}$/.test(m.from)&&typeof text==='string')out.push({from:m.from,text:text.slice(0,200),id:String(m.id??'')});
  }
 return out;
}

async function graph(path:string,body:unknown):Promise<any>{
 const e=env();
 const r=await fetch(`https://graph.facebook.com/${e.version}/${path}`,{method:'POST',signal:AbortSignal.timeout(15000),
  headers:{Authorization:`Bearer ${e.token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const json:any=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(`WhatsApp HTTP ${r.status}: ${String(json?.error?.message??'error').slice(0,200)}`);
 return json;
}
/** Sends one message. Inside the 24h window: plain text. Outside: the approved shared template. */
export async function sendMessage(to:string,body:{text:string;packName:string;scopeName:string;stopCode:string},insideWindow:boolean):Promise<string>{
 const e=env();if(!e.token||!e.phoneId)throw Error('WhatsApp not configured');
 const payload=insideWindow
  ?{messaging_product:'whatsapp',to,type:'text',text:{preview_url:false,body:body.text.slice(0,4000)}}
  :{messaging_product:'whatsapp',to,type:'template',template:{name:e.template,language:{code:e.lang},components:[{type:'body',parameters:[
    {type:'text',text:body.packName.slice(0,60)},{type:'text',text:body.scopeName.slice(0,60)},{type:'text',text:flattenForTemplate(body.text)},{type:'text',text:body.stopCode.slice(0,30)}]}]}};
 const json=await graph(`${e.phoneId}/messages`,payload);
 return String(json?.messages?.[0]?.id??'');
}
/** Submits the shared utility template to Meta once. Status then shows in WhatsApp Manager / the admin panel. */
export async function registerTemplate():Promise<{id:string;status:string}>{
 const e=env();if(!e.token||!e.wabaId)throw Error('Set WHATSAPP_TOKEN and WHATSAPP_WABA_ID first');
 const json=await graph(`${e.wabaId}/message_templates`,{name:e.template,language:e.lang,category:'UTILITY',components:[{type:'BODY',
  text:'Satify {{1}} update for {{2}}: {{3}}. Every number shows its source on the Satify page. Reply STOP {{4}} to unsubscribe.',
  example:{body_text:[['Parents','Lahore','Smog: Very unhealthy (peak AQI 280) · Fog: High · Closure chance (prediction): Medium','PARENTS']]}}]});
 return {id:String(json?.id??''),status:String(json?.status??'PENDING')};
}
