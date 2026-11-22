-- PCI Events Intelligence v1: additive, idempotent, and does not change existing publication decisions.
-- Run only after migrations 097 and 098, under the existing Events advisory bootstrap lock.
ALTER TABLE pci_events
 ADD COLUMN IF NOT EXISTS classification_category text,
 ADD COLUMN IF NOT EXISTS classification_confidence integer,
 ADD COLUMN IF NOT EXISTS classification_reason text,
 ADD COLUMN IF NOT EXISTS classification_state text NOT NULL DEFAULT 'needs_review',
 ADD COLUMN IF NOT EXISTS review_decision text NOT NULL DEFAULT 'pending',
 ADD COLUMN IF NOT EXISTS classified_at timestamptz;

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pci_events_intelligence_category_ck') THEN
  ALTER TABLE pci_events ADD CONSTRAINT pci_events_intelligence_category_ck
   CHECK (classification_category IS NULL OR classification_category IN
    ('sports','education','gaming','technology','business','arts','community'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pci_events_intelligence_confidence_ck') THEN
  ALTER TABLE pci_events ADD CONSTRAINT pci_events_intelligence_confidence_ck
   CHECK (classification_confidence IS NULL OR classification_confidence BETWEEN 0 AND 100);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pci_events_intelligence_state_ck') THEN
  ALTER TABLE pci_events ADD CONSTRAINT pci_events_intelligence_state_ck
   CHECK (classification_state IN ('suggested','needs_review','manual'));
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pci_events_intelligence_decision_ck') THEN
  ALTER TABLE pci_events ADD CONSTRAINT pci_events_intelligence_decision_ck
   CHECK (review_decision IN ('pending','approved','rejected'));
 END IF;
END $$;

ALTER TABLE pci_editorial_events
 ADD COLUMN IF NOT EXISTS review_decision text NOT NULL DEFAULT 'pending';
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='pci_editorial_events_review_decision_ck') THEN
  ALTER TABLE pci_editorial_events ADD CONSTRAINT pci_editorial_events_review_decision_ck
   CHECK (review_decision IN ('pending','approved','rejected'));
 END IF;
END $$;

-- Keep old classification labels valid so existing source and editorial records are not broken.
-- Do not recreate constraints on every startup: only migrate old five-category check once.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='event_sources'::regclass
   AND conname='event_sources_category_check' AND pg_get_constraintdef(oid) NOT LIKE '%gaming%') THEN
  ALTER TABLE event_sources DROP CONSTRAINT event_sources_category_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='event_sources'::regclass
   AND conname='event_sources_category_check') THEN
  ALTER TABLE event_sources ADD CONSTRAINT event_sources_category_check
   CHECK (category IN ('sports','education','gaming','technology','business','arts','community','expos','conferences'));
 END IF;
 IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pci_editorial_events'::regclass
   AND conname='pci_editorial_events_category_check' AND pg_get_constraintdef(oid) NOT LIKE '%gaming%') THEN
  ALTER TABLE pci_editorial_events DROP CONSTRAINT pci_editorial_events_category_check;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='pci_editorial_events'::regclass
   AND conname='pci_editorial_events_category_check') THEN
  ALTER TABLE pci_editorial_events ADD CONSTRAINT pci_editorial_events_category_check
   CHECK (category IN ('sports','education','gaming','technology','business','arts','community','expos','conferences'));
 END IF;
END $$;

CREATE INDEX IF NOT EXISTS pci_events_intelligence_bucket_idx
 ON pci_events (start_at,classification_category) WHERE active;
CREATE INDEX IF NOT EXISTS pci_events_intelligence_pending_idx
 ON pci_events (created_at) WHERE classification_category IS NULL;
