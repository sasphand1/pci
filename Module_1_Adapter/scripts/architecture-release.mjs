/** Explicit, narrow activation of architecture migrations on an existing runtime-bootstrapped DB.
 * Never runs or marks historical migrations. A rehearsal is rolled back, not a deployment.
 * Does not change database roles or promote creator identities. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const sha = text => createHash('sha256').update(text).digest('hex');
export const MIGRATIONS = Object.freeze([
  ['134_architecture_integrity.sql', '632b3fb401b48c7aad9afadbf1e34b3f0a641b0fa5275ea60a430add377a7640'],
  ['135_architecture_source_routes.sql', '7bfa542a8820d4c5dfa7450af8de4f617b7116fe005ecd192dcbcc0c689099e4'],
]);
const TABLES = ['accounts','ingest_jobs','ingest_latest','ingest_observations','people','published_pointers','rank_runs','rank_slots','schema_migrations','scrappa_candidates','scrappa_snapshots'];
const EXPECTED = ['ingest_latest:pci_arch_latest_guard','ingest_latest:pci_arch_z_hub_route_guard','ingest_observations:pci_arch_observation_guard','ingest_observations:pci_arch_z_hub_route_guard','published_pointers:pci_arch_pointer_guard','rank_runs:pci_arch_run_guard'];
const die = (code,message) => { throw new Error(`${code}: ${message}`); };
export function targetToken(url) {
  const u = new URL(url);
  if (!['postgres:','postgresql:'].includes(u.protocol) || !u.hostname || !u.pathname.slice(1)) die('PCI_RELEASE_001','Use a PostgreSQL migration connection URL.');
  // A Neon pooled and direct connection to the same endpoint must not count as distinct.
  return sha(JSON.stringify([u.hostname.toLowerCase().replace(/-pooler(?=\.)/,''),u.port||'5432',decodeURIComponent(u.pathname.slice(1))]));
}
export async function verifiedMigrations(read = name => readFile(new URL(`../database/migrations/${name}`,import.meta.url),'utf8')) {
  const result=[];
  for(const [name,hash] of MIGRATIONS){
    const sql=(await read(name)).replace(/\r\n/g,'\n');
    if(sha(sql)!==hash) die('PCI_RELEASE_002',`Unexpected contents of ${name}; review the changed migration before activation.`);
    result.push({name,hash,sql});
  }
  return result;
}
const rows = async (db,sql,params=[]) => (await db.query(sql,params)).rows;
export async function inspect(db){
  const identity=(await rows(db,`SELECT current_database() AS database,current_user AS role,
     (SELECT count(*)::int FROM public.schema_migrations) AS ledger_count`))[0];
  const ledger=(await rows(db,'SELECT version FROM public.schema_migrations ORDER BY version')).map(r=>r.version);
  const columns=await rows(db,`SELECT c.relname AS relation,a.attname AS column,format_type(a.atttypid,a.atttypmod) AS type,
       a.attnotnull AS required,pg_get_expr(d.adbin,d.adrelid) AS default_value,a.attidentity AS identity
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY c.relname,a.attnum`,[TABLES]);
  const constraints=await rows(db,`SELECT c.relname AS relation,k.conname AS name,pg_get_constraintdef(k.oid) AS definition,k.convalidated AS validated
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) ORDER BY c.relname,k.conname`,[TABLES]);
  const triggers=await rows(db,`SELECT c.relname AS relation,t.tgname AS name,t.tgenabled AS enabled,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,[TABLES]);
  const missing=TABLES.filter(t=>!columns.some(c=>c.relation===t));
  if(missing.length) die('PCI_RELEASE_003',`Missing prerequisite tables: ${missing.join(', ')}.`);
  const findings=(await rows(db,`SELECT
    (SELECT count(*)::int FROM public.published_pointers p LEFT JOIN public.rank_runs r ON r.id=p.run_id
      WHERE r.id IS NULL OR r.scope<>p.scope OR r.status<>'published' OR r.published_at IS NULL) AS invalid_pointers,
    (SELECT count(*)::int FROM public.ingest_latest l WHERE l.source_id='scrappa.api' AND NOT EXISTS (
      SELECT 1 FROM public.ingest_observations o WHERE o.source_id=l.source_id AND o.entity_kind=l.entity_kind AND o.entity_id=l.entity_id AND o.metric=l.metric
      AND o.observed_at=l.observed_at AND o.accuracy=l.accuracy AND o.value_scale=l.value_scale
      AND o.value_numeric IS NOT DISTINCT FROM l.value_numeric AND o.value_text IS NOT DISTINCT FROM l.value_text)) AS missing_history,
    (SELECT count(*)::int FROM public.scrappa_candidates s WHERE s.published_at IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.accounts a WHERE a.platform='tiktok' AND a.external_id=s.external_id AND a.person_id=s.person_id)) AS unregistered_public_tiktok`))[0];
  return {identity,ledger,findings,schemaHash:sha(JSON.stringify({columns,constraints,triggers})),existingTriggers:triggers.map(t=>`${t.relation}:${t.name}`),activeTriggers:triggers.filter(t=>['O','A'].includes(t.enabled)).map(t=>`${t.relation}:${t.name}`)};
}
export function checkPending(evidence){
  const names=MIGRATIONS.map(m=>m[0]);
  if(evidence.ledger.some(name=>!names.includes(name))) die('PCI_RELEASE_004','Historical migration entries exist. Use the normal migration runner if its ledger is complete; otherwise reconcile the ledger separately.');
  if(evidence.ledger.length || (evidence.existingTriggers??evidence.activeTriggers).some(t=>EXPECTED.includes(t))) die('PCI_RELEASE_005','Architecture activation already exists or is partially installed. Inspect the ledger and triggers; do not replay.');
  if(evidence.findings.invalid_pointers!==0 || evidence.findings.missing_history!==0) die('PCI_RELEASE_006','Repair existing publication/projection integrity before activation.');
}
export function checkReceipt(receipt,token,evidence,migrations,now=Date.now()){
  if(!receipt || receipt.version!==1 || receipt.result!=='rolled_back_successfully' || receipt.target===token || receipt.schemaHash!==evidence.schemaHash || JSON.stringify(receipt.migrations)!==JSON.stringify(migrations.map(({name,hash})=>({name,hash})))) die('PCI_RELEASE_007','A successful rehearsal on a distinct matching clone with identical migration files is required.');
  const age=now-Date.parse(receipt.checkedAt);
  if(!Number.isFinite(age)||age<0||age>24*3600000) die('PCI_RELEASE_007','Rehearsal receipt is invalid or older than 24 hours.');
}
export async function runRelease(db,{mode='plan',token,confirmation,receipt,allowApply=false,clock=()=>new Date(),load=verifiedMigrations}={}){
  if(!['plan','rehearse','apply'].includes(mode)) die('PCI_RELEASE_001','Use plan, rehearse or apply.');
  if(mode==='apply'&&(!allowApply||confirmation!==token||!token)) die('PCI_RELEASE_008','Application requires explicit target confirmation and PCI_ARCH_RELEASE_ALLOW_APPLY=1.');
  const migrations=await load();
  await db.query(mode==='plan'?'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY':'BEGIN');
  let ended=false;
  try{
    await db.query("SET LOCAL statement_timeout='120s'");
    await db.query("SET LOCAL lock_timeout='5s'");
    if(mode!=='plan'){
      await db.query('SELECT pg_advisory_xact_lock(710323)');
      // Freeze the relevant rows while checking and installing; bounded lock wait above.
      await db.query('LOCK TABLE public.ingest_jobs, public.ingest_latest, public.ingest_observations, public.published_pointers, public.rank_runs, public.schema_migrations, public.scrappa_candidates IN SHARE ROW EXCLUSIVE MODE');
    }
    const evidence=await inspect(db);
    if(mode==='plan'){
      let ready=true,reason=null;try{checkPending(evidence);}catch(e){ready=false;reason=e.message;}
      await db.query('ROLLBACK');ended=true;
      return {mode,target:token,readyForRehearsal:ready,reason,...evidence,historicalLedgerReconciled:false};
    }
    checkPending(evidence);
    if(mode==='apply')checkReceipt(receipt,token,evidence,migrations,clock().getTime());
    // Only the exact two reviewed migration files. Never read or run migration 128 or any older file.
    for(const m of migrations){await db.query(m.sql);await db.query('INSERT INTO public.schema_migrations(version) VALUES($1)',[m.name]);}
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
    const after=await inspect(db);
    if(!EXPECTED.every(t=>after.activeTriggers.includes(t))||!migrations.every(m=>after.ledger.includes(m.name))) die('PCI_RELEASE_009','Not all expected architecture guards or migration records are present.');
    if(after.findings.invalid_pointers||after.findings.missing_history) die('PCI_RELEASE_009','Post-install integrity checks failed.');
    await db.query(mode==='rehearse'?'ROLLBACK':'COMMIT');ended=true;
    return {version:1,mode,result:mode==='rehearse'?'rolled_back_successfully':'committed',checkedAt:clock().toISOString(),target:token,schemaHash:evidence.schemaHash,migrations:migrations.map(({name,hash})=>({name,hash})),findings:after.findings,historicalLedgerReconciled:false};
  }finally{if(!ended)await db.query('ROLLBACK');}
}
async function main(){
  const {values}=parseArgs({options:{mode:{type:'string',default:'plan'},receipt:{type:'string'},confirm:{type:'string'}},strict:true});
  const url=process.env.PCI_MIGRATION_DATABASE_URL;
  if(!url)die('PCI_RELEASE_001','Set PCI_MIGRATION_DATABASE_URL locally. Never paste credentials into chat or commit them.');
  const token=targetToken(url),mode=values.mode;
  if(mode==='rehearse'&&!values.receipt)die('PCI_RELEASE_001','Provide --receipt <new local file> for a clone rehearsal.');
  if(mode==='apply'&&!values.receipt)die('PCI_RELEASE_007','Provide a successful clone rehearsal receipt.');
  const receipt=mode==='apply'?JSON.parse(await readFile(values.receipt,'utf8')):undefined;
  const {default:pg}=await import('pg');const pool=new pg.Pool({connectionString:url,max:1,connectionTimeoutMillis:5000});
  try{const db=await pool.connect();try{
    const result=await runRelease(db,{mode,token,confirmation:values.confirm,receipt,allowApply:process.env.PCI_ARCH_RELEASE_ALLOW_APPLY==='1'});
    if(mode==='rehearse')await writeFile(values.receipt,JSON.stringify(result,null,2)+'\n',{flag:'wx',mode:0o600});
    console.log(JSON.stringify(result,null,2));
  }finally{db.release();}}finally{await pool.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{
  // Do not echo database errors/SQL, which can contain connection details or sensitive row values.
  console.error(/^PCI_RELEASE_\d{3}:/.test(e?.message)?e.message:'PCI_RELEASE_010: operation failed; check connection, database prerequisites and migration compatibility. Transaction was not committed unless COMMIT itself completed.');process.exitCode=1;
});
