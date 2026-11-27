-- TikTok private staging: explicit identity links, refresh state and coherent snapshots.
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS last_success_at timestamptz;
ALTER TABLE scrappa_candidates ADD COLUMN IF NOT EXISTS last_error text;
CREATE UNIQUE INDEX IF NOT EXISTS scrappa_candidate_person_uq ON scrappa_candidates(person_id) WHERE person_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS scrappa_snapshots (
 run_id uuid PRIMARY KEY REFERENCES ingest_jobs(id) ON DELETE CASCADE,
 external_id text NOT NULL REFERENCES scrappa_candidates(external_id) ON DELETE CASCADE,
 observed_at timestamptz NOT NULL,
 profile jsonb NOT NULL,
 posts jsonb NOT NULL,
 analytics jsonb NOT NULL
);
CREATE INDEX IF NOT EXISTS scrappa_snapshot_latest_idx ON scrappa_snapshots(external_id, observed_at DESC);
