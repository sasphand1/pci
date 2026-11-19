/**
 * Module 1 safe schema compatibility bridge.
 * The CLI migration is normally the authoritative schema migration path.
 * This performs only idempotent, additive fields required for the unified review API,
 * allowing Hostinger Node deployments without a console-driven migration command.
 * Never approves users, mutates existing metrics, drops tables or erases records.
 */
import type pg from 'pg';
import {pool} from './db.js';

export async function ensureUnifiedSchema(): Promise<void> {
  const client:pg.PoolClient = await pool.connect();
  let lockHeld=false;
  try {
    // The same advisory lock as the existing CLI migrator prevents DDL races.
    await client.query('SELECT pg_advisory_lock(710323)');
    lockHeld=true;
    await client.query('BEGIN');
    try {
      await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_review_status text NOT NULL DEFAULT 'pending'`);
      await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_reviewed_at timestamptz`);
      await client.query(`ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_reviewed_by uuid REFERENCES admin_users(id)`);
      await client.query(`DO $pci$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname='creators_human_review_status_valid'
              AND conrelid='creators'::regclass
          ) THEN
            ALTER TABLE creators ADD CONSTRAINT creators_human_review_status_valid
              CHECK (human_review_status IN ('pending','approved','rejected'));
          END IF;
        END
      $pci$;`);
      await client.query(`CREATE INDEX IF NOT EXISTS creators_human_review_status_idx
        ON creators(human_review_status) WHERE enabled=true`);
      // An older Instagram migration may already have been installed without the link column.
      // Add it only when the Instagram table exists. No account is linked automatically.
      const ig=await client.query("SELECT to_regclass('public.instagram_creators') AS table_name");
      if(ig.rows[0]?.table_name){
        await client.query(`ALTER TABLE instagram_creators
          ADD COLUMN IF NOT EXISTS youtube_creator_id uuid REFERENCES creators(id)`);
      }
      // Validate fields exist in the live database instead of treating a successful build as proof.
      const check=await client.query(`SELECT
         count(*) FILTER(WHERE column_name='human_review_status') AS status,
         count(*) FILTER(WHERE column_name='human_reviewed_at') AS reviewed_at,
         count(*) FILTER(WHERE column_name='human_reviewed_by') AS reviewed_by
         FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='creators'`);
      const r=check.rows[0];
      if(Number(r?.status)!==1||Number(r?.reviewed_at)!==1||Number(r?.reviewed_by)!==1){
        throw new Error('Unified creator schema columns not found after upgrade');
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    try {if(lockHeld) await client.query('SELECT pg_advisory_unlock(710323)');}
    finally {client.release();}
  }
}
