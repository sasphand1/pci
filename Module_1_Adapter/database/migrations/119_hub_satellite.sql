-- PCI Hub: satellite / Earth data is a sub-bucket of the one hub (category 'satellite').
-- Non-creator readings may be negative (temperatures); creator counts stay non-negative.
DO $$ BEGIN
 ALTER TABLE ingest_observations DROP CONSTRAINT IF EXISTS ingest_observations_value_numeric_check;
 ALTER TABLE ingest_latest DROP CONSTRAINT IF EXISTS ingest_latest_value_numeric_check;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ingest_observations_value_sign') THEN
  ALTER TABLE ingest_observations ADD CONSTRAINT ingest_observations_value_sign
   CHECK (value_numeric IS NULL OR value_numeric >= 0 OR entity_kind NOT IN ('account','content','comment'));
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='ingest_latest_value_sign') THEN
  ALTER TABLE ingest_latest ADD CONSTRAINT ingest_latest_value_sign
   CHECK (value_numeric IS NULL OR value_numeric >= 0 OR entity_kind NOT IN ('account','content','comment'));
 END IF;
END $$;
INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label) VALUES
 ('sat_firms.api','sat_firms','api',false,'satellite',5,'NASA FIRMS fire hotspots'),
 ('sat_power.api','sat_power','api',false,'satellite',36,'NASA POWER rainfall and sunlight'),
 ('sat_eonet.api','sat_eonet','api',false,'satellite',9,'NASA EONET natural events'),
 ('sat_usgs.api','sat_usgs','api',false,'satellite',2,'USGS earthquakes'),
 ('sat_gibs.api','sat_gibs','api',false,'satellite',36,'NASA GIBS map layers'),
 ('sat_gpm.api','sat_gpm','api',false,'satellite',9,'NASA GPM rain map'),
 ('sat_airquality.api','sat_airquality','api',false,'satellite',2,'Copernicus CAMS air quality'),
 ('sat_weather.api','sat_weather','api',false,'satellite',2,'Open-Meteo weather'),
 ('sat_flood.api','sat_flood','api',false,'satellite',36,'GloFAS river flow'),
 ('sat_gdacs.api','sat_gdacs','api',false,'satellite',2,'GDACS disaster alerts'),
 ('sat_swpc.api','sat_swpc','api',false,'satellite',5,'NOAA space weather'),
 ('sat_celestrak.api','sat_celestrak','api',false,'satellite',9,'CelesTrak orbits'),
 ('sat_openaq.api','sat_openaq','api',false,'satellite',2,'OpenAQ ground stations')
ON CONFLICT (id) DO NOTHING;
