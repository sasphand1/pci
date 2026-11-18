-- Cross-platform opt-in curated pool, independent of existing YouTube metrics.
ALTER TABLE instagram_creators ADD COLUMN cross_platform_curated boolean NOT NULL DEFAULT false;
CREATE INDEX instagram_cross_curated_idx ON instagram_creators(youtube_creator_id) WHERE cross_platform_curated AND enabled AND eligibility='approved';
-- Prevent two approved Instagram accounts from claiming the same YouTube human in the cross-platform cohort.
CREATE UNIQUE INDEX instagram_curated_single_human ON instagram_creators(youtube_creator_id) WHERE cross_platform_curated AND youtube_creator_id IS NOT NULL;
