/** Run with the actual backend DATABASE_URL; never print the connection string. */
import { pool } from '../lib/db.js';
import { readRuntimeEvidence, runtimeRoleFindings } from '../architecture/runtime-audit.js';
import { readMigrationState } from '../architecture/migration-safety.js';
async function main(){
  const c=await pool.connect();
  try{
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const evidence=await readRuntimeEvidence(c);
    const findings=runtimeRoleFindings(evidence);
    const migration=await readMigrationState(c);
    console.log(JSON.stringify({schemaVersion:1,checkedAt:new Date().toISOString(),
      runtimeRoleStatus:findings.length?'blocked':'prerequisites_met_not_certified',findings,evidence,migration},null,2));
    if(process.argv.includes('--require-restricted')&&findings.length)process.exitCode=2;
  }finally{try{await c.query('ROLLBACK');}finally{c.release();}}
}
main().catch(()=>{console.error('PCI_ARCH_ROLE_005: preflight could not complete. Check backend connectivity and database catalog access; no credentials are printed.');process.exitCode=1;}).finally(()=>pool.end());
