-- 127: TikTok authorization only. No metric tables or collector activation.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.accounts'::regclass AND conname='accounts_platform_chk' AND pg_get_constraintdef(oid) NOT LIKE '%tiktok%') THEN
  ALTER TABLE accounts DROP CONSTRAINT accounts_platform_chk;
  ALTER TABLE accounts ADD CONSTRAINT accounts_platform_chk CHECK (platform IN ('youtube','instagram','tiktok'));
 END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_tiktok_username_uq ON accounts(lower(ltrim(handle,'@'))) WHERE platform='tiktok';
CREATE SCHEMA IF NOT EXISTS tiktokingest;
CREATE TABLE IF NOT EXISTS tiktokingest.connections (
 account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 open_id text NOT NULL UNIQUE,
 username text NOT NULL,
 scopes text[] NOT NULL,
 access_token_enc text NOT NULL,
 refresh_token_enc text NOT NULL,
 access_expires_at timestamptz NOT NULL,
 refresh_expires_at timestamptz NOT NULL,
 connected_by uuid NOT NULL,
 connected_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoking')),
 revocation_started_at timestamptz,
 revocation_claim uuid
);
CREATE TABLE IF NOT EXISTS tiktokingest.oauth_states (
 state_hash text PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
 admin_id uuid NOT NULL,
 person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
 expected_username text NOT NULL,
 expires_at timestamptz NOT NULL,
 used_at timestamptz
);
CREATE INDEX IF NOT EXISTS tiktok_states_person_idx ON tiktokingest.oauth_states(person_id,expires_at);
CREATE INDEX IF NOT EXISTS tiktok_states_username_idx ON tiktokingest.oauth_states(expected_username,expires_at);
CREATE INDEX IF NOT EXISTS tiktok_states_expiry_idx ON tiktokingest.oauth_states(expires_at);
