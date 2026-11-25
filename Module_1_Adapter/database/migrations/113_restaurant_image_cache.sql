-- Additive, independent of restaurant ratings and creator rankings.
CREATE TABLE IF NOT EXISTS restaurant_image_cache (
  place_id text PRIMARY KEY REFERENCES local_places(place_id) ON DELETE CASCADE,
  source_url text NOT NULL,
  image_url text NOT NULL,
  attribution text NOT NULL,
  licence text NOT NULL,
  permission_url text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('image/jpeg','image/png','image/webp')),
  bytes bytea NOT NULL,
  size_bytes integer NOT NULL CHECK (size_bytes BETWEEN 1 AND 200000 AND size_bytes=octet_length(bytes)),
  sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  approved_by uuid,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS restaurant_image_discovery (
  place_id text PRIMARY KEY REFERENCES local_places(place_id) ON DELETE CASCADE,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(candidates)='array'),
  last_result text NOT NULL CHECK (last_result IN ('found','none','failed')),
  last_attempt_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label)
VALUES ('restaurant_images.http','restaurant_images','http',false,'places',168,'Restaurant images (authorized HTTP)')
ON CONFLICT (id) DO NOTHING;
