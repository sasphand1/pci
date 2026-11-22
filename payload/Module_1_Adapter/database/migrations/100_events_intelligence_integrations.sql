-- PCI Events Intelligence v2: additive schema; deletion is reversible but never silently republished.
ALTER TABLE pci_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE pci_events ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE pci_events ADD COLUMN IF NOT EXISTS deletion_reason text;
ALTER TABLE pci_editorial_events ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE pci_editorial_events ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE pci_editorial_events ADD COLUMN IF NOT EXISTS deletion_reason text;
CREATE TABLE IF NOT EXISTS pci_event_action_log(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 event_id uuid NOT NULL, origin text NOT NULL CHECK(origin IN ('feed','editorial')),
 actor_id uuid NOT NULL, action text NOT NULL CHECK(action IN ('delete','restore')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 500),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pci_event_action_log_event ON pci_event_action_log(origin,event_id,created_at DESC);
CREATE INDEX IF NOT EXISTS pci_events_deleted_idx ON pci_events(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS pci_editorial_deleted_idx ON pci_editorial_events(deleted_at) WHERE deleted_at IS NOT NULL;
-- Expand only once; avoid repeated DDL/locks on each application startup.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='event_sources'::regclass
    AND conname='event_sources_category_check' AND pg_get_constraintdef(oid) NOT LIKE '%fashion%') THEN
  ALTER TABLE event_sources DROP CONSTRAINT event_sources_category_check;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='event_sources'::regclass
    AND conname='event_sources_category_check') THEN
  ALTER TABLE event_sources ADD CONSTRAINT event_sources_category_check CHECK
   (category IN ('sports','education','gaming','technology','business','arts','community','fashion','health','food','expos','conferences'));
 END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='pci_editorial_events'::regclass
    AND conname='pci_editorial_events_category_check' AND pg_get_constraintdef(oid) NOT LIKE '%fashion%') THEN
  ALTER TABLE pci_editorial_events DROP CONSTRAINT pci_editorial_events_category_check;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='pci_editorial_events'::regclass
    AND conname='pci_editorial_events_category_check') THEN
  ALTER TABLE pci_editorial_events ADD CONSTRAINT pci_editorial_events_category_check CHECK
   (category IN ('sports','education','gaming','technology','business','arts','community','fashion','health','food','expos','conferences'));
 END IF;
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='pci_events'::regclass
    AND conname='pci_events_intelligence_category_ck' AND pg_get_constraintdef(oid) NOT LIKE '%fashion%') THEN
  ALTER TABLE pci_events DROP CONSTRAINT pci_events_intelligence_category_ck;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='pci_events'::regclass
    AND conname='pci_events_intelligence_category_ck') THEN
  ALTER TABLE pci_events ADD CONSTRAINT pci_events_intelligence_category_ck CHECK
   (classification_category IS NULL OR classification_category IN ('sports','education','gaming','technology','business','arts','community','fashion','health','food'));
 END IF;
END $$;

-- Migrate the THREE notices previously shown from hardcoded website fallback to
-- administrator-controlled editorial rows. This is a preservation of prior publication,
-- not discovery-driven automatic approval. Re-execution never resurrects a deleted row.
ALTER TABLE pci_editorial_events ADD COLUMN IF NOT EXISTS all_day boolean NOT NULL DEFAULT false;
INSERT INTO pci_editorial_events(name,start_at,end_at,city,category,venue,latitude,longitude,source_url,organizer,description,approved,review_decision,all_day)
VALUES
 ('IAPEX27 — Architecture & Building Materials Expo','2027-01-15T00:00:00+05:00','2027-01-18T00:00:00+05:00','Islamabad','business','Pak-China Friendship Centre',33.69726,73.08298,'https://www.iapex.pk/visit/faqs','Institute of Architects Pakistan — RIC','15–17 January 2027; confirm programme with organiser.',true,'approved',true),
 ('40th Lahore International Book Fair 2027','2027-01-20T00:00:00+05:00','2027-01-25T00:00:00+05:00','Lahore','education','Lahore International Expo Centre',31.464,74.259,'https://libftrust.com/about-us/about-the-event/','Lahore International Book Fair Trust','20–24 January 2027; verify before travelling.',true,'approved',true),
 ('21st Karachi International Book Fair 2026','2026-12-17T00:00:00+05:00','2026-12-22T00:00:00+05:00','Karachi','education','Karachi Expo Centre, Halls 1–3',24.90139,67.076083,'https://tdap.gov.pk/wp-content/uploads/2025/07/Booking-Schedule-of-KEC_22_July.pdf','Karachi International Book Fair','17–21 December 2026; TDAP venue booking schedule.',true,'approved',true)
ON CONFLICT(name,start_at,city) DO NOTHING;
