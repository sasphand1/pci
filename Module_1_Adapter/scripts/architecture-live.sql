-- Run in the Neon SQL Editor. No production writes or migrations.
BEGIN READ ONLY;
-- 1. Actual source/metric/entity mapping and linked/unlinked coverage.
SELECT s.id AS source_id, o.entity_kind, o.metric,
       count(o.id) AS observations, count(DISTINCT o.account_id) AS linked_accounts,
       count(o.id) FILTER (WHERE o.account_id IS NULL) AS unlinked_observations,
       max(o.observed_at) AT TIME ZONE 'Asia/Karachi' AS last_observed_pkt
FROM ingest_sources s LEFT JOIN ingest_observations o ON o.source_id=s.id
GROUP BY s.id,o.entity_kind,o.metric ORDER BY s.id,o.entity_kind,o.metric;
-- 2. Actual schema (includes unexpected tables and views).
SELECT table_name,table_type FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;
-- 3. Current SQL role permissions. SQL Editor role may differ from the application role.
SELECT current_user AS inspected_role, session_user AS session_role,
       has_schema_privilege(current_user,'public','CREATE') AS can_create_in_public;
SELECT c.relname AS object_name, pg_get_userbyid(c.relowner) AS owner,
       has_table_privilege(current_user,c.oid,'SELECT') AS can_read,
       has_table_privilege(current_user,c.oid,'INSERT') AS can_insert,
       has_table_privilege(current_user,c.oid,'UPDATE') AS can_update,
       has_table_privilege(current_user,c.oid,'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m') ORDER BY c.relname;
-- 4. Registry and publication status, no token/credential data.
SELECT platform,count(*) AS accounts,count(*) FILTER(WHERE nullif(trim(avatar_url),'') IS NOT NULL) AS avatars FROM accounts GROUP BY platform ORDER BY platform;
SELECT scope,run_id,updated_at AT TIME ZONE 'Asia/Karachi' AS published_pkt FROM published_pointers ORDER BY scope;
-- 5. Scheduler and separate ingestion job evidence.
SELECT platform,trigger,status,created_at AT TIME ZONE 'Asia/Karachi' AS created_pkt FROM refresh_runs WHERE created_at>=now()-interval '7 days' ORDER BY created_at DESC;
SELECT source_id,trigger,status,created_at AT TIME ZONE 'Asia/Karachi' AS created_pkt,observations FROM ingest_jobs WHERE created_at>=now()-interval '7 days' ORDER BY created_at DESC;
ROLLBACK;
