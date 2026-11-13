import { Redis } from 'ioredis';
import { config } from './config.js';
export const redis = new Redis(config.REDIS_URL,{maxRetriesPerRequest: 1,enableReadyCheck:true,lazyConnect:true});
export async function ensureRedis() {if(redis.status==='wait') await redis.connect(); await redis.ping();}
export async function boundedLimit(key:string,maximum:number,windowSeconds:number):Promise<boolean> {
  const result=await redis.eval(`local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n`,1,key,String(windowSeconds));
  return Number(result)<=maximum;
}
export async function cacheRead<T>(key:string,work:()=>Promise<T>,ttl:number):Promise<T> {
  try { const v=await redis.get(key); if(v!==null) return JSON.parse(v) as T; } catch { /* database fallback */ }
  const data=await work(); try{await redis.set(key,JSON.stringify(data),'EX',ttl);}catch{/*db fallback*/}
  return data;
}
export async function cacheKey(subkey:string):Promise<string> {
  let epoch='0'; try {epoch=(await redis.get('cache:epoch'))??'0';}catch{}
  return `public:${epoch}:${subkey}`;
}
export async function bustPublicCache() { try {await redis.incr('cache:epoch');}catch{} }
