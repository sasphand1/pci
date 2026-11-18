CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text NOT NULL UNIQUE,
  label text NOT NULL, description text NOT NULL DEFAULT '', display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  CHECK (length(slug) BETWEEN 2 AND 60), CHECK (length(label) BETWEEN 2 AND 100)
);
CREATE TABLE creators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), channel_id text NOT NULL UNIQUE,
  display_name text NOT NULL, slug text NOT NULL UNIQUE, description text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false, enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'), CHECK (length(display_name) BETWEEN 1 AND 150)
);
CREATE TABLE creator_categories (
  creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (creator_id, category_id)
);
CREATE INDEX idx_creator_categories_category ON creator_categories(category_id);
CREATE TABLE sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source text NOT NULL CHECK (source IN ('manual','scheduled')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','partial','failed')),
  requested_by uuid, started_at timestamptz, finished_at timestamptz,
  quota_used integer NOT NULL DEFAULT 0 CHECK (quota_used >= 0),
  channel_count integer NOT NULL DEFAULT 0, video_count integer NOT NULL DEFAULT 0,
  error_code text, error_message text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_runs_status_created ON sync_runs(status,created_at);
CREATE TABLE channel_stats_latest (
  creator_id uuid PRIMARY KEY REFERENCES creators(id) ON DELETE CASCADE,
  subscriber_count bigint CHECK (subscriber_count >= 0),
  subscriber_hidden boolean NOT NULL DEFAULT false,
  view_count bigint CHECK (view_count >= 0), video_count bigint CHECK (video_count >= 0),
  youtube_title text, youtube_description text, thumbnail_url text,
  published_at timestamptz, uploads_playlist_id text,
  fetched_at timestamptz NOT NULL, sync_run_id uuid REFERENCES sync_runs(id),
  CHECK (subscriber_hidden = false OR subscriber_count IS NULL)
);
CREATE TABLE videos (
  video_id text PRIMARY KEY, creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  title text NOT NULL, description text NOT NULL DEFAULT '', published_at timestamptz,
  thumbnail_url text, duration_iso text, is_short boolean, display_on_site boolean NOT NULL DEFAULT true, fetched_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  CHECK (length(video_id) = 11)
);
CREATE INDEX idx_videos_creator_published ON videos(creator_id,published_at DESC);
CREATE TABLE video_stats_latest (
  video_id text PRIMARY KEY REFERENCES videos(video_id) ON DELETE CASCADE,
  view_count bigint CHECK (view_count >= 0), like_count bigint CHECK (like_count >= 0),
  comment_count bigint CHECK (comment_count >= 0), fetched_at timestamptz NOT NULL
);
CREATE TABLE publication_state (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  sync_run_id uuid REFERENCES sync_runs(id), published_at timestamptz
);
INSERT INTO publication_state(id) VALUES(true);

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  password_hash text NOT NULL, role text NOT NULL CHECK (role IN ('owner','editor','moderator')),
  totp_secret_enc text NOT NULL, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz, session_version integer NOT NULL DEFAULT 0
);
CREATE TABLE wall_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL UNIQUE,
  nickname text NOT NULL UNIQUE, password_hash text NOT NULL, email_verified_at timestamptz,
  active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  session_version integer NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_wall_users_nickname_lower ON wall_users(lower(nickname));
CREATE TABLE password_resets (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES wall_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE TABLE email_verifications (
  token_hash text PRIMARY KEY, user_id uuid NOT NULL REFERENCES wall_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, used_at timestamptz
);
CREATE INDEX idx_email_verifications_user ON email_verifications(user_id);
CREATE TABLE wall_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_type text NOT NULL CHECK (author_type IN ('guest','user')),
  author_ref uuid NOT NULL, nickname text NOT NULL, body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), deleted_at timestamptz,
  CHECK (length(body) BETWEEN 1 AND 500)
);
CREATE INDEX idx_wall_messages_created ON wall_messages(created_at DESC,id DESC);
CREATE INDEX idx_wall_messages_author ON wall_messages(author_type,author_ref);
CREATE TABLE wall_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES wall_messages(id) ON DELETE CASCADE,
  reporter_ref text NOT NULL, reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending','resolved','dismissed')),
  UNIQUE(message_id, reporter_ref)
);
CREATE TABLE wall_bans (
  subject_key text PRIMARY KEY, reason text NOT NULL, expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), created_by uuid REFERENCES admin_users(id)
);
CREATE TABLE admin_audit_logs (
  id bigserial PRIMARY KEY, actor_id uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  action text NOT NULL, subject text, metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_created ON admin_audit_logs(created_at DESC);
CREATE TABLE app_settings (
  key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO app_settings(key,value) VALUES
  ('wall_enabled','true'),
  ('wall_read_only','false'),
  ('wall_slow_mode_seconds','5'),
  ('wall_blocked_terms','[]'),
  ('ranking_default','"subscribers"'),
  ('homepage_announcement','""')
ON CONFLICT DO NOTHING;
INSERT INTO categories (slug,label,display_order) VALUES
 ('vloggers-influencers','Vloggers & Influencers',1),
 ('journalists-commentary','Journalists & Commentary',2),
 ('islamic-content','Islamic Content',3),
 ('entertainment-comedy','Entertainment & Comedy',4),
 ('technology-education','Technology & Education',5),
 ('food-lifestyle-travel','Food, Lifestyle & Travel',6),
 ('gaming-sports','Gaming & Sports',7)
ON CONFLICT(slug) DO NOTHING;
