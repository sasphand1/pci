-- 125_progress_boards: shared state of the admin "Progress" boards (statuses, notes, edited text, added notes/arrows).
-- One row per board. version supports optimistic locking so two editors never silently overwrite each other.
CREATE TABLE IF NOT EXISTS progress_boards (
  slug text PRIMARY KEY,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progress_boards_slug_chk CHECK (slug ~ '^[a-z0-9-]{2,60}$')
);
