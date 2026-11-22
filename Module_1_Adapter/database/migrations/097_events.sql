-- PCI Events v1. No seed events, no fake feeds, no publication without human review.
CREATE TABLE IF NOT EXISTS event_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 140),
 feed_type text NOT NULL CHECK(feed_type IN ('rss','ics','json')),
 feed_url text NOT NULL,
 category text NOT NULL CHECK(category IN ('sports','arts','expos','conferences','community')),
 city_hint text CHECK(city_hint IS NULL OR city_hint IN ('Karachi','Lahore','Islamabad')),
 enabled boolean NOT NULL DEFAULT false,
 official_confirmed boolean NOT NULL DEFAULT false,
 rights_confirmed boolean NOT NULL DEFAULT false,
 last_sync_at timestamptz,
 last_success_at timestamptz,
 last_error text,
 last_status text NOT NULL DEFAULT 'never',
 last_imported integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pci_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES event_sources(id) ON DELETE CASCADE,
 external_id text NOT NULL,
 name text NOT NULL,
 start_at timestamptz NOT NULL,
 all_day boolean NOT NULL DEFAULT false,
 city text NOT NULL CHECK(city IN ('Karachi','Lahore','Islamabad')),
 category text NOT NULL,
 venue text NOT NULL,
 latitude double precision,
 longitude double precision,
 description text NOT NULL DEFAULT '',
 event_url text,
 organizer text NOT NULL DEFAULT '',
 ticket_type text NOT NULL DEFAULT 'unknown' CHECK(ticket_type IN ('free','paid','unknown')),
 price_text text NOT NULL DEFAULT '',
 fingerprint text NOT NULL,
 approved boolean NOT NULL DEFAULT false,
 active boolean NOT NULL DEFAULT true,
 last_seen_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(source_id,external_id),
 CHECK(latitude IS NULL OR latitude BETWEEN -90 AND 90),
 CHECK(longitude IS NULL OR longitude BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS pci_events_public_idx ON pci_events(start_at,city,category) WHERE approved=true AND active=true;
CREATE INDEX IF NOT EXISTS pci_events_source_idx ON pci_events(source_id,start_at);
CREATE TABLE IF NOT EXISTS event_source_runs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 source_id uuid NOT NULL REFERENCES event_sources(id) ON DELETE CASCADE,
 trigger text NOT NULL CHECK(trigger IN ('manual','scheduled')),
 status text NOT NULL CHECK(status IN ('success','error')),
 imported integer NOT NULL DEFAULT 0,
 rejected integer NOT NULL DEFAULT 0,
 detail text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_source_runs_recent_idx ON event_source_runs(source_id,created_at DESC);
