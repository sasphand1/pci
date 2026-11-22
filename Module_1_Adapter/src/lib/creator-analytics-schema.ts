import {pool} from './db.js';

/** Safe to run from the API and worker; matches migration 102. */
export async function ensureCreatorAnalyticsSchema():Promise<void> {
  const sql=`CREATE TABLE IF NOT EXISTS creator_video_catalogue (
    video_id text PRIMARY KEY CHECK(length(video_id)=11),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title text NOT NULL, published_at timestamptz, thumbnail_url text, duration_iso text,
    view_count bigint CHECK(view_count IS NULL OR view_count>=0),
    last_observed_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE INDEX IF NOT EXISTS creator_video_catalogue_account_idx ON creator_video_catalogue(account_id,published_at DESC);
    CREATE TABLE IF NOT EXISTS creator_video_view_observations (
      video_id text NOT NULL REFERENCES creator_video_catalogue(video_id) ON DELETE CASCADE,
      observed_at timestamptz NOT NULL,
      view_count bigint NOT NULL CHECK(view_count>=0),
      PRIMARY KEY(video_id,observed_at));
    CREATE INDEX IF NOT EXISTS creator_video_view_recent_idx ON creator_video_view_observations(video_id,observed_at DESC);`;
  await pool.query(sql);
}
