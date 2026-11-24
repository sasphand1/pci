-- Official Meta avatar-only recovery bookkeeping, independent of public-web attempts.
CREATE TABLE IF NOT EXISTS hub_graph_avatar_attempts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text NOT NULL
);
CREATE INDEX IF NOT EXISTS hub_graph_avatar_attempts_latest_idx
  ON hub_graph_avatar_attempts (last_attempt_at DESC);
