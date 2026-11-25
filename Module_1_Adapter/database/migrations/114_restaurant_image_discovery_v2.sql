-- Additive V2: old discovery attempts become eligible once again without deleting data.
ALTER TABLE restaurant_image_discovery ADD COLUMN IF NOT EXISTS discovery_version integer NOT NULL DEFAULT 1;
ALTER TABLE restaurant_image_discovery ADD COLUMN IF NOT EXISTS diagnostics jsonb NOT NULL DEFAULT '[]'::jsonb;
