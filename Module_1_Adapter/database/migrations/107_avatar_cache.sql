-- Own copy of each Instagram profile picture so expiring CDN links never blank the site.
CREATE TABLE IF NOT EXISTS avatar_cache (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  content_type text NOT NULL,
  bytes bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 400000),
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS avatar_cache_attempts (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_result text NOT NULL
);
