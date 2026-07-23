PRAGMA foreign_keys = ON;

CREATE TABLE timeline_covers (
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

CREATE INDEX idx_timeline_covers_period
  ON timeline_covers(period_type, period_key);
