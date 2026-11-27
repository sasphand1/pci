import {readFile} from 'node:fs/promises';
import {transaction} from './db.js';

/** Same migration file for CLI and automatic Hostinger startup. */
export async function ensureProgressSchema():Promise<void>{
 const sql=await readFile(new URL('../../database/migrations/125_progress_boards.sql',import.meta.url),'utf8');
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(710323)');
  await c.query(sql);
 });
}
