ALTER TABLE videos ADD COLUMN IF NOT EXISTS display_on_site boolean NOT NULL DEFAULT true;
INSERT INTO app_settings(key,value) VALUES
  ('sync_schedule_enabled','true'),
  ('sync_schedule_time','"09:00"')
ON CONFLICT(key) DO NOTHING;
