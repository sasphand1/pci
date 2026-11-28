import {readReleaseCohort,releaseReadiness} from './release-readiness.js';
import {readMigrationState,planMigrations,MIGRATION_NAME,type AuditDb} from './migration-safety.js';
import {readRuntimeEvidence,runtimeRoleFindings} from './runtime-audit.js';
import {readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

// Fixed read-only queries; never accept client SQL or credentials.
export async function readArchitectureReport(db:AuditDb, files:readonly string[]){
 const runtime=await readRuntimeEvidence(db);
 const state=await readMigrationState(db);
 const migration=planMigrations(files,state);
 const rows=async(sql:string)=>(await db.query(sql)).rows;
 const inventory=await rows(`SELECT source_id,entity_kind,metric,count(*)::text AS observations,count(DISTINCT account_id)::int AS linked_accounts,max(observed_at) AS latest_at FROM public.ingest_observations GROUP BY 1,2,3 ORDER BY 1,2,3`);
 const registry=await rows(`SELECT platform,count(*)::int AS accounts,count(DISTINCT person_id)::int AS people FROM public.accounts GROUP BY platform ORDER BY platform`);
 const candidates=await rows(`SELECT count(*)::int AS candidates,count(*) FILTER (WHERE s.published_at IS NOT NULL)::int AS staged_public,count(*) FILTER (WHERE s.published_at IS NOT NULL AND a.id IS NULL)::int AS public_without_registry FROM public.scrappa_candidates s LEFT JOIN public.accounts a ON a.platform='tiktok' AND a.external_id=s.external_id AND a.person_id=s.person_id`);
 const publications=await rows(`SELECT p.scope,p.run_id,r.status,r.scope AS run_scope,r.published_at FROM public.published_pointers p LEFT JOIN public.rank_runs r ON r.id=p.run_id ORDER BY p.scope`);
 const history=await rows(`SELECT count(*)::int AS unmatched FROM public.ingest_latest l WHERE l.source_id='scrappa.api' AND NOT EXISTS (SELECT 1 FROM public.ingest_observations o WHERE o.source_id=l.source_id AND o.entity_kind=l.entity_kind AND o.entity_id=l.entity_id AND o.metric=l.metric AND o.observed_at=l.observed_at AND o.accuracy=l.accuracy AND o.value_scale=l.value_scale AND o.value_numeric IS NOT DISTINCT FROM l.value_numeric AND o.value_text IS NOT DISTINCT FROM l.value_text)`);
 const scheduler=await rows(`SELECT trigger,status,created_at,finished_at FROM public.pipeline_runs WHERE created_at>=now()-interval '14 days' ORDER BY created_at DESC LIMIT 100`);
 const scheduledDays=await rows(`SELECT d::date::text AS day, count(p.id)::int AS runs FROM generate_series((now() AT TIME ZONE 'Asia/Karachi')::date-13,(now() AT TIME ZONE 'Asia/Karachi')::date,'1 day'::interval) d LEFT JOIN public.pipeline_runs p ON p.trigger='scheduled' AND (p.created_at AT TIME ZONE 'Asia/Karachi')::date=d::date WHERE d::date<(now() AT TIME ZONE 'Asia/Karachi')::date OR (now() AT TIME ZONE 'Asia/Karachi')::time>=time '09:00' GROUP BY d ORDER BY d DESC`);
 const triggers=await rows(`SELECT c.relname AS table_name,t.tgname,t.tgenabled FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgname LIKE 'pci_arch_%' ORDER BY 1,2`);
 const findings=[...runtimeRoleFindings(runtime),...migration.issues];
 if(Number(candidates[0]?.public_without_registry)>0) findings.push('PCI_ARCH_004: public TikTok candidates lack registry association. Complete verified registry promotion and central publication.');
 if(Number(candidates[0]?.staged_public)>0&&!publications.some(p=>p.scope==='tiktok.followers')) findings.push('PCI_ARCH_005: central TikTok followers publication is missing. Complete the ranking cutover.');
 if(publications.some(p=>p.status!=='published'||p.scope!==p.run_scope||!p.published_at)) findings.push('PCI_ARCH_DB_007: invalid publication pointer. Review the central publisher.');
 if(Number(history[0]?.unmatched)>0) findings.push('PCI_ARCH_DB_006: Scrappa projections lack matching observations. Review ingestion provenance.');
 const expected=[['ingest_observations','pci_arch_observation_guard'],['ingest_latest','pci_arch_latest_guard'],['published_pointers','pci_arch_pointer_guard'],['rank_runs','pci_arch_run_guard'],['ingest_observations','pci_arch_z_hub_route_guard'],['ingest_latest','pci_arch_z_hub_route_guard']];
 const missingTriggers=expected.filter(([table,name])=>!triggers.some(t=>t.table_name===table&&t.tgname===name&&['O','A'].includes(t.tgenabled))).map(x=>x.join('.'));
 if(missingTriggers.length)findings.push('PCI_ARCH_DB_010: architecture triggers missing or inactive. Reconcile migrations before activation.');
 if(scheduledDays.some(d=>d.runs===0))findings.push('PCI_ARCH_SCHEDULE_001: scheduled collection days missing in the last 14 days. Review worker and daily recovery.');
 const release=releaseReadiness({mode:process.env.PCI_TIKTOK_CENTRAL??'off',schemaMode:process.env.PCI_SCHEMA_MODE??'legacy',runtimeRole:runtime.role.username,runtimeFindings:runtimeRoleFindings(runtime),migrationIssues:migration.issues,missingTriggers,invalidPointers:publications.filter(p=>p.status!=='published'||p.scope!==p.run_scope||!p.published_at).length,unmatched:Number(history[0]?.unmatched??0),cohort:await readReleaseCohort(db),scheduledDays:scheduledDays.map(d=>({day:String(d.day),runs:Number(d.runs)}))});
 return {release,checkedAt:new Date().toISOString(),status:findings.length?'attention_required':'checks_passed_not_certified',findings,runtime,migration,appliedMigrations:state.applied,inventory,registry,candidates:candidates[0],publications,unmatchedScrappa:history[0]?.unmatched,scheduler,scheduledDays,triggers,missingTriggers};
}
export async function architectureMigrationFiles(){return (await readdir(fileURLToPath(new URL('../../database/migrations/',import.meta.url)))).filter(x=>MIGRATION_NAME.test(x)).sort();}
