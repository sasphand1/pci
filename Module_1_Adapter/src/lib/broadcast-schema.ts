import {readFile} from 'node:fs/promises';
import {transaction} from './db.js';

/** Same migration file for CLI and automatic Hostinger startup. */
export async function ensureBroadcastSchema():Promise<void>{
 const sql=await readFile(new URL('../../database/migrations/124_broadcast.sql',import.meta.url),'utf8');
 await transaction(async c=>{
  // Share the existing migration lock, so concurrent API/CLI startup cannot race.
  await c.query('SELECT pg_advisory_xact_lock(710323)');
  await c.query(sql);
 });
}
