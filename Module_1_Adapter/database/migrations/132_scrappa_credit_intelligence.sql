-- Scrappa credit accounting v2. Never discard the unallocated legacy total.
ALTER TABLE scrappa_admin_keys ADD COLUMN IF NOT EXISTS monthly_cap integer NOT NULL DEFAULT 499 CHECK(monthly_cap BETWEEN 1 AND 100000);
ALTER TABLE scrappa_admin_keys ADD COLUMN IF NOT EXISTS retired_at timestamptz;
DO $$ BEGIN
 IF to_regclass('scrappa_key_credit_month') IS NULL THEN
  CREATE TABLE scrappa_key_credit_month (
   key_id uuid NOT NULL REFERENCES scrappa_admin_keys(id) ON DELETE RESTRICT,
   month date NOT NULL, used integer NOT NULL CHECK(used>=0), legacy_used integer NOT NULL DEFAULT 0 CHECK(legacy_used>=0 AND legacy_used<=used),
   PRIMARY KEY(key_id,month));
  -- Old usage has no key attribution. Charge the full shared total to each existing key conservatively.
  INSERT INTO scrappa_key_credit_month(key_id,month,used,legacy_used)
   SELECT k.id,m.month,m.used,m.used FROM scrappa_admin_keys k CROSS JOIN scrappa_credit_month m;
 END IF;
END $$;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='scrappa_credit_month'::regclass AND conname='scrappa_legacy_credit_nonnegative') THEN
  ALTER TABLE scrappa_credit_month DROP CONSTRAINT IF EXISTS scrappa_credit_month_used_check;
  ALTER TABLE scrappa_credit_month ADD CONSTRAINT scrappa_legacy_credit_nonnegative CHECK(used>=0);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS scrappa_credit_ledger (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), key_id uuid NOT NULL REFERENCES scrappa_admin_keys(id) ON DELETE RESTRICT,
 run_id uuid REFERENCES ingest_jobs(id) ON DELETE SET NULL,
 month date NOT NULL, endpoint text NOT NULL CHECK(endpoint IN ('profile','posts')), handle text NOT NULL,
 outcome text NOT NULL DEFAULT 'reserved' CHECK(outcome IN ('reserved','response','ambiguous')),
 http_status integer CHECK(http_status BETWEEN 100 AND 599),
 reserved_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz, transport_failure boolean NOT NULL DEFAULT false,
 CHECK((outcome='reserved' AND finished_at IS NULL AND http_status IS NULL) OR (outcome='response' AND finished_at IS NOT NULL AND http_status IS NOT NULL) OR (outcome='ambiguous' AND finished_at IS NOT NULL AND http_status IS NULL)));
CREATE INDEX IF NOT EXISTS scrappa_credit_ledger_key_time_idx ON scrappa_credit_ledger(key_id,reserved_at DESC,id);
CREATE INDEX IF NOT EXISTS scrappa_credit_ledger_run_idx ON scrappa_credit_ledger(run_id);
CREATE TABLE IF NOT EXISTS scrappa_profile_checks (
 handle text PRIMARY KEY, attempt_id uuid NOT NULL, attempted_at timestamptz NOT NULL,
 completed_at timestamptz, checked_at timestamptz, profile jsonb, last_error text,
 CHECK((profile IS NULL)=(checked_at IS NULL)));
