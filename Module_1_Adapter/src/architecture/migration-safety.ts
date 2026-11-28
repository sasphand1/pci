/** A ledger is evidence, not a list to fabricate from existing schema objects. */
export type MigrationState = { applied: readonly string[]; applicationObjects: readonly string[] };
export type MigrationPlan = { status: 'ready' | 'blocked'; pending: string[]; issues: string[]; appliedCount: number; existingObjectCount: number };
export const MIGRATION_NAME = /^\d{3}_[a-z0-9_]+\.sql$/;
export function planMigrations(files: readonly string[], state: MigrationState): MigrationPlan {
  const ordered = [...files].sort();
  const applied = new Set(state.applied);
  const known = new Set(ordered);
  const pending = ordered.filter(name => !applied.has(name));
  const issues: string[] = [];
  if (!ordered.length || ordered.some(name => !MIGRATION_NAME.test(name)) || known.size !== ordered.length)
    issues.push('PCI_ARCH_MIG_001: invalid migration file inventory; restore the verified repository migration set.');
  if (applied.size !== state.applied.length || [...applied].some(name => !known.has(name)))
    issues.push('PCI_ARCH_MIG_002: migration ledger has unknown or duplicate entries; reconcile against the deployed revision.');
  if (applied.size === 0 && state.applicationObjects.length > 0)
    issues.push('PCI_ARCH_MIG_003: populated database has an empty migration ledger; verify historical schema and data effects on a disposable copy before recording a reviewed baseline. Do not replay old migrations.');
  let gap = false;
  for (const name of ordered) {
    if (!applied.has(name)) gap = true;
    else if (gap) {
      issues.push('PCI_ARCH_MIG_004: migration ledger has a historical gap; reconcile the missing migrations instead of replaying them.');
      break;
    }
  }
  return { status: issues.length ? 'blocked' : 'ready', pending, issues, appliedCount: applied.size, existingObjectCount: state.applicationObjects.length };
}

export type AuditDb = { query(sql: string, values?: unknown[]): Promise<{rows: any[]}> };
/** Catalog queries do not modify the schema. Extension-owned relations are not application data. */
export async function readMigrationState(db: AuditDb): Promise<MigrationState> {
  const exists = (await db.query("SELECT to_regclass('public.schema_migrations') IS NOT NULL AS present")).rows[0]?.present;
  const applied = exists ? (await db.query('SELECT version FROM public.schema_migrations ORDER BY version')).rows.map(r => String(r.version)) : [];
  const objects = (await db.query(`SELECT n.nspname || '.' || c.relname AS name
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE c.relkind IN ('r','p','v','m','f','S') AND n.nspname !~ '^pg_' AND n.nspname <> 'information_schema'
      AND NOT (n.nspname='public' AND c.relname='schema_migrations')
      AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_class'::regclass AND d.objid=c.oid AND d.deptype='e')
    ORDER BY n.nspname,c.relname`)).rows.map(r => String(r.name));
  return { applied, applicationObjects: objects };
}
