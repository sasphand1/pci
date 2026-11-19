/**
 * PCI Update 1 schema bridge (mirrors database/migrations/091_engine_foundation.sql).
 * Idempotent and additive only, so Hostinger deployments that cannot run `npm run migrate`
 * still get the diagnostics tables. Never approves creators, changes metrics or drops data.
 */
import {pool} from './db.js';

export const ENGINE_SCHEMA_SQL=`CREATE TABLE IF NOT EXISTS sync_account_results (
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
`;

export async function ensureEngineSchema():Promise<void>{
  const client=await pool.connect();
  let lockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock(710323)');
    lockHeld=true;
    await client.query('BEGIN');
    try{await client.query(ENGINE_SCHEMA_SQL);await client.query('COMMIT');}
    catch(err){await client.query('ROLLBACK');throw err;}
  }finally{
    try{if(lockHeld)await client.query('SELECT pg_advisory_unlock(710323)');}
    finally{client.release();}
  }
}
