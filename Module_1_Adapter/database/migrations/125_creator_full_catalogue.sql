ALTER TABLE creator_video_catalogue ADD COLUMN IF NOT EXISTS catalogue_scan_at timestamptz;
ALTER TABLE creator_video_catalogue ADD COLUMN IF NOT EXISTS catalogue_public boolean NOT NULL DEFAULT true;
CREATE TABLE IF NOT EXISTS creator_catalogue_scan (
 account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
 playlist_id text,
 page_token text,
 scan_started_at timestamptz,
 completed_at timestamptz,
 last_attempt_at timestamptz,
 public_video_count bigint CHECK(public_video_count IS NULL OR public_video_count>=0),
 last_error text
);
CREATE INDEX IF NOT EXISTS creator_catalogue_scan_attempt_idx ON creator_catalogue_scan(last_attempt_at);
