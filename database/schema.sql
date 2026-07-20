PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS owners (
  clerk_user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  taken_at TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Travel','Daily Life','Homemade Food','Dining Out','Special Moments')),
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published')),
  cover_asset_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES owners(clerk_user_id)
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image','video')),
  object_key TEXT NOT NULL UNIQUE,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_status_visibility_date
  ON memories(status, visibility, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_featured_date
  ON memories(is_featured, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_memory_sort
  ON media_assets(memory_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assets_memory_visibility_sort
  ON media_assets(memory_id, visibility, sort_order);
