import type { AuditDb } from './migration-safety.js';

/** Conservative prerequisite for a restricted runtime role. Does NOT certify per-module isolation. */
export type RoleEvidence = {
  role: { username: string; session_role: string; superuser: boolean; create_role: boolean; create_database: boolean; bypass_rls: boolean; database_owner: boolean; database_create: boolean; database_temp: boolean };
  privilegedMemberships: { role: string }[];
  schemas: { schema: string; owner_member: boolean; can_create: boolean }[];
  relations: { schema: string; relation: string; owner_member: boolean; can_read: boolean; can_insert: boolean; can_update: boolean; can_delete: boolean; can_truncate: boolean; can_trigger: boolean }[];
};
export function runtimeRoleFindings(e: RoleEvidence): string[] {
  const out: string[] = [];
  if (e.role.superuser || e.role.create_role || e.role.create_database || e.role.bypass_rls || e.role.database_owner || e.role.database_create || e.role.database_temp)
    out.push('PCI_ARCH_ROLE_001: runtime role has database-wide administrative or object-creation authority. Use a non-owner, restricted runtime login.');
  if (e.role.username !== e.role.session_role || e.privilegedMemberships.length)
    out.push('PCI_ARCH_ROLE_002: session identity or membership can reach a privileged role. Remove privileged membership from the runtime login.');
  if (e.schemas.some(s=>s.can_create || s.owner_member))
    out.push('PCI_ARCH_ROLE_003: runtime can create or own schema objects. Keep DDL in a separately authorized migration process.');
  if (e.relations.some(r=>r.owner_member || r.can_truncate || r.can_trigger))
    out.push('PCI_ARCH_ROLE_004: runtime owns relations or has destructive/trigger authority. Review table-level grants before enabling isolation.');
  return out;
}

export async function readRuntimeEvidence(db: AuditDb): Promise<RoleEvidence> {
  const role = (await db.query(`SELECT current_user AS username, session_user AS session_role,
      r.rolsuper AS superuser,r.rolcreaterole AS create_role,r.rolcreatedb AS create_database,r.rolbypassrls AS bypass_rls,
      pg_has_role(current_user,d.datdba,'MEMBER') AS database_owner,
      has_database_privilege(current_user,d.oid,'CREATE') AS database_create,
      has_database_privilege(current_user,d.oid,'TEMP') AS database_temp
    FROM pg_catalog.pg_roles r CROSS JOIN pg_catalog.pg_database d
    WHERE r.rolname=current_user AND d.datname=current_database()`)).rows[0];
  if (!role) throw new Error('PCI_ARCH_ROLE_005: cannot establish runtime role identity.');
  const privilegedMemberships = (await db.query(`SELECT rolname AS role FROM pg_catalog.pg_roles
    WHERE rolname<>current_user AND pg_has_role(current_user,oid,'MEMBER')
      AND (rolsuper OR rolcreaterole OR rolcreatedb OR rolbypassrls) ORDER BY rolname`)).rows;
  const schemas = (await db.query(`SELECT nspname AS schema, pg_has_role(current_user,nspowner,'MEMBER') AS owner_member,
    has_schema_privilege(current_user,oid,'CREATE') AS can_create FROM pg_catalog.pg_namespace
    WHERE nspname !~ '^pg_' AND nspname<>'information_schema' ORDER BY nspname`)).rows;
  const relations = (await db.query(`SELECT n.nspname AS schema,c.relname AS relation,pg_has_role(current_user,c.relowner,'MEMBER') AS owner_member,
    has_table_privilege(current_user,c.oid,'SELECT') AS can_read,has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
    has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,has_table_privilege(current_user,c.oid,'DELETE') AS can_delete,
    has_table_privilege(current_user,c.oid,'TRUNCATE') AS can_truncate,has_table_privilege(current_user,c.oid,'TRIGGER') AS can_trigger
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND c.relkind IN ('r','p','v','m','f')
    ORDER BY n.nspname,c.relname`)).rows;
  return {role,privilegedMemberships,schemas,relations};
}
