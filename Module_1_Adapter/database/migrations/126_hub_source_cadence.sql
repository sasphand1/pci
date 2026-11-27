-- 126_hub_source_cadence: realistic delivery rhythms for sources whose data cannot arrive every 2 hours.
-- Copernicus CAMS air quality is a forecast prepared about twice a day (new run picked up at 00:00 and 10:00 UTC),
-- and Satify mirrors its readings in batches. Only the shipped default (2) is changed; an admin-edited value is kept.
UPDATE ingest_sources SET expected_hours=12 WHERE id='sat_airquality.api' AND expected_hours=2;
UPDATE ingest_sources SET expected_hours=6 WHERE id='satify.api' AND expected_hours=2;
