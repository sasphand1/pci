import {skipRuntimeDDL} from '../architecture/managed-runtime.js';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pool} from './db.js';
/** Idempotent Satify Hub bootstrap (own `satify` schema). Safe on every start of the API and the worker. */
export async function ensureSatifySchema():Promise<void>{if(skipRuntimeDDL())return;
 const client=await pool.connect();let locked=false;
 try{
  await client.query('SELECT pg_advisory_lock(710441)');locked=true;
  await client.query('BEGIN');
  try{
   for(const version of ['121_satify_hub.sql','122_satify_packs.sql','123_satify_engine.sql']){
    const filename=fileURLToPath(new URL(`../../database/migrations/${version}`,import.meta.url));
    await client.query(await readFile(filename,'utf8'));
   }
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
 }finally{try{if(locked)await client.query('SELECT pg_advisory_unlock(710441)');}finally{client.release();}}
}
