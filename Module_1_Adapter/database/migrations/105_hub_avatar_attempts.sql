-- Retry bookkeeping for the optional web picture fill (additive).
CREATE TABLE IF NOT EXISTS hub_avatar_attempts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text
);
