import {skipRuntimeDDL} from '../architecture/managed-runtime.js';
import { pool } from './db.js';

// Mirrors database/migrations/092_registry.sql exactly (a test enforces identical DDL).
// Applied at startup so a deploy that forgets `npm run migrate` still works.
export const REGISTRY_SCHEMA_SQL=`-- 092_registry: the bucket. People are curated by an admin; accounts hang off people.
-- Everything cascades from people, so deleting a person leaves nothing behind.
-- Idempotent: safe to run on a database that already has these objects.
CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT people_slug_len CHECK (length(slug) BETWEEN 2 AND 60),
  CONSTRAINT people_name_len CHECK (length(display_name) BETWEEN 1 AND 150)
);
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  platform text NOT NULL,
  external_id text NOT NULL,
  handle text NOT NULL,
  legacy_creator_id uuid,
  legacy_instagram_creator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_platform_chk CHECK (platform IN ('youtube','instagram')),
  CONSTRAINT accounts_platform_external_uq UNIQUE (platform, external_id),
  CONSTRAINT accounts_person_platform_uq UNIQUE (person_id, platform)
);
CREATE INDEX IF NOT EXISTS accounts_person_idx ON accounts(person_id);
CREATE TABLE IF NOT EXISTS person_categories (
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  PRIMARY KEY (person_id, category_id)
);
CREATE INDEX IF NOT EXISTS person_categories_category_idx ON person_categories(category_id);
CREATE UNIQUE INDEX IF NOT EXISTS person_categories_one_primary_uq ON person_categories(person_id) WHERE is_primary;
`;

export async function ensureRegistrySchema():Promise<void>{if(skipRuntimeDDL())return;
  const client=await pool.connect();
  let lockHeld=false;
  try{
    await client.query('SELECT pg_advisory_lock(710323)');
    lockHeld=true;
    await client.query('BEGIN');
    try{await client.query(REGISTRY_SCHEMA_SQL);await client.query('COMMIT');}
    catch(err){await client.query('ROLLBACK');throw err;}
  }finally{
    try{if(lockHeld)await client.query('SELECT pg_advisory_unlock(710323)');}
    finally{client.release();}
  }
}
