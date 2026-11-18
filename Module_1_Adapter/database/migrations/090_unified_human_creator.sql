-- Additive migration: existing YouTube/Instagram schemas and metrics are not overwritten.
-- No current channel is assumed to represent a human. Editors must review individuals.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_reviewed_at timestamptz;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_reviewed_by uuid REFERENCES admin_users(id);
ALTER TABLE creators ADD CONSTRAINT creators_human_review_status_valid CHECK (human_review_status IN ('pending','approved','rejected'));
CREATE INDEX IF NOT EXISTS creators_human_review_status_idx ON creators(human_review_status) WHERE enabled=true;
-- Prevent multiple approved Instagram accounts from being counted for the same YouTuber.
CREATE UNIQUE INDEX IF NOT EXISTS ig_one_approved_per_youtube_creator ON instagram_creators(youtube_creator_id)
  WHERE eligibility='approved' AND enabled=true AND youtube_creator_id IS NOT NULL;
