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
   // v4 is self-contained: it creates missing tables and owns the provider and metric constraints.
   for(const version of ['118_satellite_open_data.sql']){
    const filename=fileURLToPath(new URL(`../../database/migrations/${version}`,import.meta.url));
    await client.query(await readFile(filename,'utf8'));
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(710331)');}finally{client.release();}}
}
