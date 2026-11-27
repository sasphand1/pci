import {readFile} from 'node:fs/promises';
import {transaction} from './db.js';
export async function ensureTikTokSchema(){
 const sql=await readFile(new URL('../../database/migrations/127_tiktok_oauth.sql',import.meta.url),'utf8');
 await transaction(async c=>{await c.query('SELECT pg_advisory_xact_lock(710323)');await c.query(sql);});
}
