import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pool} from './db.js';

/** Idempotent runtime bootstrap for the Satellite module on Hostinger. */
export async function ensureSatelliteSchema():Promise<void>{
 const filename=fileURLToPath(new URL('../../database/migrations/096_satellite.sql',import.meta.url));
 const sql=await readFile(filename,'utf8');
 const client=await pool.connect();
 let locked=false;
 try{
  await client.query('SELECT pg_advisory_lock(710331)');locked=true;
  await client.query('BEGIN');
  try{await client.query(sql);await client.query('COMMIT');}
  catch(error){await client.query('ROLLBACK');throw error;}
 }finally{
  try{if(locked)await client.query('SELECT pg_advisory_unlock(710331)');}
  finally{client.release();}
 }
}
