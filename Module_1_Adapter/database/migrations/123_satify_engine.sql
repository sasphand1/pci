-- Satify Hub engine: async Copernicus jobs (CAMS on the ADS, GloFAS on the EWDS) and one-time launch fixes.
-- Idempotent: runs on every start through ensureSatifySchema.
CREATE TABLE IF NOT EXISTS satify.jobs (
  id bigserial PRIMARY KEY,
  connector text NOT NULL,
  run_key text NOT NULL,
  portal text NOT NULL,
  dataset text NOT NULL,
  request jsonb NOT NULL,
  job_id text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','submitted','done','failed')),
  result jsonb,
  error text,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (connector, run_key)
);
CREATE INDEX IF NOT EXISTS satify_jobs_open ON satify.jobs(status, updated_at) WHERE status IN ('pending','submitted');

INSERT INTO satify.sources(id,label,kind,min_minutes) VALUES
 ('cams_pm25','Copernicus CAMS PM2.5 forecast (ADS)','air',180),
 ('cams_pm10','Copernicus CAMS PM10 forecast (ADS)','air',180),
 ('glofas','Copernicus GloFAS river discharge (EWDS)','river',720)
ON CONFLICT (id) DO NOTHING;

-- One-time changes, recorded so a later admin decision is never overwritten.
CREATE TABLE IF NOT EXISTS satify.applied (key text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM satify.applied WHERE key='motorway_placeholder_v1') THEN
  UPDATE satify.packs SET status='soon',updated_at=now() WHERE slug='motorway' AND status='live';
  INSERT INTO satify.applied(key) VALUES ('motorway_placeholder_v1');
 END IF;
 IF NOT EXISTS (SELECT 1 FROM satify.applied WHERE key='met_norway_label_v1') THEN
  BEGIN
   UPDATE ingest_sources SET label='MET Norway weather' WHERE id='sat_weather.api';
  EXCEPTION WHEN undefined_table THEN NULL;
  END;
  INSERT INTO satify.applied(key) VALUES ('met_norway_label_v1');
 END IF;
END $$;
