import { pool } from './db.js';

// Mirrors database/migrations/095_public.sql exactly (a test enforces identical DDL).
// Requires the registry schema (people, accounts) to exist first.
export const PUBLIC_SCHEMA_SQL=`-- 095_public: what the public website needs beyond the rankings. Idempotent.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_url text;
CREATE INDEX IF NOT EXISTS people_display_name_idx ON people(lower(display_name));
`;

export async function ensurePublicSchema():Promise<void>{
  const client=await pool.connect();
  let lockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock(710323)');
    lockHeld=true;
    await client.query('BEGIN');
    try{await client.query(PUBLIC_SCHEMA_SQL);await client.query('COMMIT');}
    catch(err){await client.query('ROLLBACK');throw err;}
  }finally{
    try{if(lockHeld)await client.query('SELECT pg_advisory_unlock(710323)');}
    finally{client.release();}
  }
}
