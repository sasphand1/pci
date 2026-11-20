import { pool } from './db.js';

// Mirrors database/migrations/093_observations.sql exactly (a test enforces identical DDL).
// Requires the registry schema (accounts) to exist first.
export const OBSERVATIONS_SCHEMA_SQL=`-- 093_observations: metric history and refresh runs. Idempotent.
-- Observations are append-only and hang off accounts, so deleting a person removes their history.
CREATE TABLE IF NOT EXISTS refresh_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  trigger text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  CONSTRAINT refresh_runs_platform_chk CHECK (platform IN ('youtube','instagram')),
  CONSTRAINT refresh_runs_trigger_chk CHECK (trigger IN ('manual','scheduled','system')),
  CONSTRAINT refresh_runs_status_chk CHECK (status IN ('queued','running','succeeded','partial','failed'))
);
-- At most one queued or running refresh per platform.
CREATE UNIQUE INDEX IF NOT EXISTS refresh_runs_one_active_per_platform ON refresh_runs(platform) WHERE status IN ('queued','running');
CREATE INDEX IF NOT EXISTS refresh_runs_created_idx ON refresh_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS refresh_results (
  run_id uuid NOT NULL REFERENCES refresh_runs(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  outcome text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, account_id),
  CONSTRAINT refresh_results_outcome_chk CHECK (outcome IN ('ok','hidden','not_found','private','rate_limited','unsupported','error'))
);
CREATE INDEX IF NOT EXISTS refresh_results_account_idx ON refresh_results(account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS metric_observations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  metric text NOT NULL,
  value bigint NOT NULL,
  accuracy text NOT NULL DEFAULT 'exact',
  capped boolean NOT NULL DEFAULT false,
  observed_at timestamptz NOT NULL,
  run_id uuid REFERENCES refresh_runs(id) ON DELETE SET NULL,
  CONSTRAINT metric_observations_metric_chk CHECK (metric IN ('followers','views','posts_30d')),
  CONSTRAINT metric_observations_value_chk CHECK (value >= 0),
  CONSTRAINT metric_observations_accuracy_chk CHECK (accuracy IN ('exact','rounded3')),
  CONSTRAINT metric_observations_run_uq UNIQUE (account_id, metric, run_id)
);
CREATE INDEX IF NOT EXISTS metric_latest_idx ON metric_observations(account_id, metric, observed_at DESC);
CREATE INDEX IF NOT EXISTS metric_observed_idx ON metric_observations(observed_at);
`;

export async function ensureObservationsSchema():Promise<void>{
  const client=await pool.connect();
  let lockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock(710323)');
    lockHeld=true;
    await client.query('BEGIN');
    try{await client.query(OBSERVATIONS_SCHEMA_SQL);await client.query('COMMIT');}
    catch(err){await client.query('ROLLBACK');throw err;}
  }finally{
    try{if(lockHeld)await client.query('SELECT pg_advisory_unlock(710323)');}
    finally{client.release();}
  }
}
