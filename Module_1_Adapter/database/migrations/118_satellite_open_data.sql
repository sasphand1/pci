-- PCI Earth Intelligence v4 (idempotent; also the runtime bootstrap for the satellite schema).
-- Removes the seven "catalogue listing" sources (Sentinel-1/2/5P, Landsat, ECOSTRESS, SMAP,
-- Black Marble) and adds free sources that deliver ready-to-use numbers.
CREATE SCHEMA IF NOT EXISTS satellite;
CREATE TABLE IF NOT EXISTS satellite.providers (
 id text PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT false,
 refresh_minutes integer NOT NULL DEFAULT 360 CHECK(refresh_minutes BETWEEN 60 AND 10080),
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 last_error text,
 refresh_requested_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS satellite.observations (
 id bigserial PRIMARY KEY,
 provider text NOT NULL REFERENCES satellite.providers(id),
 metric text NOT NULL,
 location text NOT NULL,
 observation_key text NOT NULL,
 observed_at timestamptz NOT NULL,
 payload jsonb NOT NULL,
 unique(provider,metric,location,observed_at,observation_key)
);
CREATE INDEX IF NOT EXISTS satellite_observations_lookup ON satellite.observations(metric,location,observed_at DESC);
CREATE INDEX IF NOT EXISTS satellite_observations_provider ON satellite.observations(provider,observed_at DESC);
CREATE TABLE IF NOT EXISTS satellite.rollout_flags(flag text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());

DO $$ BEGIN
 -- Older bootstraps re-added their own id/metric lists; v4 owns the constraints from now on.
 ALTER TABLE satellite.providers DROP CONSTRAINT IF EXISTS providers_id_check;
 ALTER TABLE satellite.observations DROP CONSTRAINT IF EXISTS observations_metric_check;
 DELETE FROM satellite.observations WHERE provider IN ('sentinel1','sentinel2','sentinel5p','landsat','ecostress','smap','blackmarble')
  OR metric IN ('scene','science_scene');
 DELETE FROM satellite.providers WHERE id IN ('sentinel1','sentinel2','sentinel5p','landsat','ecostress','smap','blackmarble');
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_v4') THEN
  ALTER TABLE satellite.providers ADD CONSTRAINT providers_id_v4 CHECK (id IN
   ('firms','power','eonet','usgs','gibs','gpm','airquality','weather','flood','gdacs','swpc','celestrak','openaq'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_v4') THEN
  ALTER TABLE satellite.observations ADD CONSTRAINT observations_metric_v4 CHECK (metric IN
   ('fire','rainfall','solar','natural_event','imagery','earthquake','air_quality','weather','river_flow','disaster_alert','space_weather','orbit','aq_station'));
 END IF;
END $$;

INSERT INTO satellite.providers(id,enabled,refresh_minutes) VALUES
 ('firms',false,180),('power',false,1440),('eonet',false,360),('usgs',false,60),('gibs',false,1440),('gpm',false,360),('openaq',false,60)
ON CONFLICT(id) DO NOTHING;
-- Keyless v4 sources start enabled once; afterwards the administrator's choice is kept.
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM satellite.rollout_flags WHERE flag='v4_open_data_enabled') THEN
  INSERT INTO satellite.providers(id,enabled,refresh_minutes,refresh_requested_at) VALUES
   ('airquality',true,60,now()),('weather',true,60,now()),('flood',true,1440,now()),
   ('gdacs',true,60,now()),('swpc',true,180,now()),('celestrak',true,360,now())
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO satellite.rollout_flags(flag) VALUES ('v4_open_data_enabled');
 END IF;
END $$;
