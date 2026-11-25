-- PCI Hub: the old metric table's edits and deletions reach the hub too (additive, idempotent).
-- Without this, a reading corrected or removed in metric_observations would stay in the hub.

-- Recompute the latest API value of one account field from the hub's remaining readings.
-- A web (http) latest value is left alone: it is only there because the API had nothing.
CREATE OR REPLACE FUNCTION hub_refresh_latest(p_entity text, p_metric text) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE cur text; r record;
BEGIN
  SELECT source_id INTO cur FROM ingest_latest WHERE entity_kind='account' AND entity_id=p_entity AND metric=p_metric;
  IF cur IS NOT NULL AND cur LIKE '%.http' THEN RETURN; END IF;
  SELECT source_id, value_numeric, value_scale, accuracy, observed_at INTO r FROM ingest_observations
  WHERE entity_kind='account' AND entity_id=p_entity AND metric=p_metric AND value_numeric IS NOT NULL
    AND accuracy <> 'unverified' AND source_id NOT LIKE '%.http'
  ORDER BY observed_at DESC, value_numeric DESC LIMIT 1;
  IF NOT FOUND THEN
    DELETE FROM ingest_latest WHERE entity_kind='account' AND entity_id=p_entity AND metric=p_metric;
    RETURN;
  END IF;
  INSERT INTO ingest_latest (entity_kind,entity_id,metric,source_id,value_numeric,value_scale,accuracy,observed_at)
  VALUES ('account', p_entity, p_metric, r.source_id, r.value_numeric, r.value_scale, r.accuracy, r.observed_at)
  ON CONFLICT (entity_kind,entity_id,metric) DO UPDATE SET
    source_id=EXCLUDED.source_id, value_numeric=EXCLUDED.value_numeric, value_scale=EXCLUDED.value_scale, value_text=NULL,
    accuracy=EXCLUDED.accuracy, observed_at=EXCLUDED.observed_at, updated_at=now();
END $fn$;

CREATE OR REPLACE FUNCTION hub_mirror_metric_change() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE plat text; ext text; ref text; ent text;
BEGIN
  SELECT platform, external_id INTO plat, ext FROM accounts WHERE id = OLD.account_id;
  -- Account already gone (person deleted): its hub rows go by cascade.
  IF plat IS NULL OR plat NOT IN ('youtube','instagram') THEN RETURN NULL; END IF;
  ref := COALESCE(OLD.run_id::text, 'history:'||OLD.id::text);
  ent := plat||':'||ext;
  BEGIN
    IF TG_OP = 'DELETE' THEN
      DELETE FROM ingest_observations WHERE source_id=plat||'.api' AND source_run_ref=ref
        AND entity_kind='account' AND entity_id=ent AND metric=OLD.metric;
    ELSE
      UPDATE ingest_observations SET metric=NEW.metric, value_numeric=NEW.value,
        accuracy=CASE WHEN NEW.accuracy='exact' THEN 'exact' ELSE 'rounded' END, observed_at=NEW.observed_at
      WHERE source_id=plat||'.api' AND source_run_ref=ref AND entity_kind='account' AND entity_id=ent AND metric=OLD.metric;
      IF NEW.metric <> OLD.metric THEN PERFORM hub_refresh_latest(ent, NEW.metric); END IF;
    END IF;
    PERFORM hub_refresh_latest(ent, OLD.metric);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'hub mirror change skipped for observation %: %', OLD.id, SQLERRM;
  END;
  RETURN NULL;
END $fn$;

DO $$ BEGIN
  IF to_regclass('public.metric_observations') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS hub_mirror_metric_changes ON metric_observations;
    CREATE TRIGGER hub_mirror_metric_changes AFTER UPDATE OR DELETE ON metric_observations
      FOR EACH ROW EXECUTE FUNCTION hub_mirror_metric_change();
  END IF;
END $$;
