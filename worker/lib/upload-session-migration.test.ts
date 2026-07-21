import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'database/migrations/0003_upload_sessions_and_asset_hashes.sql',
  'utf8',
);

describe('upload session Migration', () => {
  it('requires Append Sessions to bind a Memory', () => {
    expect(migration).toContain(
      "session_kind = 'append' AND memory_id IS NOT NULL",
    );
  });

  it('allows Create Sessions to receive a Memory only at completion', () => {
    expect(migration).toContain(
      "session_status = 'completed' AND memory_id IS NOT NULL",
    );
    expect(migration).toContain(
      "session_status != 'completed' AND memory_id IS NULL",
    );
  });

  it('enforces one active Append Session per Memory', () => {
    expect(migration).toContain(
      'idx_one_active_append_session_per_memory',
    );
    expect(migration).toContain(
      "session_status IN ('uploading', 'review')",
    );
  });
});