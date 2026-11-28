-- Add database-enforced integrity at the verified Scrappa staging and publication boundaries.
-- No data changes, no privilege changes, no automatic promotion of candidates.
-- Existing observations are not revalidated; constraints apply to future writes.
CREATE OR REPLACE FUNCTION public.pci_arch_scrappa_key_ok(kind text, entity text, metric_name text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
 SELECT COALESCE(CASE kind
   WHEN 'account' THEN entity ~ '^tiktok_candidate:[0-9]{1,30}$'
     AND metric_name IN ('followers','following','likes','video_count','sample_size','average_views','average_likes','average_comments','average_shares')
   WHEN 'content' THEN entity ~ '^tiktok_candidate:[0-9]{1,30}:[0-9]{1,30}$'
     AND metric_name IN ('views','likes','comments','shares','favorites','downloads')
   ELSE false END,false);
$$;

CREATE OR REPLACE FUNCTION public.pci_arch_guard_observation()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE candidate_id text;
BEGIN
 IF NEW.source_id <> 'scrappa.api' THEN
   IF starts_with(NEW.entity_id,'tiktok_candidate:') THEN
     RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_001: candidate namespace reserved for Scrappa', HINT='Use the declared source and entity key through recordObservation().';
   END IF;
   RETURN NEW;
 END IF;
 candidate_id := split_part(NEW.entity_id,':',2);
 IF NOT public.pci_arch_scrappa_key_ok(NEW.entity_kind,NEW.entity_id,NEW.metric)
   OR NEW.account_id IS NOT NULL
   OR NEW.raw_metadata->>'stage' IS DISTINCT FROM 'candidate'
   OR jsonb_typeof(NEW.raw_metadata->'candidateId') IS DISTINCT FROM 'string'
   OR NEW.raw_metadata->>'candidateId' IS DISTINCT FROM candidate_id
   OR NEW.value_numeric IS NULL OR NEW.value_text IS NOT NULL THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_002: invalid Scrappa staging observation', HINT='Use the Creators Bucket staging writer with a matching candidate ID, approved metric and null account association.';
 END IF;
 IF NEW.source_run_ref !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_003: missing collection run provenance', HINT='Use the existing Scrappa ingest_jobs lease and its UUID as source_run_ref.';
 END IF;
 PERFORM 1 FROM public.ingest_jobs WHERE id=NEW.source_run_ref::uuid AND source_id='scrappa.api' AND status='running' AND started_at>now()-interval '5 minutes' FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_003: invalid or expired collection run', HINT='Acquire the existing Scrappa collection lease before calling recordObservation().';
 END IF;
 PERFORM 1 FROM public.scrappa_candidates WHERE external_id=candidate_id FOR KEY SHARE;
 IF NOT FOUND THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_004: unknown staged candidate', HINT='Register and verify the candidate in the Creators Bucket before collecting metrics.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pci_arch_observation_guard ON public.ingest_observations;
CREATE TRIGGER pci_arch_observation_guard BEFORE INSERT OR UPDATE ON public.ingest_observations
FOR EACH ROW EXECUTE FUNCTION public.pci_arch_guard_observation();

CREATE OR REPLACE FUNCTION public.pci_arch_guard_latest()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
 IF NEW.source_id <> 'scrappa.api' THEN
   IF starts_with(NEW.entity_id,'tiktok_candidate:') THEN
     RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_001: candidate namespace reserved for Scrappa', HINT='Use the declared source and entity key through recordObservation().';
   END IF;
   RETURN NEW;
 END IF;
 IF NOT public.pci_arch_scrappa_key_ok(NEW.entity_kind,NEW.entity_id,NEW.metric) OR NEW.value_numeric IS NULL OR NEW.value_text IS NOT NULL THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_005: invalid Scrappa projection', HINT='Use recordObservation() to project approved candidate metrics.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.ingest_observations o
   WHERE o.source_id=NEW.source_id AND o.entity_kind=NEW.entity_kind AND o.entity_id=NEW.entity_id AND o.metric=NEW.metric
     AND o.observed_at=NEW.observed_at AND o.accuracy=NEW.accuracy AND o.value_scale=NEW.value_scale
     AND o.value_numeric IS NOT DISTINCT FROM NEW.value_numeric AND o.value_text IS NOT DISTINCT FROM NEW.value_text) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_006: projection has no matching Hub observation', HINT='Write the historical observation with recordObservation() before updating ingest_latest.';
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pci_arch_latest_guard ON public.ingest_latest;
CREATE TRIGGER pci_arch_latest_guard BEFORE INSERT OR UPDATE ON public.ingest_latest
FOR EACH ROW EXECUTE FUNCTION public.pci_arch_guard_latest();

-- Enforce referential publication integrity at transaction end. The legitimate publisher
-- supersedes the old run before swapping the pointer; validating immediately would break that flow.
CREATE OR REPLACE FUNCTION public.pci_arch_guard_publication()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE target_scope text; target_run uuid;
BEGIN
 IF TG_TABLE_NAME='published_pointers' THEN
   target_scope := NEW.scope;
   SELECT p.run_id INTO target_run FROM public.published_pointers p WHERE p.scope=target_scope;
 ELSE
   target_run := NEW.id;
   SELECT p.scope INTO target_scope FROM public.published_pointers p WHERE p.run_id=target_run ORDER BY p.scope LIMIT 1;
 END IF;
 IF target_run IS NULL OR target_scope IS NULL THEN RETURN NULL; END IF;
 -- Lock the referenced run against concurrent changes to publication status/scope.
 PERFORM 1 FROM public.rank_runs r WHERE r.id=target_run AND r.scope=target_scope AND r.status='published' AND r.published_at IS NOT NULL FOR SHARE;
 IF NOT FOUND OR EXISTS (SELECT 1 FROM public.published_pointers p WHERE p.run_id=target_run AND p.scope<>target_scope) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='PCI_ARCH_DB_007: pointer must reference a published run of the same scope', HINT='Use buildBatch() and publishBatch(); complete validation before updating the publication pointer.';
 END IF;
 RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS pci_arch_pointer_guard ON public.published_pointers;
CREATE CONSTRAINT TRIGGER pci_arch_pointer_guard AFTER INSERT OR UPDATE ON public.published_pointers
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.pci_arch_guard_publication();
DROP TRIGGER IF EXISTS pci_arch_run_guard ON public.rank_runs;
CREATE CONSTRAINT TRIGGER pci_arch_run_guard AFTER UPDATE ON public.rank_runs
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.pci_arch_guard_publication();
