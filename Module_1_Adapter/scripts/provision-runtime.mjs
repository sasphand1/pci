/** Explicit maintenance operation. Does not run migrations or change Hostinger.
 * Requires a direct owner URL, a confirmed target fingerprint, and private password input. */
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {targetToken,inspect} from './architecture-release.mjs';
import {readRuntimeEvidence} from '../src/architecture/runtime-audit.ts';
import {REQUIRED_RELATIONS,REQUIRED_GUARDS,managedFindings} from '../src/architecture/managed-runtime.ts';
const ident=v=>'"'+String(v).replaceAll('"','""')+'"';
const SCHEMAS=['public','satellite','satify','broadcast'];
export function checkTarget(url,confirm){
 if(!confirm||targetToken(url)!==confirm)throw Error('PCI_RUNTIME_TARGET: incorrect confirmed database endpoint.');
 if(new URL(url).hostname.includes('-pooler.'))throw Error('PCI_RUNTIME_TARGET: use the direct (non-pooled) maintenance connection.');
}
export function grantsFor(relation,kind){
 const [schema,table]=relation.split('.');
 if(!SCHEMAS.includes(schema))return null; // Disabled OAuth namespace is not accessible to the app.
 if(!['r','p','v','m','f'].includes(kind))throw Error('PCI_RUNTIME_SCHEMA: unexpected relation kind.');
 const access=table==='schema_migrations'||!['r','p'].includes(kind)?'SELECT':'SELECT,INSERT,UPDATE,DELETE';
 return {relation,access,sql:`GRANT ${access} ON ${ident(schema)}.${ident(table)} TO pci_runtime`};
}
export function verifyGrants(evidence,guards,ledger,grants){
 const findings=managedFindings(evidence,guards,ledger);
 for(const g of grants){
  const r=evidence.relations.find(x=>`${x.schema}.${x.relation}`===g.relation);
  if(!r?.can_read||(g.access.includes('INSERT')&&(!r.can_insert||!r.can_update||!r.can_delete)))findings.push(`PCI_RUNTIME_GRANT: missing reviewed permissions for ${g.relation}`);
 }
 return findings;
}
export async function provision(owner,{url,confirm,password,apply=false,verify=false,escapeLiteral,connectRuntime}){
 checkTarget(url,confirm);
 const evidence=await inspect(owner);
 if(!evidence.viewPresent||!REQUIRED_GUARDS.every(g=>evidence.activeTriggers.includes(g))||evidence.findings.invalid_pointers||evidence.findings.missing_history||!['134_architecture_integrity.sql','135_architecture_source_routes.sql','136_tiktok_central_projection.sql'].every(m=>evidence.ledger.includes(m)))throw Error('PCI_RUNTIME_SCHEMA: reviewed production migration checks have not passed.');
 const role=(await owner.query("SELECT rolname FROM pg_roles WHERE rolname='pci_runtime'")).rows[0];
 const grants=[];
 for(const relation of REQUIRED_RELATIONS){
  const r=(await owner.query('SELECT relkind FROM pg_class WHERE oid=to_regclass($1)',[relation])).rows[0];
  if(!r)throw Error('PCI_RUNTIME_SCHEMA: missing reviewed relation '+relation);
  const g=grantsFor(relation,r.relkind);if(g)grants.push(g);
 }
 if(apply&&verify)throw Error('PCI_RUNTIME_MODE: choose apply or verify, not both.');
 if(!apply&&!verify)return {status:'plan',roleExists:Boolean(role),relations:grants.length,requiresPublicTempRevocation:true};
 if(apply&&role)throw Error('PCI_RUNTIME_EXISTS: role already exists; do not silently rotate credentials. Use the existing role and separately verify it.');
 if(verify&&!role)throw Error('PCI_RUNTIME_EXISTS: role is not present. Provision it first.');
 if(typeof password!=='string'||password.length<20)throw Error('PCI_RUNTIME_PASSWORD: use a private password of at least 20 characters.');
 if(apply){
 let committed=false;
 try{
  await owner.query('BEGIN');
  await owner.query("SET LOCAL lock_timeout='5s'");
  await owner.query('SELECT pg_advisory_xact_lock(710323)');
  await owner.query('CREATE ROLE pci_runtime LOGIN NOINHERIT NOCREATEDB NOCREATEROLE PASSWORD '+escapeLiteral(password));
  const name=evidence.identity.database;
  await owner.query(`REVOKE TEMPORARY ON DATABASE ${ident(name)} FROM PUBLIC`);
  await owner.query(`GRANT CONNECT ON DATABASE ${ident(name)} TO pci_runtime`);
  for(const schema of SCHEMAS)await owner.query(`GRANT USAGE ON SCHEMA ${ident(schema)} TO pci_runtime`);
  for(const g of grants)await owner.query(g.sql);
  for(const schema of SCHEMAS)await owner.query(`GRANT USAGE ON ALL SEQUENCES IN SCHEMA ${ident(schema)} TO pci_runtime`);
  await owner.query('COMMIT');committed=true;
 }finally{if(!committed)await owner.query('ROLLBACK');}
 }
 // Test a real login after commit, not SET ROLE under the privileged maintenance connection.
 const u=new URL(url);u.username='pci_runtime';u.password=password;u.searchParams.set('sslmode','verify-full');
 const runtime=await connectRuntime(u.toString());
 try{
  const e=await readRuntimeEvidence(runtime);
  const findings=verifyGrants(e,evidence.activeTriggers,evidence.ledger,grants);
  return {status:findings.length?'blocked':'passed',role:e.role,findings,relations:grants.length,roleCommitted:true};
 }finally{await runtime.end();}
}
async function main(){
 const {values}=parseArgs({options:{confirm:{type:'string'},apply:{type:'boolean',default:false},verify:{type:'boolean',default:false}},strict:true});
 const url=process.env.PCI_MIGRATION_DATABASE_URL;
 if(!url)throw Error('PCI_RUNTIME_TARGET: set the maintenance URL privately.');
 checkTarget(url,values.confirm);
 const {default:pg}=await import('pg');const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:10000});
 try{const owner=await pool.connect();try{
  const result=await provision(owner,{url,confirm:values.confirm,password:process.env.PCI_RUNTIME_PASSWORD,apply:values.apply,verify:values.verify,escapeLiteral:pg.escapeLiteral,connectRuntime:connectionString=>new pg.Pool({connectionString,max:1,connectionTimeoutMillis:10000})});
  console.log(JSON.stringify(result,null,2));if(result.status==='blocked')process.exitCode=2;
 }finally{owner.release();}}finally{await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(/^PCI_RUNTIME_[A-Z]+:/.test(e?.message)?e.message:'PCI_RUNTIME_FAILED: provisioning or verification failed. If the role was committed, it remains present; do not change Hostinger until reviewed. No credentials printed.');process.exitCode=1;});
