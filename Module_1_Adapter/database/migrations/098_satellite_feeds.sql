-- PCI Satellite: safe additive provider rollout. Preserves creator and Events schemas.
-- Keep runtime re-execution idempotent without overriding subsequent administrator choices.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_check' AND pg_get_constraintdef(oid) NOT LIKE '%eonet%') THEN
  ALTER TABLE satellite.providers DROP CONSTRAINT providers_id_check;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_check') THEN
  ALTER TABLE satellite.providers ADD CONSTRAINT providers_id_check CHECK (id IN ('firms','power','gpm','sentinel1','sentinel2','sentinel5p','eonet','gibs'));
 END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_check' AND pg_get_constraintdef(oid) NOT LIKE '%natural_event%') THEN
  ALTER TABLE satellite.observations DROP CONSTRAINT observations_metric_check;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_check') THEN
  ALTER TABLE satellite.observations ADD CONSTRAINT observations_metric_check CHECK(metric IN ('fire','rainfall','solar','natural_event','scene','imagery'));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS satellite.rollout_flags(flag text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM satellite.rollout_flags WHERE flag='v3_open_feeds_enabled') THEN
  INSERT INTO satellite.providers(id,enabled,refresh_minutes,refresh_requested_at) VALUES
    ('eonet',true,360,now()),('gibs',true,1440,now()) ON CONFLICT (id) DO NOTHING;
  -- Old placeholder sources were hard-disabled. Activate only never-attempted entries once.
  UPDATE satellite.providers SET enabled=true,refresh_requested_at=now(),updated_at=now()
   WHERE id IN ('gpm','sentinel1','sentinel2','sentinel5p') AND last_attempt_at IS NULL AND enabled=false;
  INSERT INTO satellite.rollout_flags(flag) VALUES ('v3_open_feeds_enabled');
 END IF;
END $$;
