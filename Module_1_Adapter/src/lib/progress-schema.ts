import {skipRuntimeDDL} from '../architecture/managed-runtime.js';
import {readFile} from 'node:fs/promises';
import {transaction} from './db.js';

async function apply(file:string):Promise<void>{if(skipRuntimeDDL())return;
 const sql=await readFile(new URL(`../../database/migrations/${file}`,import.meta.url),'utf8');
 await transaction(async c=>{
  // Share the existing migration lock, so concurrent API/CLI startup cannot race.
  await c.query('SELECT pg_advisory_xact_lock(710323)');
  await c.query(sql);
 });
}
/** Same migration files for CLI and automatic Hostinger startup. */
export const ensureProgressSchema=()=>apply('125_progress_boards.sql');
/** Hub source rhythms (idempotent: only changes values still at the shipped default). */
export const ensureHubCadence=()=>apply('126_hub_source_cadence.sql');
