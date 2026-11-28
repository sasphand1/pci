/** Opt-in restricted runtime startup. Schema creation stays with the maintenance connection.
 * Catalog checks are prerequisites, not a complete compatibility certification. */
import { readRuntimeEvidence, runtimeRoleFindings, type RoleEvidence } from './runtime-audit.js';
export const REQUIRED_RELATIONS = [
  "broadcast.deliveries",
  "broadcast.events",
  "broadcast.jobs",
  "public.accounts",
  "public.admin_audit_logs",
  "public.admin_users",
  "public.app_settings",
  "public.avatar_cache",
  "public.avatar_cache_attempts",
  "public.categories",
  "public.channel_stats_latest",
  "public.creator_catalogue_scan",
  "public.creator_categories",
  "public.creator_video_catalogue",
  "public.creator_video_view_observations",
  "public.creators",
  "public.email_verifications",
  "public.event_source_runs",
  "public.event_sources",
  "public.hall_of_fame",
  "public.hub_account_metrics",
  "public.hub_tiktok_registered",
  "public.hub_avatar_attempts",
  "public.hub_discrepancies",
  "public.hub_graph_avatar_attempts",
  "public.hub_meta",
  "public.hub_source_health",
  "public.ingest_content",
  "public.ingest_jobs",
  "public.ingest_latest",
  "public.ingest_observations",
  "public.ingest_sources",
  "public.local_place_overrides",
  "public.local_place_runs",
  "public.local_place_tombstones",
  "public.local_places",
  "public.metric_observations",
  "public.password_resets",
  "public.pci_editorial_events",
  "public.pci_event_action_log",
  "public.pci_events",
  "public.people",
  "public.person_categories",
  "public.pipeline_alerts",
  "public.pipeline_runs",
  "public.progress_boards",
  "public.publication_state",
  "public.published_pointers",
  "public.rank_history",
  "public.rank_runs",
  "public.rank_slots",
  "public.refresh_results",
  "public.refresh_runs",
  "public.restaurant_image_cache",
  "public.restaurant_image_discovery",
  "public.restaurant_image_http_state",
  "public.schema_migrations",
  "public.scrappa_admin_keys",
  "public.scrappa_candidates",
  "public.scrappa_credit_ledger",
  "public.scrappa_credit_month",
  "public.scrappa_key_credit_month",
  "public.scrappa_pending_accounts",
  "public.scrappa_profile_checks",
  "public.scrappa_snapshots",
  "public.sync_account_results",
  "public.sync_runs",
  "public.video_stats_latest",
  "public.videos",
  "public.wall_bans",
  "public.wall_messages",
  "public.wall_reports",
  "public.wall_users",
  "public.worker_heartbeats",
  "satellite.observations",
  "satellite.providers",
  "satellite.rollout_flags",
  "satify.applied",
  "satify.deliveries",
  "satify.engine_notes",
  "satify.events",
  "satify.interest",
  "satify.jobs",
  "satify.manual_signals",
  "satify.packs",
  "satify.readings",
  "satify.school_registrations",
  "satify.signals_latest",
  "satify.sources",
  "satify.subscribers",
  "satify.subscriptions",
  "tiktokingest.connections",
  "tiktokingest.oauth_states"
] as const;
export const REQUIRED_GUARDS = ['ingest_latest:pci_arch_latest_guard','ingest_latest:pci_arch_z_hub_route_guard','ingest_observations:pci_arch_observation_guard','ingest_observations:pci_arch_z_hub_route_guard','published_pointers:pci_arch_pointer_guard','rank_runs:pci_arch_run_guard'] as const;
const REQUIRED_MIGRATIONS=['134_architecture_integrity.sql','135_architecture_source_routes.sql','136_tiktok_central_projection.sql'];
export function schemaMode(value=process.env.PCI_SCHEMA_MODE):'legacy'|'managed' {
  if(value===undefined||value==='legacy')return 'legacy';
  if(value==='managed')return 'managed';
  throw new Error('PCI_MANAGED_001: invalid PCI_SCHEMA_MODE; use legacy or managed.');
}
export function managedFindings(e:RoleEvidence,guards:readonly string[],ledger:readonly string[]):string[]{
  const findings=runtimeRoleFindings(e);
  if(e.role.username!=='pci_runtime')findings.push('PCI_MANAGED_002: managed runtime must use pci_runtime.');
  const present=new Set(e.relations.map(r=>`${r.schema}.${r.relation}`));
  const missing=REQUIRED_RELATIONS.filter(r=>!present.has(r));
  if(missing.length)findings.push('PCI_MANAGED_003: missing reviewed schema relations: '+missing.join(', '));
  if(REQUIRED_GUARDS.some(g=>!guards.includes(g)))findings.push('PCI_MANAGED_004: architecture guard missing or disabled.');
  if(REQUIRED_MIGRATIONS.some(m=>!ledger.includes(m)))findings.push('PCI_MANAGED_005: reviewed architecture migrations are not recorded.');
  const history=e.relations.find(r=>r.schema==='public'&&r.relation==='schema_migrations');
  if(!history?.can_read||history.can_insert||history.can_update||history.can_delete)findings.push('PCI_MANAGED_006: migration ledger must be read-only to runtime.');
  return findings;
}
let verified=false;
export async function verifyManagedRuntime():Promise<void>{
  if(schemaMode()==='legacy')return;
  verified=false;
  const {pool}=await import('../lib/db.js');
  const c=await pool.connect();
  try{
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const evidence=await readRuntimeEvidence(c);
    const guards=(await c.query(`SELECT c.relname || ':' || t.tgname AS guard FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND t.tgenabled IN ('O','A') AND NOT t.tgisinternal`)).rows.map(r=>String(r.guard));
    const ledger=(await c.query('SELECT version FROM public.schema_migrations ORDER BY version')).rows.map(r=>String(r.version));
    const findings=managedFindings(evidence,guards,ledger);
    if(findings.length)throw new Error(findings.join(' | '));
  }finally{try{await c.query('ROLLBACK');}finally{c.release();}}
  verified=true;
}
/** All reviewed DDL bootstrap functions call this before doing any DDL. */
export function skipRuntimeDDL():boolean{
  if(schemaMode()==='legacy')return false;
  if(!verified)throw new Error('PCI_MANAGED_007: restricted runtime schema preflight has not passed.');
  return true;
}
