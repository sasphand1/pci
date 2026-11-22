-- PCI Earth Intelligence: additive provider registry and earthquake observations.
-- Earth observation raster products are deliberately disabled until scientifically verified.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_check' AND pg_get_constraintdef(oid) NOT LIKE '%blackmarble%') THEN
  ALTER TABLE satellite.providers DROP CONSTRAINT providers_id_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.providers'::regclass AND conname='providers_id_check') THEN
  ALTER TABLE satellite.providers ADD CONSTRAINT providers_id_check CHECK (id IN ('firms','power','gpm','sentinel1','sentinel2','sentinel5p','eonet','gibs','usgs','landsat','ecostress','smap','blackmarble'));
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_check' AND pg_get_constraintdef(oid) NOT LIKE '%earthquake%') THEN
  ALTER TABLE satellite.observations DROP CONSTRAINT observations_metric_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='satellite.observations'::regclass AND conname='observations_metric_check') THEN
  ALTER TABLE satellite.observations ADD CONSTRAINT observations_metric_check CHECK (metric IN ('fire','rainfall','solar','natural_event','scene','imagery','earthquake'));
 END IF;
END $$;
INSERT INTO satellite.providers(id,enabled,refresh_minutes) VALUES
 ('usgs',false,60),('landsat',false,1440),('ecostress',false,1440),('smap',false,1440),('blackmarble',false,1440)
ON CONFLICT (id) DO NOTHING;
