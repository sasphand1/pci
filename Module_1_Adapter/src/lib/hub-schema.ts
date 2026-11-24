import {pool} from './db.js';
/** Same additive DDL as migrations 104 and 105; executed at startup (after publication and ingest schemas). */
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

-- Retry bookkeeping for the optional web picture fill (additive).
CREATE TABLE IF NOT EXISTS hub_avatar_attempts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text
);

-- Separate, additive bookkeeping for the official Meta avatar-only collector.
CREATE TABLE IF NOT EXISTS hub_graph_avatar_attempts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_graph_avatar_attempts_latest_idx
  ON hub_graph_avatar_attempts (last_attempt_at DESC);

-- Own copy of each Instagram profile picture so expiring CDN links never blank the site.
CREATE TABLE IF NOT EXISTS avatar_cache (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  content_type text NOT NULL,
  bytes bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 400000),
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS avatar_cache_attempts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text NOT NULL
);

-- Local places (restaurants) per city, collected from Google Places.
CREATE TABLE IF NOT EXISTS local_places (
  place_id text PRIMARY KEY,
  city text NOT NULL CHECK (city IN ('karachi','lahore','islamabad')),
  name text NOT NULL,
  address text,
  area text,
  rating numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_count integer NOT NULL CHECK (review_count >= 0),
  score numeric(4,3) NOT NULL,
  maps_url text,
  business_status text,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS local_places_city_score_idx ON local_places (city, score DESC);
CREATE TABLE IF NOT EXISTS local_place_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  requests integer NOT NULL DEFAULT 0,
  found integer NOT NULL DEFAULT 0,
  kept integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'running'
);
`;
export async function ensureHubSchema():Promise<void> {
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(710324)');
    try { await client.query(HUB_SCHEMA_SQL); }
    finally { await client.query('SELECT pg_advisory_unlock(710324)'); }
  } finally { client.release(); }
}
