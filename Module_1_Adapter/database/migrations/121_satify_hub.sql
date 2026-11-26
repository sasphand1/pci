-- Satify Hub: Pakistan public-information alerts ("Satisfy yourself").
-- Its own schema so it never mixes with creator data; key numbers are mirrored into the main PCI hub.
-- Idempotent: safe to run on every start (ensureSatifySchema) and through the migrate CLI.
CREATE SCHEMA IF NOT EXISTS satify;

-- Source health for every Satify connector (MET Norway, METAR, FX, gold ...).
CREATE TABLE IF NOT EXISTS satify.sources (
  id text PRIMARY KEY,
  label text NOT NULL,
  kind text NOT NULL,
  min_minutes int NOT NULL DEFAULT 60,
  enabled boolean NOT NULL DEFAULT true,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  fail_count int NOT NULL DEFAULT 0
);

-- Latest value of every signal per scope (city id, route id or 'pk').
CREATE TABLE IF NOT EXISTS satify.signals_latest (
  signal_id text NOT NULL,
  scope text NOT NULL,
  value_numeric double precision,
  value_text text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  badge text NOT NULL CHECK (badge IN ('measured','official','forecast','estimate')),
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, scope)
);

-- Full history (kept: history is what companies pay for).
CREATE TABLE IF NOT EXISTS satify.readings (
  id bigserial PRIMARY KEY,
  signal_id text NOT NULL,
  scope text NOT NULL,
  value_numeric double precision,
  value_text text,
  badge text NOT NULL,
  source text NOT NULL,
  observed_at timestamptz NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (signal_id, scope, observed_at, source)
);
CREATE INDEX IF NOT EXISTS satify_readings_lookup ON satify.readings(signal_id, scope, observed_at DESC);

-- Manual / official entries: petrol price, tola rate, school notices, motorway closures, Section 144.
CREATE TABLE IF NOT EXISTS satify.manual_signals (
  id bigserial PRIMARY KEY,
  signal_id text NOT NULL,
  scope text NOT NULL DEFAULT 'pk',
  value_numeric double precision,
  value_text text,
  source_url text,
  note text,
  valid_until timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS satify_manual_active ON satify.manual_signals(signal_id, scope, created_at DESC) WHERE active;

-- Packs (the cards). Built in the admin Pack Builder; no code needed for a new pack.
CREATE TABLE IF NOT EXISTS satify.packs (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{2,20}$'),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '📡',
  group_id text NOT NULL DEFAULT 'featured',
  sort_order int NOT NULL DEFAULT 100,
  featured boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','soon','testing','live','paused')),
  card_type text NOT NULL DEFAULT 'alert' CHECK (card_type IN ('alert','business')),
  tagline text NOT NULL DEFAULT '',
  bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
  schedule_label text NOT NULL DEFAULT '',
  daily_at text CHECK (daily_at IS NULL OR daily_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  price text NOT NULL DEFAULT 'free' CHECK (price IN ('free','paid','business')),
  scope_type text NOT NULL DEFAULT 'city' CHECK (scope_type IN ('city','route','national')),
  languages text[] NOT NULL DEFAULT ARRAY['en','ur'],
  signals text[] NOT NULL DEFAULT ARRAY[]::text[],
  urgent_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  template text NOT NULL DEFAULT '',
  sponsor text,
  cooldown_hours int NOT NULL DEFAULT 6 CHECK (cooldown_hours BETWEEN 1 AND 72),
  max_per_day int NOT NULL DEFAULT 2 CHECK (max_per_day BETWEEN 1 AND 6),
  cta_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS satify.subscribers (
  id bigserial PRIMARY KEY,
  phone text NOT NULL UNIQUE CHECK (phone ~ '^[0-9]{8,15}$'),
  language text NOT NULL DEFAULT 'en',
  last_inbound_at timestamptz,
  opted_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS satify.subscriptions (
  id bigserial PRIMARY KEY,
  subscriber_id bigint NOT NULL REFERENCES satify.subscribers(id) ON DELETE CASCADE,
  pack_slug text NOT NULL REFERENCES satify.packs(slug) ON UPDATE CASCADE ON DELETE CASCADE,
  scope text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscriber_id, pack_slug, scope)
);
CREATE INDEX IF NOT EXISTS satify_subs_pack ON satify.subscriptions(pack_slug, scope) WHERE active;

-- One event = one message for one pack + scope. dedupe_key stops repeats.
CREATE TABLE IF NOT EXISTS satify.events (
  id bigserial PRIMARY KEY,
  pack_slug text NOT NULL,
  scope text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('daily','urgent','test')),
  dedupe_key text NOT NULL UNIQUE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS satify.deliveries (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES satify.events(id) ON DELETE CASCADE,
  subscriber_id bigint REFERENCES satify.subscribers(id) ON DELETE SET NULL,
  phone_tail text,
  status text NOT NULL CHECK (status IN ('queued','sent','dry_run','failed','skipped')),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS satify_deliveries_recent ON satify.deliveries(created_at DESC);

-- Why a pack did not send (missing or stale data). Shown in the admin overview.
CREATE TABLE IF NOT EXISTS satify.engine_notes (
  id bigserial PRIMARY KEY,
  pack_slug text NOT NULL,
  scope text NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS satify_engine_notes_recent ON satify.engine_notes(created_at DESC);

-- "Notify me" on coming-soon packs.
CREATE TABLE IF NOT EXISTS satify.interest (
  id bigserial PRIMARY KEY,
  pack_slug text NOT NULL,
  contact text NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_slug, contact)
);

CREATE TABLE IF NOT EXISTS satify.school_registrations (
  id bigserial PRIMARY KEY,
  school_name text NOT NULL,
  city text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text,
  parents_estimate int,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','active','declined')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO satify.sources(id,label,kind,min_minutes) VALUES
 ('metar','aviationweather.gov airport observations (METAR)','visibility',30),
 ('fx_sbp','Frankfurter: State Bank of Pakistan rate','fx',360),
 ('fx_erapi','open.er-api.com exchange rates (backup)','fx',360),
 ('gold_xaus','xaus.com gold spot','gold',30),
 ('derived','Satify calculations (closure chance, fog, motorway)','derived',15)
ON CONFLICT (id) DO NOTHING;

-- Main PCI hub: register Satify as its own category so its readings sit next to everything else.
DO $$ BEGIN
 IF to_regclass('public.ingest_sources') IS NOT NULL THEN
  INSERT INTO ingest_sources(id,platform,method,enabled,category,expected_hours,label)
  VALUES ('satify.api','satify','api',true,'satify',2,'Satify Hub signals')
  ON CONFLICT (id) DO NOTHING;
 END IF;
EXCEPTION WHEN others THEN NULL; END $$;
