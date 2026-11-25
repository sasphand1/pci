import { config } from '../../lib/config.js';
import { boundedLimit, redis } from '../../lib/redis.js';
import { YoutubeClient, countOrNull } from '../youtube/client.js';
import { recordObservation } from '../ingest/store.js';

type Reading={at:string;value:number};
const DAY=86400000;
/** Fill only missing official catalogue counts. Registered IDs only, shared Redis cooldown,
 * separate 50-batch/day cap, existing YouTube client quota. Never infer from sample size. */
export async function missingPublicCounts(accounts:{id:string;external_id:string}[]):Promise<Map<string,Reading>>{
 const result=new Map<string,Reading>();
 if(process.env.NODE_ENV==='test'||!config.YOUTUBE_API_KEY)return result;
 const pending:typeof accounts=[];
 for(const a of accounts){
  if(!/^UC[A-Za-z0-9_-]{22}$/.test(a.external_id))continue;
  try{
   const key='pci:public-video-count:v4:'+a.external_id;
   const raw=await redis.get(key);
   if(raw){const p=JSON.parse(raw) as Reading;const age=Date.now()-Date.parse(p.at);if(Number.isSafeInteger(p.value)&&p.value>=0&&age>=0&&age<DAY){result.set(a.id,p);continue;}}
   // Fail closed on Redis failure and deduplicate concurrent visitor requests.
   if(await redis.set(key+':attempt','1','EX',3600,'NX')==='OK')pending.push(a);
  }catch{/* no quota-consuming request without the shared guard */}
 }
 if(!pending.length)return result;
 const work=async()=>{
  for(let i=0;i<pending.length;i+=50){
   const group=pending.slice(i,i+50);
   try{
    if(!await boundedLimit('pci:public-video-count:v4:budget:'+new Date().toISOString().slice(0,10),50,172800))break;
    const channels=await new YoutubeClient().channels(group.map(a=>a.external_id));
    const at=new Date().toISOString();
    for(const a of group){const raw=countOrNull(channels.find(c=>c.id===a.external_id)?.statistics?.videoCount);if(raw===null)continue;const value=Number(raw);if(!Number.isSafeInteger(value)||value<0)continue;
     const p={at,value};result.set(a.id,p);
     try{await redis.set('pci:public-video-count:v4:'+a.external_id,JSON.stringify(p),'EX',86400);}catch{/* official result still valid */}
     try{await recordObservation({sourceId:'youtube.api',sourceRunRef:'public-video-count:'+at,accountId:a.id,entityKind:'account',entityId:'youtube:'+a.external_id,metric:'video_count',valueNumeric:value,valueText:null,accuracy:'exact',observedAt:at,metadata:{origin:'quota-limited-catalogue-fallback'}});}catch{/* cached verified response remains available */}
    }
   }catch{/* missing stays unavailable; cooldown prevents repeated attempts */}
  }
 };
 // Keep the public profile responsive if the upstream API is slow. The guarded lookup
 // can finish populating the shared cache for the next read; it never mutates rankings.
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{await Promise.race([work(),new Promise<void>(resolve=>{timer=setTimeout(resolve,3500);})]);}finally{if(timer)clearTimeout(timer);}
 return new Map(result);
}
