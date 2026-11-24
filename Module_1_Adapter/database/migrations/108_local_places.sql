-- Local places (restaurants) per city, collected from Google Places. Ratings are kept as last seen with their date.
CREATE TABLE IF NOT EXISTS local_places (
  place_id text PRIMARY KEY,
  city text NOT NULL CHECK (city IN ('karachi','lahore','islamabad')),
  name text NOT NULL,
  address text,
  area text,
  rating numeric(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_count integer NOT NULL CHECK (review_count >= 0),
  score numeric(4,3) NOT NULL,
  maps_url text,
  business_status text,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS local_places_city_score_idx ON local_places (city, score DESC);
CREATE TABLE IF NOT EXISTS local_place_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  requests integer NOT NULL DEFAULT 0,
  found integer NOT NULL DEFAULT 0,
  kept integer NOT NULL DEFAULT 0,
  result text NOT NULL DEFAULT 'running'
);
