PRAGMA foreign_keys = ON;

ALTER TABLE media_assets
ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'
CHECK (visibility IN ('public', 'private'));

UPDATE media_assets
SET visibility = (
  SELECT memories.visibility
  FROM memories
  WHERE memories.id = media_assets.memory_id
);

CREATE INDEX IF NOT EXISTS idx_assets_memory_visibility_sort
ON media_assets(memory_id, visibility, sort_order);
