ALTER TABLE restaurant_image_http_state ADD COLUMN IF NOT EXISTS worker_version integer NOT NULL DEFAULT 4;
