-- Idempotent, additive migration. Never auto-approves any creator.
ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_reviewed_at timestamptz;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS human_reviewed_by uuid REFERENCES admin_users(id);
DO $pci$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='creators_human_review_status_valid' AND conrelid='creators'::regclass) THEN
   ALTER TABLE creators ADD CONSTRAINT creators_human_review_status_valid
   CHECK(human_review_status IN ('pending','approved','rejected'));
 END IF;
END
$pci$;
CREATE INDEX IF NOT EXISTS creators_human_review_status_idx ON creators(human_review_status) WHERE enabled=true;
-- Existing Instagram migrations may predate explicit YouTube identity linking.
DO $pci$
BEGIN
 IF to_regclass('public.instagram_creators') IS NOT NULL THEN
   ALTER TABLE instagram_creators ADD COLUMN IF NOT EXISTS youtube_creator_id uuid REFERENCES creators(id);
 END IF;
END
$pci$;
-- Keep the existing uniqueness guarantee for approved linked accounts where possible.
-- If older data already violates this constraint, the CLI migration will report it
-- without deleting or silently changing existing accounts.
CREATE UNIQUE INDEX IF NOT EXISTS ig_one_approved_per_youtube_creator ON instagram_creators(youtube_creator_id)
 WHERE eligibility='approved' AND enabled=true AND youtube_creator_id IS NOT NULL;
