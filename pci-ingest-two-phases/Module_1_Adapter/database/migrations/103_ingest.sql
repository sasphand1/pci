-- PCI Ingest v1: additive, independent from the ranking/publication schema.
-- Do not store complete HTML, tokens, cookies or arbitrary response headers.
-- Existing video collector already receives all three public engagement counts.
-- Add these columns without changing or dropping any existing data.
ALTER TABLE creator_video_catalogue ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE creator_video_catalogue ADD COLUMN IF NOT EXISTS like_count bigint CHECK(like_count IS NULL OR like_count>=0);
ALTER TABLE creator_video_catalogue ADD COLUMN IF NOT EXISTS comment_count bigint CHECK(comment_count IS NULL OR comment_count>=0);

CREATE TABLE IF NOT EXISTS ingest_sources (
  id text PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('youtube','instagram','tiktok')),
  method text NOT NULL CHECK (method IN ('api','http')),
  enabled boolean NOT NULL DEFAULT false,
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ingest_sources(id,platform,method,enabled) VALUES
 ('youtube.api','youtube','api',true),
 ('instagram.api','instagram','api',true),
 ('youtube.http','youtube','http',false),
 ('instagram.http','instagram','http',false),
 ('tiktok.http','tiktok','http',false)
ON CONFLICT(id) DO NOTHING;

CREATE TABLE IF NOT EXISTS ingest_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_id text NOT NULL REFERENCES ingest_sources(id),
  source_run_ref text NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  entity_kind text NOT NULL CHECK (entity_kind IN ('account','content','comment')),
  entity_id text NOT NULL,
  metric text NOT NULL CHECK (metric ~ '^[a-z][a-z0-9_]{0,63}$'),
  value_numeric bigint CHECK (value_numeric IS NULL OR value_numeric >= 0),
  value_text text,
  accuracy text NOT NULL CHECK (accuracy IN ('exact','rounded','unverified')),
  observed_at timestamptz NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ingest_observations_has_value CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL),
  CONSTRAINT ingest_observations_dedupe UNIQUE (source_id,source_run_ref,entity_kind,entity_id,metric)
);
CREATE INDEX IF NOT EXISTS ingest_observations_source_ref_idx ON ingest_observations(source_id,source_run_ref);
CREATE INDEX IF NOT EXISTS ingest_observations_lookup_idx ON ingest_observations(entity_kind,entity_id,metric,observed_at DESC);
CREATE INDEX IF NOT EXISTS ingest_observations_account_idx ON ingest_observations(account_id,observed_at DESC);

CREATE TABLE IF NOT EXISTS ingest_latest (
  entity_kind text NOT NULL CHECK(entity_kind IN ('account','content','comment')),
  entity_id text NOT NULL,
  metric text NOT NULL,
  source_id text NOT NULL REFERENCES ingest_sources(id),
  value_numeric bigint CHECK(value_numeric IS NULL OR value_numeric>=0),
  value_text text,
  accuracy text NOT NULL,
  observed_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(entity_kind,entity_id,metric),
  CONSTRAINT ingest_latest_has_value CHECK(value_numeric IS NOT NULL OR value_text IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS ingest_content (
  platform text NOT NULL CHECK(platform IN ('youtube','instagram','tiktok')),
  content_id text NOT NULL,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  content_type text NOT NULL DEFAULT 'video',
  title text,
  caption text,
  duration_iso text,
  url text,
  thumbnail_url text,
  published_at timestamptz,
  last_observed_at timestamptz NOT NULL DEFAULT now(),
  source_id text NOT NULL REFERENCES ingest_sources(id),
  PRIMARY KEY(platform,content_id)
);
CREATE INDEX IF NOT EXISTS ingest_content_account_idx ON ingest_content(account_id,published_at DESC);

CREATE TABLE IF NOT EXISTS ingest_creator_pinned_comments (
  platform text NOT NULL DEFAULT 'youtube' CHECK(platform='youtube'),
  content_id text NOT NULL,
  comment_id text NOT NULL,
  author_channel_id text NOT NULL,
  author_name text NOT NULL,
  comment_text text NOT NULL,
  likes bigint CHECK(likes IS NULL OR likes>=0),
  reply_count bigint CHECK(reply_count IS NULL OR reply_count>=0),
  is_creator boolean NOT NULL CHECK(is_creator=true),
  is_pinned boolean NOT NULL CHECK(is_pinned=true),
  observed_at timestamptz NOT NULL,
  source_id text NOT NULL REFERENCES ingest_sources(id),
  verification_state text NOT NULL DEFAULT 'submitted' CHECK(verification_state IN ('submitted','source_verified')),
  PRIMARY KEY(platform,content_id,comment_id)
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL REFERENCES ingest_sources(id),
  trigger text NOT NULL CHECK(trigger IN ('scheduled','manual','system')),
  status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','succeeded','partial','skipped','failed')),
  requested_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  observations integer NOT NULL DEFAULT 0,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ingest_jobs_source_recent_idx ON ingest_jobs(source_id,created_at DESC);
