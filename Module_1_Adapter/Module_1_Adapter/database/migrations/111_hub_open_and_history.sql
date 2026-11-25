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
