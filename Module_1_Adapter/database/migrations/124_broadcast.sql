-- Independent durable outbox. No modifications to ranking, hub or Satify data.
CREATE SCHEMA IF NOT EXISTS broadcast;
CREATE TABLE IF NOT EXISTS broadcast.jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL,
 created_by uuid NOT NULL,
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
 body text NOT NULL CHECK (length(body) <= 5000),
 media_ref text CHECK (length(media_ref) BETWEEN 1 AND 512),
 state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','confirmed','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(),
 confirmed_by uuid,
 confirmed_at timestamptz,
 cancelled_by uuid,
 cancelled_at timestamptz,
 UNIQUE(created_by,request_id),
 CHECK ((confirmed_at IS NULL) = (confirmed_by IS NULL)),
 CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL)),
 CHECK (state <> 'confirmed' OR confirmed_at IS NOT NULL),
 CHECK ((state = 'cancelled') = (cancelled_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS broadcast.deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 job_id uuid NOT NULL REFERENCES broadcast.jobs(id),
 destination text NOT NULL CHECK (destination IN ('youtube','instagram','tiktok')),
 state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','claimed','delivered','failed','uncertain','cancelled')),
 claim_id uuid UNIQUE,
 claimed_at timestamptz,
 claim_deadline timestamptz,
 finished_at timestamptz,
 external_id text CHECK (length(external_id) BETWEEN 1 AND 512),
 result_code text CHECK (length(result_code) BETWEEN 1 AND 100),
 UNIQUE(job_id,destination),
 CHECK ((claim_id IS NULL) = (claimed_at IS NULL)),
 CHECK ((claim_id IS NULL) = (claim_deadline IS NULL)),
 CHECK (state NOT IN ('claimed','delivered','failed','uncertain') OR claim_id IS NOT NULL),
 CHECK (state <> 'delivered' OR external_id IS NOT NULL),
 CHECK ((state IN ('delivered','failed','uncertain','cancelled')) = (finished_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS broadcast_jobs_created_idx ON broadcast.jobs(created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS broadcast_pending_idx ON broadcast.deliveries(destination,job_id) WHERE state='pending';
CREATE TABLE IF NOT EXISTS broadcast.events (
 id bigserial PRIMARY KEY,
 job_id uuid NOT NULL REFERENCES broadcast.jobs(id),
 delivery_id uuid REFERENCES broadcast.deliveries(id),
 actor_id uuid,
 event text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS broadcast_events_job_idx ON broadcast.events(job_id,id DESC);
