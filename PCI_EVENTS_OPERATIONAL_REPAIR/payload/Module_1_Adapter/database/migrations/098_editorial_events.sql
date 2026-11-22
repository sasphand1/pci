-- PCI editorial events: individually checked factual notices with primary-source URL.
-- Separate from external feed records: this NEVER schedules an HTML page as a JSON feed.
CREATE TABLE IF NOT EXISTS pci_editorial_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(name) BETWEEN 4 AND 180),
 start_at timestamptz NOT NULL,
 end_at timestamptz NOT NULL,
 city text NOT NULL CHECK (city IN ('Karachi','Lahore','Islamabad')),
 category text NOT NULL CHECK (category IN ('sports','arts','expos','conferences','community')),
 venue text NOT NULL CHECK (length(venue) BETWEEN 3 AND 200),
 latitude double precision NOT NULL CHECK (latitude BETWEEN 23 AND 35),
 longitude double precision NOT NULL CHECK (longitude BETWEEN 66 AND 76),
 source_url text NOT NULL CHECK (source_url LIKE 'https://%'),
 organizer text NOT NULL DEFAULT '',
 description text NOT NULL DEFAULT '',
 ticket_type text NOT NULL DEFAULT 'unknown' CHECK (ticket_type IN ('free','paid','unknown')),
 price_text text NOT NULL DEFAULT '',
 approved boolean NOT NULL DEFAULT false,
 verified_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (end_at > start_at),
 UNIQUE (name, start_at, city)
);
CREATE INDEX IF NOT EXISTS pci_editorial_events_public_idx ON pci_editorial_events (start_at,city) WHERE approved;
