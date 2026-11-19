-- PCI Update 1: per-account synchronization results and worker heartbeats.
-- Additive and idempotent. Never changes ranking data or approvals.
CREATE TABLE IF NOT EXISTS sync_account_results (
  id bigserial PRIMARY KEY,
  sync_run_id uuid NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'youtube',
  outcome text NOT NULL CHECK (outcome IN ('ok','hidden_subscribers','not_returned','failed')),
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sync_run_id, creator_id, platform)
);
CREATE INDEX IF NOT EXISTS sync_account_results_creator_idx ON sync_account_results(creator_id, created_at DESC);
CREATE TABLE IF NOT EXISTS worker_heartbeats (
  worker_id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('worker','embedded')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
