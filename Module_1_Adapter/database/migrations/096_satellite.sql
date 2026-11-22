-- PCI Satellite Intelligence: additive, isolated, no existing tables modified.
CREATE SCHEMA IF NOT EXISTS satellite;
CREATE TABLE IF NOT EXISTS satellite.providers (
 id text PRIMARY KEY CHECK(id IN ('firms','power','gpm','sentinel1','sentinel2','sentinel5p')),
 enabled boolean NOT NULL DEFAULT false,
 refresh_minutes integer NOT NULL DEFAULT 360 CHECK(refresh_minutes BETWEEN 60 AND 10080),
 last_attempt_at timestamptz,
 last_success_at timestamptz,
 last_error text,
 refresh_requested_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO satellite.providers(id,enabled,refresh_minutes) VALUES
 ('firms',false,180),('power',false,1440),('gpm',false,360),
 ('sentinel1',false,1440),('sentinel2',false,1440),('sentinel5p',false,1440)
ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS satellite.observations (
 id bigserial PRIMARY KEY,
 provider text NOT NULL REFERENCES satellite.providers(id),
 metric text NOT NULL CHECK (metric IN ('fire','rainfall','solar')),
 location text NOT NULL,
 observation_key text NOT NULL,
 observed_at timestamptz NOT NULL,
 payload jsonb NOT NULL,
 unique(provider,metric,location,observed_at,observation_key)
);
CREATE INDEX IF NOT EXISTS satellite_observations_lookup ON satellite.observations(metric,location,observed_at DESC);
CREATE INDEX IF NOT EXISTS satellite_observations_provider ON satellite.observations(provider,observed_at DESC);
