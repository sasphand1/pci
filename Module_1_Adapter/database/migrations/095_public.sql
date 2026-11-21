-- 095_public: what the public website needs beyond the rankings. Idempotent.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_url text;
CREATE INDEX IF NOT EXISTS people_display_name_idx ON people(lower(display_name));
