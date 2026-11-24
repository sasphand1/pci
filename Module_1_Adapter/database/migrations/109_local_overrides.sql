-- Hand-curated restaurants: "pick" shows in the Our picks row, "hide" removes a place from the automatic list.
CREATE TABLE IF NOT EXISTS local_place_overrides (
  place_id text PRIMARY KEY,
  city text NOT NULL CHECK (city IN ('karachi','lahore','islamabad')),
  mode text NOT NULL CHECK (mode IN ('pick','hide')),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  name text NOT NULL,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS local_place_overrides_city_idx ON local_place_overrides (city, mode);
