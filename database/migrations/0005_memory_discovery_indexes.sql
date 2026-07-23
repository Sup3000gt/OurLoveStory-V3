CREATE INDEX IF NOT EXISTS idx_memories_date_cursor
  ON memories(taken_at DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_memories_category_date_cursor
  ON memories(category, taken_at DESC, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_memories_status_date_cursor
  ON memories(status, taken_at DESC, created_at DESC, id DESC);
