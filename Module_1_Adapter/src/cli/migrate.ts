import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { pool } from '../lib/db.js';
import { MIGRATION_NAME, planMigrations, readMigrationState } from '../architecture/migration-safety.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../database/migrations');
async function main(){
 const args=process.argv.slice(2);
 if(args.length>1||(args.length===1&&args[0]!=='--audit'))throw new Error('PCI_ARCH_MIG_005: unsupported migration option; use no arguments or --audit.');
 const audit=args[0]==='--audit';
 const c=await pool.connect();
 let locked=false;
 try {
   if(audit) await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   else {await c.query('SELECT pg_advisory_lock(710323)');locked=true;}
   const files=(await readdir(root)).filter(x=>MIGRATION_NAME.test(x)).sort();
   const plan=planMigrations(files,await readMigrationState(c));
   if(audit){console.info(JSON.stringify(plan,null,2));return;}
   if(plan.status!=='ready')throw new Error(plan.issues.join('\n'));
   await c.query('CREATE TABLE IF NOT EXISTS public.schema_migrations(version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
   for(const name of plan.pending){
     const sql=await readFile(resolve(root,name),'utf8');
     await c.query('BEGIN');
     try {
       await c.query(sql);
       await c.query('INSERT INTO public.schema_migrations(version) VALUES($1)',[name]);
       await c.query('COMMIT');
       console.info('Applied migration',name);
     } catch(e) { await c.query('ROLLBACK');throw e; }
   }
 } finally {try{if(audit)await c.query('ROLLBACK');if(locked)await c.query('SELECT pg_advisory_unlock(710323)');}finally{c.release();await pool.end();}}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
