-- Unverified registration is private and does not require a provider identity.
CREATE TABLE IF NOT EXISTS scrappa_pending_accounts (
 handle text PRIMARY KEY CHECK(handle ~ '^[a-z0-9._]{2,24}$'),
 person_name text, niche text, created_at timestamptz NOT NULL DEFAULT now(),
 last_attempt_at timestamptz, last_error text
);
