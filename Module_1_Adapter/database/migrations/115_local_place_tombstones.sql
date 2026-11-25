-- Retain only an identifier to prevent a permanently deleted place from being recollected.
CREATE TABLE IF NOT EXISTS local_place_tombstones (place_id text PRIMARY KEY);
