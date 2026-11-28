import {skipRuntimeDDL} from '../architecture/managed-runtime.js';
import { pool } from './db.js';

// Mirrors database/migrations/094_publication.sql exactly (a test enforces identical DDL).
// Requires the registry schema (people) to exist first.
export const PUBLICATION_SCHEMA_SQL=`-- 094_publication: drafts, published rankings and pipeline bookkeeping. Idempotent.
-- Everything that names a person cascades from people, so a hard delete leaves nothing.
CREATE TABLE IF NOT EXISTS rank_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  scope text NOT NULL,
  policy_version text NOT NULL,
  input_hash text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  trigger text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  diagnostics jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT rank_runs_status_chk CHECK (status IN ('draft','published','superseded','rejected')),
  CONSTRAINT rank_runs_trigger_chk CHECK (trigger IN ('manual','scheduled','system'))
);
CREATE INDEX IF NOT EXISTS rank_runs_scope_idx ON rank_runs(scope, created_at DESC);
CREATE INDEX IF NOT EXISTS rank_runs_batch_idx ON rank_runs(batch_id);

CREATE TABLE IF NOT EXISTS rank_slots (
  run_id uuid NOT NULL REFERENCES rank_runs(id) ON DELETE CASCADE,
  slot integer NOT NULL,
  rank integer NOT NULL,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  value bigint NOT NULL,
  breakdown jsonb NOT NULL,
  PRIMARY KEY (run_id, slot),
  CONSTRAINT rank_slots_person_uq UNIQUE (run_id, person_id),
  CONSTRAINT rank_slots_slot_chk CHECK (slot >= 1),
  CONSTRAINT rank_slots_rank_chk CHECK (rank >= 1),
  CONSTRAINT rank_slots_value_chk CHECK (value >= 0)
);
CREATE INDEX IF NOT EXISTS rank_slots_person_idx ON rank_slots(person_id);

CREATE TABLE IF NOT EXISTS published_pointers (
  scope text PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES rank_runs(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT pipeline_runs_trigger_chk CHECK (trigger IN ('manual','scheduled','system')),
  CONSTRAINT pipeline_runs_status_chk CHECK (status IN ('running','succeeded','partial','failed'))
);
-- At most one pipeline run at a time.
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_runs_one_running ON pipeline_runs((true)) WHERE status = 'running';
CREATE INDEX IF NOT EXISTS pipeline_runs_created_idx ON pipeline_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS pipeline_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  scope text,
  message text NOT NULL,
  run_id uuid REFERENCES rank_runs(id) ON DELETE SET NULL,
  acknowledged boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS pipeline_alerts_open_idx ON pipeline_alerts(created_at DESC) WHERE NOT acknowledged;
`;

export async function ensurePublicationSchema():Promise<void>{if(skipRuntimeDDL())return;
  const client=await pool.connect();
  let lockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock(710323)');
    lockHeld=true;
    await client.query('BEGIN');
    try{await client.query(PUBLICATION_SCHEMA_SQL);await client.query('COMMIT');}
    catch(err){await client.query('ROLLBACK');throw err;}
  }finally{
    try{if(lockHeld)await client.query('SELECT pg_advisory_unlock(710323)');}
    finally{client.release();}
  }
}
