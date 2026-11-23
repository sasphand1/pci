import {pool} from './db.js';
/** Same additive DDL as migration 104; executed at startup (after publication and ingest schemas). */
export const HUB_SCHEMA_SQL = `-- PCI Hub v1 (additive). Monitor state, discrepancies and alert metadata.
DO $$ BEGIN
  IF to_regclass('public.pipeline_alerts') IS NOT NULL THEN
    ALTER TABLE pipeline_alerts ADD COLUMN IF NOT EXISTS source_id text;
    ALTER TABLE pipeline_alerts ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'warning';
    ALTER TABLE pipeline_alerts ADD COLUMN IF NOT EXISTS hub_key text;
    ALTER TABLE pipeline_alerts ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
    CREATE INDEX IF NOT EXISTS pipeline_alerts_hub_key_idx ON pipeline_alerts(hub_key) WHERE hub_key IS NOT NULL AND NOT acknowledged;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS hub_source_health (
  source_id text PRIMARY KEY REFERENCES ingest_sources(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','degraded','down','disabled')),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error_code text,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hub_discrepancies (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_kind text NOT NULL,
  entity_id text NOT NULL,
  metric text NOT NULL,
  api_value bigint NOT NULL,
  http_value bigint NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_discrepancies_recent_idx ON hub_discrepancies(detected_at DESC);
CREATE INDEX IF NOT EXISTS hub_discrepancies_entity_idx ON hub_discrepancies(entity_kind,entity_id,metric,detected_at DESC);

-- Pinned-comment collection is withdrawn. Drop the table only if it holds no rows.
DO $$ BEGIN
  IF to_regclass('public.ingest_creator_pinned_comments') IS NOT NULL THEN
    IF (SELECT count(*) FROM ingest_creator_pinned_comments) = 0 THEN
      DROP TABLE ingest_creator_pinned_comments;
    END IF;
  END IF;
END $$;
`;
export async function ensureHubSchema():Promise<void> {
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(710324)');
    try { await client.query(HUB_SCHEMA_SQL); }
    finally { await client.query('SELECT pg_advisory_unlock(710324)'); }
  } finally { client.release(); }
}
