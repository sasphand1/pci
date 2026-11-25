-- Independent HTTP photo job state. Cascades with restaurant deletion.
CREATE TABLE IF NOT EXISTS restaurant_image_http_state (
  place_id text PRIMARY KEY REFERENCES local_places(place_id) ON DELETE CASCADE,
  last_attempt_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('stored','refreshed','review','unavailable','failed','changed')),
  detail text NOT NULL DEFAULT ''
);
