/** Satify Hub job engine for Copernicus data stores (ADS, EWDS; the CDS works the same way).
 * Copernicus prepares files as queued jobs, so each connector runs over several scheduler ticks:
 * submit → poll (every minute) → download → decode GRIB → hand rows to the right store.
 * To add a dataset: add one entry to JOB_CONNECTORS (request builder + handler) and a satify.sources row. */
import {query} from '../../lib/db.js';
import {logger} from '../../lib/errors.js';
import {PORTALS,camsRequest,glofasRequest,cityPoints,camsRows,glofasRows,type CadsRequest,type CityPoint} from './copernicus.mjs';
import {decodeGrib,type GribField} from './grib.mjs';
import {storeExternal,reportExternalFailure} from '../satellite/service.js';

type Portal=keyof typeof PORTALS;
type JobRow={id:number;connector:string;run_key:string;portal:Portal;dataset:string;request:Record<string,unknown>;job_id:string|null;status:string;attempts:number;updated_at:string;created_at:string};
type Connector={id:string;portal:Portal;build:(now:number)=>CadsRequest;handle:(fields:GribField[],job:JobRow)=>Promise<unknown>};

const MAX_DOWNLOAD=40*1024*1024;
const keyFor=(portal:Portal)=>process.env[PORTALS[portal].keyEnv]||(portal==='ewds'?process.env.COPERNICUS_ADS_KEY:'')||'';

/** Air quality needs both PM jobs of the same model run; whichever finishes second publishes the rows. */
async function publishCams(runKey:string){
 const r=await query<{connector:string;result:CityPoint[]}>(`SELECT connector,result FROM satify.jobs WHERE run_key=$1 AND connector IN ('cams_pm25','cams_pm10') AND status='done'`,[runKey]);
 const pm25=r.rows.find(x=>x.connector==='cams_pm25')?.result,pm10=r.rows.find(x=>x.connector==='cams_pm10')?.result;
 if(!pm25)return; // PM2.5 is required; PM10 only sharpens the AQI
 await storeExternal('airquality',camsRows(pm25,pm10??[]) as never);
}
export const JOB_CONNECTORS:Connector[]=[
 {id:'cams_pm25',portal:'ads',build:now=>camsRequest('particulate_matter_2.5um',now),
  handle:async(fields,job)=>{const points=cityPoints(fields);await query('UPDATE satify.jobs SET result=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(points)]);await publishCams(job.run_key);return points.length;}},
 {id:'cams_pm10',portal:'ads',build:now=>camsRequest('particulate_matter_10um',now),
  handle:async(fields,job)=>{const points=cityPoints(fields);await query('UPDATE satify.jobs SET result=$2::jsonb WHERE id=$1',[job.id,JSON.stringify(points)]);await publishCams(job.run_key);return points.length;}},
 {id:'glofas',portal:'ewds',build:now=>glofasRequest(now),
  handle:async fields=>storeExternal('flood',glofasRows(fields) as never)}
];

async function cads(portal:Portal,path:string,init:{method?:string;body?:unknown}={}):Promise<any>{
 const r=await fetch(`${PORTALS[portal].base}${path}`,{method:init.method??'GET',signal:AbortSignal.timeout(30000),
  headers:{'PRIVATE-TOKEN':keyFor(portal),Accept:'application/json',...(init.body?{'Content-Type':'application/json'}:{}),'User-Agent':'Satify-Pulsr/1.0'},
  body:init.body?JSON.stringify(init.body):undefined});
 const json:any=await r.json().catch(()=>({}));
 if(!r.ok){
  const msg=String(json?.detail??json?.title??json?.message??'error');
  throw Error(`${PORTALS[portal].label} HTTP ${r.status}: ${/licen[cs]e/i.test(msg)?'accept the dataset licence on the Copernicus website once. ':''}${msg}`.slice(0,300));
 }
 return json;
}
async function download(href:string):Promise<Uint8Array>{
 const r=await fetch(href,{signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw Error(`Download HTTP ${r.status}`);
 const len=Number(r.headers.get('content-length')??0);if(len>MAX_DOWNLOAD)throw Error('Copernicus file too large');
 const buf=new Uint8Array(await r.arrayBuffer());if(buf.length>MAX_DOWNLOAD)throw Error('Copernicus file too large');
 return buf;
}
async function health(id:string,ok:boolean,error?:string){
 await query(ok?'UPDATE satify.sources SET last_attempt_at=now(),last_success_at=now(),last_error=NULL,fail_count=0 WHERE id=$1'
  :'UPDATE satify.sources SET last_attempt_at=now(),last_error=$2,fail_count=fail_count+1 WHERE id=$1',ok?[id]:[id,(error??'failed').slice(0,300)]);
}
async function fail(job:JobRow,message:string){
 await query(`UPDATE satify.jobs SET status='failed',error=$2,updated_at=now() WHERE id=$1`,[job.id,message.slice(0,300)]);
 await health(job.connector,false,message);
 const ext=job.connector.startsWith('cams')?'airquality':job.connector==='glofas'?'flood':null;
 if(ext)await reportExternalFailure(ext,message);
}

async function step(c:Connector,now:number){
 if(!keyFor(c.portal)){await health(c.id,false,`${PORTALS[c.portal].keyEnv} is not set in the Module 1 environment`);return;}
 const src=(await query<{enabled:boolean}>('SELECT enabled FROM satify.sources WHERE id=$1',[c.id])).rows[0];
 if(src&&!src.enabled)return;
 const req=c.build(now);
 let job=(await query<JobRow>('SELECT * FROM satify.jobs WHERE connector=$1 AND run_key=$2',[c.id,req.runKey])).rows[0];
 if(!job){
  job=(await query<JobRow>(`INSERT INTO satify.jobs(connector,run_key,portal,dataset,request) VALUES($1,$2,$3,$4,$5::jsonb)
   ON CONFLICT (connector,run_key) DO NOTHING RETURNING *`,[c.id,req.runKey,c.portal,req.dataset,JSON.stringify(req.inputs)])).rows[0];
  if(!job)return;
 }
 if(job.status==='done')return;
 if(job.status==='failed'){
  // Retry a failed run after an hour, at most 3 times.
  if(job.attempts>=3||Date.parse(job.updated_at)>now-3600e3)return;
  await query(`UPDATE satify.jobs SET status='pending',job_id=NULL,updated_at=now() WHERE id=$1`,[job.id]);job={...job,status:'pending',job_id:null};
 }
 if(job.status==='pending'){
  try{
   const res=await cads(c.portal,`/retrieve/v1/processes/${encodeURIComponent(job.dataset)}/execution`,{method:'POST',body:{inputs:job.request}});
   const id=String(res?.jobID??res?.id??'');if(!id)throw Error('Copernicus did not return a job id');
   await query(`UPDATE satify.jobs SET status='submitted',job_id=$2,attempts=attempts+1,error=NULL,updated_at=now() WHERE id=$1`,[job.id,id]);
  }catch(err){await query('UPDATE satify.jobs SET attempts=attempts+1 WHERE id=$1',[job.id]);await fail(job,err instanceof Error?err.message:'submit failed');}
  return;
 }
 if(job.status==='submitted'&&job.job_id){
  if(Date.parse(job.created_at)<now-8*3600e3){await fail(job,'Copernicus job did not finish within 8 hours');return;}
  const st=await cads(c.portal,`/retrieve/v1/jobs/${encodeURIComponent(job.job_id)}`).catch(err=>({status:'unknown',error:err}));
  const status=String(st?.status??'unknown');
  if(status==='failed'||status==='rejected'||status==='dismissed'){await fail(job,`Copernicus job ${status}: ${String(st?.message??st?.detail??'')}`);return;}
  if(status!=='successful')return; // accepted / running: check again next minute
  try{
   const results=await cads(c.portal,`/retrieve/v1/jobs/${encodeURIComponent(job.job_id)}/results`);
   const href=results?.asset?.value?.href;if(typeof href!=='string'||!/^https:\/\//.test(href))throw Error('Copernicus result without a download link');
   const fields=decodeGrib(await download(href));
   await c.handle(fields,job);
   await query(`UPDATE satify.jobs SET status='done',error=NULL,updated_at=now() WHERE id=$1`,[job.id]);
   await health(c.id,true);
  }catch(err){await fail(job,err instanceof Error?err.message:'processing failed');}
 }
}

/** One pass over every job connector; called each minute by the Satify engine. */
export async function runJobs(now=Date.now()){
 for(const c of JOB_CONNECTORS){try{await step(c,now);}catch(err){logger.warn({err,connector:c.id},'Satify job step failed');}}
 // Keep the job log short: finished jobs older than 14 days are removed.
 await query(`DELETE FROM satify.jobs WHERE status IN ('done','failed') AND updated_at<now()-interval '14 days'`).catch(()=>undefined);
}
