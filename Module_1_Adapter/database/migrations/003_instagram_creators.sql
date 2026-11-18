
-- Instagram is a separate platform: never mix YouTube counts or rankings.
CREATE TABLE instagram_creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_creator_id uuid REFERENCES creators(id),
  username text NOT NULL,
  display_name text NOT NULL,
  slug text NOT NULL UNIQUE,
  biography text NOT NULL DEFAULT '',
  eligibility text NOT NULL DEFAULT 'pending' CHECK (eligibility IN ('pending','approved','rejected')),
  human_attested boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES admin_users(id),
  reviewed_at timestamptz,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ig_username_format CHECK (username ~ '^[a-z0-9._]{1,30}$'),
  CONSTRAINT ig_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT human_approval CHECK (eligibility <> 'approved' OR (human_attested AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
CREATE UNIQUE INDEX instagram_creators_username_lower ON instagram_creators(lower(username));
CREATE TABLE instagram_creator_categories (
  creator_id uuid NOT NULL REFERENCES instagram_creators(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id),
  PRIMARY KEY(creator_id, category_id)
);
CREATE TABLE instagram_stats_latest (
  creator_id uuid PRIMARY KEY REFERENCES instagram_creators(id) ON DELETE CASCADE,
  instagram_id text,
  followers_count bigint CHECK (followers_count >= 0),
  media_count bigint CHECK (media_count >= 0),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  error_code text,
  CONSTRAINT instagram_id_format CHECK (instagram_id IS NULL OR instagram_id ~ '^[0-9]+$')
);
CREATE TABLE instagram_stats_history (
  creator_id uuid NOT NULL REFERENCES instagram_creators(id) ON DELETE CASCADE,
  captured_at timestamptz NOT NULL DEFAULT now(),
  followers_count bigint CHECK(followers_count>=0),
  media_count bigint CHECK(media_count>=0),
  PRIMARY KEY(creator_id,captured_at)
);
CREATE INDEX instagram_history_lookup ON instagram_stats_history(creator_id,captured_at DESC);
