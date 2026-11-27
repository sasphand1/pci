CREATE TABLE IF NOT EXISTS scrappa_admin_keys (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), label text NOT NULL, fingerprint text NOT NULL UNIQUE, ciphertext text NOT NULL, active boolean NOT NULL DEFAULT false);
CREATE UNIQUE INDEX IF NOT EXISTS scrappa_one_active_key ON scrappa_admin_keys(active) WHERE active;
CREATE TABLE IF NOT EXISTS scrappa_credit_month (month date PRIMARY KEY, used integer NOT NULL CHECK(used BETWEEN 0 AND 500));
CREATE TABLE IF NOT EXISTS scrappa_candidates (external_id text PRIMARY KEY, handle text NOT NULL UNIQUE, display_name text, person_name text, niche text, checked_at timestamptz NOT NULL DEFAULT now());
