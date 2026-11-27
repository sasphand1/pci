-- Explicit owner approval of third-party data publication; private by default.
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS published_at timestamptz;
