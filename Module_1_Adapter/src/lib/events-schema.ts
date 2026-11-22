import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {pool} from './db.js';

/** Same SQL file is the migration and bootstrap source of truth. */
export async function ensureEventsSchema(){
 const filename=fileURLToPath(new URL('../../database/migrations/097_events.sql',import.meta.url));
 const sql=await readFile(filename,'utf8');
 const client=await pool.connect();
 try{
  await client.query('SELECT pg_advisory_lock(710329)');
  await client.query(sql);
  const editorialSql=await readFile(fileURLToPath(new URL('../../database/migrations/098_editorial_events.sql',import.meta.url)),'utf8');
  await client.query(editorialSql);
 }finally{try{await client.query('SELECT pg_advisory_unlock(710329)');}finally{client.release();}}
}
