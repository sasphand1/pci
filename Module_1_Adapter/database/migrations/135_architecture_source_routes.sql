-- 135: approved source/entity/metric routes. Existing direct bulk writers are covered too.
-- Exact source mappings come from the verified provider writers, not from live rows alone.
-- OpenAQ has a deliberately dynamic metric family; only its aq_station namespace is accepted.
-- No statistics writes are authorized for youtube.http, tiktok.http or restaurant_images.http.
-- TikTok oEmbed content and restaurant image cache operations are unaffected.
CREATE OR REPLACE FUNCTION public.pci_arch_hub_route_allowed(src text, kind text, entity text, metric_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT COALESCE(CASE src
   WHEN 'youtube.api' THEN (kind='account' AND entity ~ '^youtube:.+$' AND metric_name IN ('followers','views','posts_30d','video_count','channel_banner_url'))
     OR (kind='content' AND entity ~ '^youtube:.+$' AND metric_name IN ('views','likes','comments'))
   WHEN 'instagram.api' THEN (kind='account' AND entity ~ '^instagram:.+$' AND metric_name IN ('followers','views','posts_30d','avatar_url'))
   WHEN 'instagram.http' THEN (kind='account' AND entity ~ '^instagram:.+$' AND metric_name IN ('avatar_url'))
   WHEN 'scrappa.api' THEN (kind='account' AND entity ~ '^tiktok_candidate:[0-9]{1,30}$' AND metric_name IN ('followers','following','likes','video_count','sample_size','average_views','average_likes','average_comments','average_shares'))
     OR (kind='content' AND entity ~ '^tiktok_candidate:[0-9]{1,30}:[0-9]{1,30}$' AND metric_name IN ('views','likes','comments','shares','favorites','downloads'))
   WHEN 'google_places.api' THEN (kind='place' AND entity ~ '^google_places:.+$' AND metric_name IN ('rating','reviews','score'))
   WHEN 'sat_firms.api' THEN (kind='region' AND entity ~ '^region:pakistan$' AND metric_name IN ('fire_hotspots_3d'))
   WHEN 'sat_power.api' THEN (kind='city' AND entity ~ '^city:.+$' AND metric_name IN ('rainfall_mm','solar_kwh_m2'))
   WHEN 'sat_eonet.api' THEN (kind='natural_event' AND entity ~ '^eonet:.+$' AND metric_name IN ('event'))
   WHEN 'sat_usgs.api' THEN (kind='earthquake' AND entity ~ '^usgs:.+$' AND metric_name IN ('magnitude'))
   WHEN 'sat_gibs.api' THEN (kind='map_layer' AND entity ~ '^gibs:.+$' AND metric_name IN ('latest_day'))
   WHEN 'sat_gpm.api' THEN (kind='map_layer' AND entity ~ '^gibs:.+$' AND metric_name IN ('latest_day'))
   WHEN 'sat_airquality.api' THEN (kind='city' AND entity ~ '^city:.+$' AND metric_name IN ('us_aqi','pm2_5','pm10','no2','o3','dust','uv_index'))
   WHEN 'sat_weather.api' THEN (kind='city' AND entity ~ '^city:.+$' AND metric_name IN ('temperature_c','feels_like_c','humidity_pct','precipitation_mm','wind_kmh','heat_days_7d'))
   WHEN 'sat_flood.api' THEN (kind='river_point' AND entity ~ '^river:.+$' AND metric_name IN ('discharge_m3s','peak_30d_m3s'))
   WHEN 'sat_gdacs.api' THEN (kind='disaster_alert' AND entity ~ '^gdacs:.+$' AND metric_name IN ('alert_score'))
   WHEN 'sat_swpc.api' THEN (kind='space' AND entity ~ '^space:kp$' AND metric_name IN ('kp_index'))
   WHEN 'sat_celestrak.api' THEN (kind='orbiting_object' AND entity ~ '^norad:.+$' AND metric_name IN ('orbital_elements'))
   WHEN 'sat_openaq.api' THEN (kind='aq_station' AND entity ~ '^openaq:.+$' AND metric_name ~ '^[a-z][a-z0-9_]{0,63}$')
   WHEN 'sat_insights.api' THEN (kind='city' AND entity ~ '^city:.+$' AND metric_name IN ('go_out_score'))
     OR (kind='ranking' AND entity ~ '^ranking:.+$' AND metric_name IN ('winner_value'))
   WHEN 'satify.api' THEN (kind='satify_scope' AND entity ~ '^.+$' AND metric_name IN ('aqi','aqi_label','pm25','aqi_forecast_max','aqi_forecast_label','temp_now','temp_max','temp_min','feels_max','rain_chance','uv_max','fog_pct','visibility_km','fog_risk','fog_clear_time','school_closure_chance','school_notice','section144','usd_pkr','usd_pkr_open','gold_usd_oz','gold_tola','petrol_price','diesel_price','top_trend','route_visibility_km','route_fog_clear_time','motorway_status','nhmp_status'))
   ELSE false END,false);
$$;

-- Refuse activation if a retained row has an unreviewed route. Do not delete or relabel data.
DO $$
DECLARE bad_history bigint; bad_latest bigint;
BEGIN
 SELECT count(*) INTO bad_history FROM public.ingest_observations
 WHERE NOT public.pci_arch_hub_route_allowed(source_id,entity_kind,entity_id,metric);
 SELECT count(*) INTO bad_latest FROM public.ingest_latest
 WHERE NOT public.pci_arch_hub_route_allowed(source_id,entity_kind,entity_id,metric);
 IF bad_history<>0 OR bad_latest<>0 THEN
   RAISE EXCEPTION USING ERRCODE='23514',
    MESSAGE=format('PCI_ARCH_DB_008: existing unapproved Hub routes (%s history, %s latest)',bad_history,bad_latest),
    HINT='Review the historical source/entity/metric routes against the verified provider contracts before activation; do not delete data to silence the guard.';
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.pci_arch_guard_hub_route()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF NOT public.pci_arch_hub_route_allowed(NEW.source_id,NEW.entity_kind,NEW.entity_id,NEW.metric) THEN
   RAISE EXCEPTION USING ERRCODE='23514',
    MESSAGE='PCI_ARCH_DB_009: unauthorized Hub source/entity/metric route',
    HINT='Use the source-specific contract and the approved Main Data Hub writer. Add new provider metrics through reviewed architecture policy and migrations.';
 END IF;
 RETURN NEW;
END;
$$;
-- Run after the existing 134 Scrappa guard so its specific corrective errors are preserved.
DROP TRIGGER IF EXISTS pci_arch_z_hub_route_guard ON public.ingest_observations;
CREATE TRIGGER pci_arch_z_hub_route_guard BEFORE INSERT OR UPDATE ON public.ingest_observations
FOR EACH ROW EXECUTE FUNCTION public.pci_arch_guard_hub_route();
DROP TRIGGER IF EXISTS pci_arch_z_hub_route_guard ON public.ingest_latest;
CREATE TRIGGER pci_arch_z_hub_route_guard BEFORE INSERT OR UPDATE ON public.ingest_latest
FOR EACH ROW EXECUTE FUNCTION public.pci_arch_guard_hub_route();
