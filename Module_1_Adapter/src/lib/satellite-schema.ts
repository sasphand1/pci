import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pool} from './db.js';
/** Idempotent runtime schema bootstrap for hosting deployments. */
export async function ensureSatelliteSchema():Promise<void>{
 const client=await pool.connect();let locked=false;
 try{
  await client.query('SELECT pg_advisory_lock(710331)');locked=true;
  await client.query('BEGIN');
  try{
   for(const version of ['096_satellite.sql','098_satellite_feeds.sql','099_earth_science_sources.sql']){
    const filename=fileURLToPath(new URL(`../../database/migrations/${version}`,import.meta.url));
    await client.query(await readFile(filename,'utf8'));
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(710331)');}finally{client.release();}}
}
