PRAGMA foreign_keys = ON;

ALTER TABLE media_assets ADD COLUMN content_hash TEXT;
ALTER TABLE media_assets ADD COLUMN hash_version INTEGER NOT NULL DEFAULT 1;

CREATE INDEX idx_assets_memory_content_hash
  ON media_assets(memory_id, content_hash);

CREATE TABLE upload_sessions (
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

CREATE TABLE upload_session_files (
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

CREATE UNIQUE INDEX idx_upload_session_file_identity
  ON upload_session_files(
    upload_session_id,
    resume_fingerprint,
    occurrence_index
  );

CREATE INDEX idx_upload_sessions_owner_status
  ON upload_sessions(owner_id, session_status, updated_at DESC);

CREATE INDEX idx_upload_session_files_session_status_sort
  ON upload_session_files(
    upload_session_id,
    file_status,
    review_sort_order,
    id
  );

CREATE UNIQUE INDEX idx_one_active_append_session_per_memory
  ON upload_sessions(memory_id)
  WHERE session_kind = 'append'
    AND session_status IN ('uploading', 'review');