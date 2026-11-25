import {pool} from './db.js';
/** Same additive DDL as migrations 104-110; executed at startup (after publication and ingest schemas). */
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

-- Hand-curated restaurants (picks and hidden places).
CREATE TABLE IF NOT EXISTS local_place_overrides (
  place_id text PRIMARY KEY,
  city text NOT NULL CHECK (city IN ('karachi','lahore','islamabad')),
  mode text NOT NULL CHECK (mode IN ('pick','hide')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  name text NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS local_place_overrides_city_idx ON local_place_overrides (city, mode);

-- PCI Hub readers (additive). The hub becomes the one place every reader uses.
-- 1. Every write to the old metric table is copied into the hub in the same transaction.
-- 2. The existing history is copied once (idempotent, marked in hub_meta).
-- 3. hub_account_metrics gives readers the hub history with the API-first rule applied.
CREATE TABLE IF NOT EXISTS hub_meta (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ingest_observations_account_metric_idx
  ON ingest_observations(account_id, metric, observed_at DESC) WHERE entity_kind='account';

-- Latest values belong to an account where they describe one, so deleting the account (or the person)
-- removes them by cascade, the same as the readings themselves.
ALTER TABLE ingest_latest ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ingest_latest_account_idx ON ingest_latest(account_id) WHERE account_id IS NOT NULL;
CREATE OR REPLACE FUNCTION hub_latest_owner() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.account_id IS NULL THEN
    IF NEW.entity_kind='account' THEN
      SELECT id INTO NEW.account_id FROM accounts WHERE platform||':'||external_id = NEW.entity_id LIMIT 1;
    ELSIF NEW.entity_kind='content' THEN
      SELECT account_id INTO NEW.account_id FROM ingest_content WHERE platform||':'||content_id = NEW.entity_id LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS hub_latest_owner ON ingest_latest;
CREATE TRIGGER hub_latest_owner BEFORE INSERT OR UPDATE ON ingest_latest FOR EACH ROW EXECUTE FUNCTION hub_latest_owner();
UPDATE ingest_latest l SET account_id=a.id FROM accounts a
  WHERE l.account_id IS NULL AND l.entity_kind='account' AND l.entity_id=a.platform||':'||a.external_id;
UPDATE ingest_latest l SET account_id=c.account_id FROM ingest_content c
  WHERE l.account_id IS NULL AND l.entity_kind='content' AND l.entity_id=c.platform||':'||c.content_id AND c.account_id IS NOT NULL;
-- Remove latest values left behind by accounts deleted before this column existed.
DELETE FROM ingest_latest l WHERE l.entity_kind='account' AND l.account_id IS NULL
  AND l.entity_id ~ '^(youtube|instagram):' AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.platform||':'||a.external_id=l.entity_id);

CREATE OR REPLACE FUNCTION hub_mirror_metric_observation() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE plat text; ext text; acc text;
BEGIN
  SELECT platform, external_id INTO plat, ext FROM accounts WHERE id = NEW.account_id;
  IF plat IS NULL OR plat NOT IN ('youtube','instagram') THEN RETURN NEW; END IF;
  acc := CASE WHEN NEW.accuracy = 'exact' THEN 'exact' ELSE 'rounded' END;
  BEGIN
    INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
    VALUES (plat||'.api', COALESCE(NEW.run_id::text, 'history:'||NEW.id::text), NEW.account_id, 'account',
      plat||':'||ext, NEW.metric, NEW.value, acc, NEW.observed_at, '{"origin":"legacy-write-mirror"}'::jsonb)
    ON CONFLICT (source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING;
    INSERT INTO ingest_latest (entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at)
    VALUES ('account', plat||':'||ext, NEW.metric, plat||'.api', NEW.value, acc, NEW.observed_at)
    ON CONFLICT (entity_kind,entity_id,metric) DO UPDATE SET
      source_id=EXCLUDED.source_id, value_numeric=EXCLUDED.value_numeric, value_text=NULL,
      accuracy=EXCLUDED.accuracy, observed_at=EXCLUDED.observed_at, updated_at=now()
    WHERE EXCLUDED.observed_at >= ingest_latest.observed_at;
  EXCEPTION WHEN OTHERS THEN
    -- Never lose the collection itself; the post-refresh mirror pass retries the copy.
    RAISE WARNING 'hub mirror skipped for observation %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END $fn$;

DO $$ BEGIN
  IF to_regclass('public.metric_observations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hub_mirror_metric_observations ON metric_observations;
    CREATE TRIGGER hub_mirror_metric_observations AFTER INSERT ON metric_observations
      FOR EACH ROW EXECUTE FUNCTION hub_mirror_metric_observation();
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.metric_observations') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM hub_meta WHERE key='legacy_history_v1') THEN
    INSERT INTO ingest_observations
      (source_id,source_run_ref,account_id,entity_kind,entity_id,metric,value_numeric,accuracy,observed_at,raw_metadata)
    SELECT a.platform||'.api', COALESCE(o.run_id::text,'history:'||o.id::text), o.account_id, 'account',
      a.platform||':'||a.external_id, o.metric, o.value,
      CASE WHEN o.accuracy='exact' THEN 'exact' ELSE 'rounded' END, o.observed_at,
      '{"origin":"legacy-history-copy"}'::jsonb
    FROM metric_observations o JOIN accounts a ON a.id=o.account_id
    WHERE a.platform IN ('youtube','instagram')
    ON CONFLICT (source_id,source_run_ref,entity_kind,entity_id,metric) DO NOTHING;
    INSERT INTO ingest_latest (entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at)
    SELECT DISTINCT ON (entity_id,metric) entity_kind,entity_id,metric,source_id,value_numeric,accuracy,observed_at
    FROM ingest_observations
    WHERE entity_kind='account' AND source_id IN ('youtube.api','instagram.api') AND value_numeric IS NOT NULL
    ORDER BY entity_id,metric,observed_at DESC
    ON CONFLICT (entity_kind,entity_id,metric) DO UPDATE SET
      source_id=EXCLUDED.source_id, value_numeric=EXCLUDED.value_numeric, value_text=NULL,
      accuracy=EXCLUDED.accuracy, observed_at=EXCLUDED.observed_at, updated_at=now()
    WHERE EXCLUDED.observed_at >= ingest_latest.observed_at;
    INSERT INTO hub_meta(key,value) VALUES ('legacy_history_v1', now()::text);
  END IF;
END $$;

-- Readers' view: same columns the old table had. An API reading always counts; a web (HTTP) reading
-- counts only when the API has no reading for that field within 7 days before it (or 1 day after).
CREATE OR REPLACE VIEW hub_account_metrics AS
SELECT o.id, o.account_id, o.metric, o.value_numeric AS value,
  CASE WHEN o.accuracy='exact' THEN 'exact' ELSE 'rounded3' END AS accuracy,
  o.observed_at, o.source_id
FROM ingest_observations o
JOIN ingest_sources s ON s.id=o.source_id
WHERE o.entity_kind='account' AND o.account_id IS NOT NULL AND o.value_numeric IS NOT NULL
  AND o.accuracy <> 'unverified' AND o.metric IN ('followers','views','posts_30d')
  AND (s.method='api' OR NOT EXISTS (
    SELECT 1 FROM ingest_observations x JOIN ingest_sources sx ON sx.id=x.source_id AND sx.method='api'
    WHERE x.entity_kind='account' AND x.entity_id=o.entity_id AND x.metric=o.metric
      AND x.observed_at BETWEEN o.observed_at - interval '7 days' AND o.observed_at + interval '1 day'));
`;
export async function ensureHubSchema():Promise<void> {
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(710324)');
    try { await client.query(HUB_SCHEMA_SQL); }
    finally { await client.query('SELECT pg_advisory_unlock(710324)'); }
  } finally { client.release(); }
}
