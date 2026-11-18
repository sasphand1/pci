import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';

type Result={id?:string;username?:string;followers_count?:number;media_count?:number};
const API_VERSION='v27.0';
export async function fetchInstagramProfile(username:string):Promise<Result>{
 const token=process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN;
 const owner=process.env.INSTAGRAM_GRAPH_OWNER_ID;
 if(!token||!owner||!/^[0-9]+$/.test(owner))throw new Error('INSTAGRAM_GRAPH_NOT_CONFIGURED');
 // Fixed graph.facebook.com URL, never let user-supplied usernames become URLs/hosts.
 if(!/^[a-z0-9._]{1,30}$/.test(username))throw new Error('INVALID_USERNAME');
 const fields=`business_discovery.username(${username}){id,username,followers_count,media_count}`;
 const url=new URL(`https://graph.facebook.com/${API_VERSION}/${owner}`);
 url.searchParams.set('fields',fields);
 const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});
 const body=await response.json() as {business_discovery?:Result;error?:{code?:number;message?:string}};
 if(!response.ok||!body.business_discovery)throw new Error(`INSTAGRAM_GRAPH_ERROR_${body.error?.code??response.status}`);
 const r=body.business_discovery;
 const followers=r.followers_count,media=r.media_count;
 if(r.username?.toLowerCase()!==username||typeof followers!=='number'||typeof media!=='number'||!Number.isSafeInteger(followers)||!Number.isSafeInteger(media)||followers<0||media<0)throw new Error('INSTAGRAM_GRAPH_INVALID_RESPONSE');
 return r;
}
export async function syncInstagramProfiles(){
 if(!process.env.INSTAGRAM_GRAPH_ACCESS_TOKEN||!process.env.INSTAGRAM_GRAPH_OWNER_ID)throw new Error('INSTAGRAM_GRAPH_NOT_CONFIGURED');
 const rows=(await query("SELECT id,username FROM instagram_creators WHERE enabled AND eligibility='approved' ORDER BY id")).rows as {id:string;username:string}[];
 let refreshed=0,failed=0;
 // Serialized requests to avoid burst calls and maintain predictable budget.
 for(const row of rows){
  try{
   const r=await fetchInstagramProfile(row.username);
   await query(`INSERT INTO instagram_stats_latest(creator_id,instagram_id,followers_count,media_count,fetched_at,error_code)
       VALUES($1,$2,$3,$4,now(),NULL)
       ON CONFLICT(creator_id) DO UPDATE SET instagram_id=excluded.instagram_id,followers_count=excluded.followers_count,
       media_count=excluded.media_count,fetched_at=excluded.fetched_at,error_code=NULL`,
       [row.id,r.id??null,r.followers_count,r.media_count]);
   await query('INSERT INTO instagram_stats_history(creator_id,followers_count,media_count) VALUES($1,$2,$3)',[row.id,r.followers_count,r.media_count]);
   refreshed++;
  }catch(err){
   failed++;
   const code=err instanceof Error?err.message.slice(0,100):'UNKNOWN';
   logger.warn({creatorId:row.id,errorCode:code},'Instagram sync failed');
   await query(`INSERT INTO instagram_stats_latest(creator_id,error_code) VALUES($1,$2)
    ON CONFLICT(creator_id) DO UPDATE SET error_code=excluded.error_code`,[row.id,code]);
   // Preserve prior metric values and fetched_at on failed refresh.
  }
 }
 return {total:rows.length,refreshed,failed};
}
