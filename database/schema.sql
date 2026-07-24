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
  category TEXT NOT NULL CHECK (
    category IN (
      'Travel',
      'Daily Life',
      'Homemade Food',
      'Dining Out',
      'Special Moments'
    )
  ),
  visibility TEXT NOT NULL CHECK (visibility IN ('public','private')),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft','published')),
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
  visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (visibility IN ('public','private')),
  content_hash TEXT,
  hash_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS upload_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  session_kind TEXT NOT NULL
    CHECK (session_kind IN ('create', 'append')),
  memory_id TEXT,
  title TEXT,
  description TEXT NOT NULL DEFAULT '',
  location TEXT,
  taken_at TEXT,
  category TEXT,
  is_featured INTEGER NOT NULL DEFAULT 0
    CHECK (is_featured IN (0, 1)),
  target_memory_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (target_memory_status IN ('draft', 'published')),
  expected_file_count INTEGER NOT NULL
    CHECK (expected_file_count BETWEEN 1 AND 100),
  completed_file_count INTEGER NOT NULL DEFAULT 0
    CHECK (
      completed_file_count >= 0
      AND completed_file_count <= expected_file_count
    ),
  reserved_sort_start INTEGER,
  proposed_cover_session_file_id TEXT,
  session_status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (session_status IN ('uploading', 'review', 'completed', 'abandoned')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES owners(clerk_user_id),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  CHECK (
    (session_kind = 'append' AND memory_id IS NOT NULL)
    OR (
      session_kind = 'create'
      AND (
        (session_status = 'completed' AND memory_id IS NOT NULL)
        OR (session_status != 'completed' AND memory_id IS NULL)
      )
    )
  )
);

CREATE TABLE IF NOT EXISTS upload_session_files (
  id TEXT PRIMARY KEY,
  upload_session_id TEXT NOT NULL,
  resume_fingerprint TEXT NOT NULL,
  content_hash TEXT,
  hash_version INTEGER NOT NULL DEFAULT 1,
  occurrence_index INTEGER NOT NULL DEFAULT 0
    CHECK (occurrence_index >= 0),
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  width INTEGER CHECK (width IS NULL OR width > 0),
  height INTEGER CHECK (height IS NULL OR height > 0),
  original_sort_order INTEGER NOT NULL
    CHECK (original_sort_order BETWEEN 0 AND 99),
  review_sort_order INTEGER NOT NULL
    CHECK (review_sort_order BETWEEN 0 AND 99),
  target_visibility TEXT NOT NULL DEFAULT 'private'
    CHECK (target_visibility IN ('public', 'private')),
  allow_duplicate INTEGER NOT NULL DEFAULT 0
    CHECK (allow_duplicate IN (0, 1)),
  object_key TEXT UNIQUE,
  file_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (file_status IN (
      'pending',
      'authorized',
      'uploading',
      'uploaded',
      'failed',
      'skipped'
    )),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (upload_session_id)
    REFERENCES upload_sessions(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timeline_covers (
  id TEXT PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('year', 'month')),
  period_key TEXT NOT NULL,
  memory_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (period_type, period_key),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES owners(clerk_user_id)
);

CREATE INDEX IF NOT EXISTS idx_memories_status_visibility_date
  ON memories(status, visibility, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_featured_date
  ON memories(is_featured, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_memory_sort
  ON media_assets(memory_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_assets_memory_visibility_sort
  ON media_assets(memory_id, visibility, sort_order);
CREATE INDEX IF NOT EXISTS idx_assets_memory_content_hash
  ON media_assets(memory_id, content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_upload_session_file_identity
  ON upload_session_files(
    upload_session_id,
    resume_fingerprint,
    occurrence_index
  );
CREATE INDEX IF NOT EXISTS idx_upload_sessions_owner_status
  ON upload_sessions(owner_id, session_status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_upload_session_files_session_status_sort
  ON upload_session_files(
    upload_session_id,
    file_status,
    review_sort_order,
    id
  );
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_append_session_per_memory
  ON upload_sessions(memory_id)
  WHERE session_kind = 'append'
    AND session_status IN ('uploading', 'review');
CREATE INDEX IF NOT EXISTS idx_timeline_covers_period
  ON timeline_covers(period_type, period_key);
