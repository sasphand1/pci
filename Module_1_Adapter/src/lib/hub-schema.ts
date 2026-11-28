import {skipRuntimeDDL} from '../architecture/managed-runtime.js';
import {pool} from './db.js';
/** Same additive DDL as migrations 104-120 (hub parts); executed at startup (after publication and ingest schemas). */
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

-- PCI Hub open to every category + permanent ranking history (additive, idempotent).
-- Sources are no longer limited to YouTube/Instagram/TikTok: any source family (google_places, x,
-- commodities, air ...) and any entity kind (place, commodity, trend, city ...) can be stored.
DO $$ BEGIN
  ALTER TABLE ingest_sources DROP CONSTRAINT IF EXISTS ingest_sources_platform_check;
  ALTER TABLE ingest_sources DROP CONSTRAINT IF EXISTS ingest_sources_method_check;
  ALTER TABLE ingest_observations DROP CONSTRAINT IF EXISTS ingest_observations_entity_kind_check;
  ALTER TABLE ingest_latest DROP CONSTRAINT IF EXISTS ingest_latest_entity_kind_check;
  ALTER TABLE ingest_content DROP CONSTRAINT IF EXISTS ingest_content_platform_check;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_sources_platform_fmt') THEN
    ALTER TABLE ingest_sources ADD CONSTRAINT ingest_sources_platform_fmt CHECK (platform ~ '^[a-z][a-z0-9_]{1,31}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_sources_method_fmt') THEN
    ALTER TABLE ingest_sources ADD CONSTRAINT ingest_sources_method_fmt CHECK (method IN ('api','http','manual'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_observations_entity_kind_fmt') THEN
    ALTER TABLE ingest_observations ADD CONSTRAINT ingest_observations_entity_kind_fmt CHECK (entity_kind ~ '^[a-z][a-z0-9_]{1,31}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_latest_entity_kind_fmt') THEN
    ALTER TABLE ingest_latest ADD CONSTRAINT ingest_latest_entity_kind_fmt CHECK (entity_kind ~ '^[a-z][a-z0-9_]{1,31}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_content_platform_fmt') THEN
    ALTER TABLE ingest_content ADD CONSTRAINT ingest_content_platform_fmt CHECK (platform ~ '^[a-z][a-z0-9_]{1,31}$');
  END IF;
END $$;

-- What each source feeds, and how often it is expected to deliver (drives stale / no-data alerts).
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'creators';
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS expected_hours integer NOT NULL DEFAULT 24;
ALTER TABLE ingest_sources ADD COLUMN IF NOT EXISTS label text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_sources_category_fmt') THEN
    ALTER TABLE ingest_sources ADD CONSTRAINT ingest_sources_category_fmt CHECK (category ~ '^[a-z][a-z0-9_]{1,31}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_sources_expected_hours_rng') THEN
    ALTER TABLE ingest_sources ADD CONSTRAINT ingest_sources_expected_hours_rng CHECK (expected_hours BETWEEN 1 AND 744);
  END IF;
END $$;

-- Decimal readings (a rate of 280.15, a rating of 4.6) are stored as whole numbers with a scale:
-- real value = value_numeric / 10^value_scale. Creator counts keep scale 0.
ALTER TABLE ingest_observations ADD COLUMN IF NOT EXISTS value_scale smallint NOT NULL DEFAULT 0;
ALTER TABLE ingest_latest ADD COLUMN IF NOT EXISTS value_scale smallint NOT NULL DEFAULT 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_observations_value_scale_rng') THEN
    ALTER TABLE ingest_observations ADD CONSTRAINT ingest_observations_value_scale_rng CHECK (value_scale BETWEEN 0 AND 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ingest_latest_value_scale_rng') THEN
    ALTER TABLE ingest_latest ADD CONSTRAINT ingest_latest_value_scale_rng CHECK (value_scale BETWEEN 0 AND 6);
  END IF;
END $$;

UPDATE ingest_sources SET label=CASE id
  WHEN 'youtube.api' THEN 'YouTube Data API' WHEN 'instagram.api' THEN 'Instagram Graph API'
  WHEN 'youtube.http' THEN 'YouTube public pages' WHEN 'instagram.http' THEN 'Instagram public pages'
  WHEN 'tiktok.http' THEN 'TikTok public pages' ELSE label END
WHERE label IS NULL;
UPDATE ingest_sources SET expected_hours=36 WHERE id='instagram.api' AND expected_hours=24;

-- Restaurants: Google Places is a hub source like any other. Off until a weekly collection succeeds.
INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label)
VALUES ('google_places.api','google_places','api',false,'places',168,'Google Places API')
ON CONFLICT (id) DO NOTHING;

-- Permanent ranking history (hall of fame). One row per person per published ranking run.
-- These are PCI's own positions, not platform data, so they are kept for good. Deleting a person
-- removes their rows (a deleted creator leaves nothing).
CREATE TABLE IF NOT EXISTS rank_history (
  run_id uuid NOT NULL,
  scope text NOT NULL,
  published_at timestamptz NOT NULL,
  slot integer NOT NULL CHECK (slot >= 1),
  rank integer NOT NULL CHECK (rank >= 1),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  value bigint NOT NULL CHECK (value >= 0),
  PRIMARY KEY (run_id, slot)
);
CREATE INDEX IF NOT EXISTS rank_history_scope_time_idx ON rank_history(scope, published_at DESC);
CREATE INDEX IF NOT EXISTS rank_history_person_idx ON rank_history(person_id);

CREATE OR REPLACE FUNCTION hub_record_rank_history() RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  BEGIN
    INSERT INTO rank_history(run_id,scope,published_at,slot,rank,person_id,display_name,value)
    SELECT s.run_id, NEW.scope, COALESCE(r.published_at, NEW.updated_at, now()), s.slot, s.rank, s.person_id, p.display_name, s.value
    FROM rank_slots s JOIN rank_runs r ON r.id=s.run_id JOIN people p ON p.id=s.person_id
    WHERE s.run_id=NEW.run_id
    ON CONFLICT (run_id, slot) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'rank history not recorded for run %: %', NEW.run_id, SQLERRM;
  END;
  RETURN NEW;
END $fn$;

DO $$ BEGIN
  IF to_regclass('public.published_pointers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hub_rank_history ON published_pointers;
    CREATE TRIGGER hub_rank_history AFTER INSERT OR UPDATE OF run_id ON published_pointers
      FOR EACH ROW EXECUTE FUNCTION hub_record_rank_history();
  END IF;
END $$;

-- Seed history from every published ranking that still exists (once).
DO $$ BEGIN
  IF to_regclass('public.rank_runs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM hub_meta WHERE key='rank_history_seed_v1') THEN
    INSERT INTO rank_history(run_id,scope,published_at,slot,rank,person_id,display_name,value)
    SELECT s.run_id, r.scope, r.published_at, s.slot, s.rank, s.person_id, p.display_name, s.value
    FROM rank_runs r JOIN rank_slots s ON s.run_id=r.id JOIN people p ON p.id=s.person_id
    WHERE r.published_at IS NOT NULL AND r.status IN ('published','superseded')
    ON CONFLICT (run_id, slot) DO NOTHING;
    INSERT INTO hub_meta(key,value) VALUES ('rank_history_seed_v1', now()::text);
  END IF;
END $$;

-- Hall of fame: who held each slot at the end of every week / month (Pakistan time).
CREATE OR REPLACE VIEW hall_of_fame AS
WITH last_run AS (
  SELECT DISTINCT ON (scope, period, period_start) scope, period, period_start, run_id, published_at
  FROM (
    SELECT DISTINCT scope, run_id, published_at, 'week'::text AS period,
      date_trunc('week', published_at AT TIME ZONE 'Asia/Karachi')::date AS period_start FROM rank_history
    UNION ALL
    SELECT DISTINCT scope, run_id, published_at, 'month'::text,
      date_trunc('month', published_at AT TIME ZONE 'Asia/Karachi')::date FROM rank_history
  ) t
  ORDER BY scope, period, period_start, published_at DESC
)
SELECT l.scope, l.period, l.period_start, l.published_at, h.slot, h.rank, h.person_id, h.display_name, h.value
FROM last_run l JOIN rank_history h ON h.run_id=l.run_id;

-- PCI Hub: the old metric table's edits and deletions reach the hub too (additive, idempotent).
-- Without this, a reading corrected or removed in metric_observations would stay in the hub.

-- Recompute the latest API value of one account field from the hub's remaining readings.
-- A web (http) latest value is left alone: it is only there because the API had nothing.
CREATE OR REPLACE FUNCTION hub_refresh_latest(p_entity text, p_metric text) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE cur text; r record;
BEGIN
  SELECT source_id INTO cur FROM ingest_latest WHERE entity_kind='account' AND entity_id=p_entity AND metric=p_metric;
  IF cur IS NOT NULL AND cur LIKE '%.http' THEN RETURN; END IF;
  SELECT source_id, value_numeric, value_scale, accuracy, observed_at INTO r FROM ingest_observations
  WHERE entity_kind='account' AND entity_id=p_entity AND metric=p_metric AND value_numeric IS NOT NULL
    AND accuracy <> 'unverified' AND source_id NOT LIKE '%.http'
  ORDER BY observed_at DESC, value_numeric DESC LIMIT 1;
  IF NOT FOUND THEN
    DELETE FROM ingest_latest WHERE entity_kind='account' AND entity_id=p_entity AND metric=p_metric;
    RETURN;
  END IF;
  INSERT INTO ingest_latest (entity_kind,entity_id,metric,source_id,value_numeric,value_scale,accuracy,observed_at)
  VALUES ('account', p_entity, p_metric, r.source_id, r.value_numeric, r.value_scale, r.accuracy, r.observed_at)
  ON CONFLICT (entity_kind,entity_id,metric) DO UPDATE SET
    source_id=EXCLUDED.source_id, value_numeric=EXCLUDED.value_numeric, value_scale=EXCLUDED.value_scale, value_text=NULL,
    accuracy=EXCLUDED.accuracy, observed_at=EXCLUDED.observed_at, updated_at=now();
END $fn$;

CREATE OR REPLACE FUNCTION hub_mirror_metric_change() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE plat text; ext text; ref text; ent text;
BEGIN
  SELECT platform, external_id INTO plat, ext FROM accounts WHERE id = OLD.account_id;
  -- Account already gone (person deleted): its hub rows go by cascade.
  IF plat IS NULL OR plat NOT IN ('youtube','instagram') THEN RETURN NULL; END IF;
  ref := COALESCE(OLD.run_id::text, 'history:'||OLD.id::text);
  ent := plat||':'||ext;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM ingest_observations WHERE source_id=plat||'.api' AND source_run_ref=ref
        AND entity_kind='account' AND entity_id=ent AND metric=OLD.metric;
    ELSE
      UPDATE ingest_observations SET metric=NEW.metric, value_numeric=NEW.value,
        accuracy=CASE WHEN NEW.accuracy='exact' THEN 'exact' ELSE 'rounded' END, observed_at=NEW.observed_at
      WHERE source_id=plat||'.api' AND source_run_ref=ref AND entity_kind='account' AND entity_id=ent AND metric=OLD.metric;
      IF NEW.metric <> OLD.metric THEN PERFORM hub_refresh_latest(ent, NEW.metric); END IF;
    END IF;
    PERFORM hub_refresh_latest(ent, OLD.metric);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub mirror change skipped for observation %: %', OLD.id, SQLERRM;
  END;
  RETURN NULL;
END $fn$;

DO $$ BEGIN
  IF to_regclass('public.metric_observations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hub_mirror_metric_changes ON metric_observations;
    CREATE TRIGGER hub_mirror_metric_changes AFTER UPDATE OR DELETE ON metric_observations
      FOR EACH ROW EXECUTE FUNCTION hub_mirror_metric_change();
  END IF;
END $$;

-- PCI Hub: satellite / Earth data is a sub-bucket of the one hub (category 'satellite').
-- Non-creator readings may be negative (temperatures); creator counts stay non-negative.
DO $$ BEGIN
 ALTER TABLE ingest_observations DROP CONSTRAINT IF EXISTS ingest_observations_value_numeric_check;
 ALTER TABLE ingest_latest DROP CONSTRAINT IF EXISTS ingest_latest_value_numeric_check;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ingest_observations_value_sign') THEN
  ALTER TABLE ingest_observations ADD CONSTRAINT ingest_observations_value_sign
   CHECK (value_numeric IS NULL OR value_numeric >= 0 OR entity_kind NOT IN ('account','content','comment'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ingest_latest_value_sign') THEN
  ALTER TABLE ingest_latest ADD CONSTRAINT ingest_latest_value_sign
   CHECK (value_numeric IS NULL OR value_numeric >= 0 OR entity_kind NOT IN ('account','content','comment'));
 END IF;
END $$;
INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label) VALUES
 ('sat_firms.api','sat_firms','api',false,'satellite',5,'NASA FIRMS fire hotspots'),
 ('sat_power.api','sat_power','api',false,'satellite',36,'NASA POWER rainfall and sunlight'),
 ('sat_eonet.api','sat_eonet','api',false,'satellite',9,'NASA EONET natural events'),
 ('sat_usgs.api','sat_usgs','api',false,'satellite',2,'USGS earthquakes'),
 ('sat_gibs.api','sat_gibs','api',false,'satellite',36,'NASA GIBS map layers'),
 ('sat_gpm.api','sat_gpm','api',false,'satellite',9,'NASA GPM rain map'),
 ('sat_airquality.api','sat_airquality','api',false,'satellite',2,'Copernicus CAMS air quality'),
 ('sat_weather.api','sat_weather','api',false,'satellite',2,'MET Norway weather'),
 ('sat_flood.api','sat_flood','api',false,'satellite',36,'GloFAS river flow'),
 ('sat_gdacs.api','sat_gdacs','api',false,'satellite',2,'GDACS disaster alerts'),
 ('sat_swpc.api','sat_swpc','api',false,'satellite',5,'NOAA space weather'),
 ('sat_celestrak.api','sat_celestrak','api',false,'satellite',9,'CelesTrak orbits'),
 ('sat_openaq.api','sat_openaq','api',false,'satellite',2,'OpenAQ ground stations')
ON CONFLICT (id) DO NOTHING;
INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label) VALUES
 ('sat_insights.api','sat_insights','api',false,'satellite',3,'Satellite scores: Go-Out Score and weekly city rankings')
ON CONFLICT (id) DO NOTHING;
`;
export async function ensureHubSchema():Promise<void> {if(skipRuntimeDDL())return;
  const client=await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(710324)');
    try { await client.query(HUB_SCHEMA_SQL); }
    finally { await client.query('SELECT pg_advisory_unlock(710324)'); }
  } finally { client.release(); }
}
