ALTER TABLE upload_session_files
  ADD COLUMN width INTEGER
  CHECK (width IS NULL OR width > 0);

ALTER TABLE upload_session_files
  ADD COLUMN height INTEGER
  CHECK (height IS NULL OR height > 0);
