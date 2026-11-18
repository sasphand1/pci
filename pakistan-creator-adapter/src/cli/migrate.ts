import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { pool } from '../lib/db.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../database/migrations');
async function main(){
 const c=await pool.connect();
 try {
   await c.query('SELECT pg_advisory_lock(710323)');
   await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
   for(const name of (await readdir(root)).filter(x=>/^\d{3}_[a-z0-9_]+\.sql$/.test(x)).sort()){
     if((await c.query('SELECT 1 FROM schema_migrations WHERE version=$1',[name])).rowCount)continue;
     const sql=await readFile(resolve(root,name),'utf8');
     await c.query('BEGIN');
     try {
       await c.query(sql);
       await c.query('INSERT INTO schema_migrations(version) VALUES($1)',[name]);
       await c.query('COMMIT');
       console.info('Applied migration',name);
     } catch(e) { await c.query('ROLLBACK');throw e; }
   }
 } finally {await c.query('SELECT pg_advisory_unlock(710323)');c.release();await pool.end();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
