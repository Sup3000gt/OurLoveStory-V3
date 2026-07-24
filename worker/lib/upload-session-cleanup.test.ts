// @vitest-environment node

import {
  readFileSync,
} from 'node:fs';
import { Miniflare } from 'miniflare';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type { Env } from '../env';
import {
  sessionThumbnailKey,
} from './image-derivatives';
import {
  cleanupExpiredUploadSessions,
} from './upload-session-cleanup';

const schema = readFileSync(
  'database/schema.sql',
  'utf8',
);

let mf: Miniflare;
let db: D1Database;
let media: R2Bucket;
let env: Env;

beforeEach(async () => {
  mf = new Miniflare({
    modules: true,
    script: `
      export default {
        fetch() {
          return new Response("ok");
        }
      };
    `,
    d1Databases: {
      DB:
        '00000000-0000-0000-0000-000000000001',
    },
    r2Buckets: ['MEDIA'],
  });
  db =
    await mf.getD1Database(
      'DB',
    ) as unknown as D1Database;
  media =
    await mf.getR2Bucket(
      'MEDIA',
    ) as unknown as R2Bucket;
  env = {
    DB: db,
    MEDIA: media,
  } as Env;

  await applySchema(db);
  await db.prepare(`
    INSERT INTO owners (
      clerk_user_id,
      email,
      display_name
    ) VALUES (
      'owner-a',
      'owner@example.com',
      'Owner'
    )
  `).run();
});

afterEach(async () => {
  await mf.dispose();
});

describe('expired upload Session cleanup', () => {
  it('removes expired temporary objects and leaves active Sessions alone', async () => {
    await insertSession(
      'expired-session',
      '2026-07-20T00:00:00.000Z',
    );
    await insertSession(
      'active-session',
      '2026-07-30T00:00:00.000Z',
    );

    const originalKey =
      'originals/owner-a/expired-session/file.jpg';
    const thumbnailKey =
      sessionThumbnailKey(
        'expired-session',
        'expired-session-file',
      );
    await media.put(
      originalKey,
      new Uint8Array([1, 2, 3]),
    );
    await media.put(
      thumbnailKey,
      new Uint8Array([4, 5, 6]),
    );

    const result =
      await cleanupExpiredUploadSessions(
        env,
        {
          now: new Date(
            '2026-07-23T00:00:00.000Z',
          ),
          requestId: 'test-cleanup',
        },
      );

    expect(result).toEqual({
      scanned: 1,
      cleaned: 1,
      failed: 0,
    });
    expect(
      await sessionCount(
        'expired-session',
      ),
    ).toBe(0);
    expect(
      await sessionCount(
        'active-session',
      ),
    ).toBe(1);
    expect(
      await media.head(originalKey),
    ).toBeNull();
    expect(
      await media.head(thumbnailKey),
    ).toBeNull();
  });
});

async function applySchema(
  database: D1Database,
): Promise<void> {
  const statements = schema
    .replace(/^\uFEFF/, '')
    .split(';')
    .map((statement) =>
      statement.trim(),
    )
    .filter(Boolean)
    .filter(
      (statement) =>
        !/^PRAGMA\s+foreign_keys\s*=/i
          .test(statement),
    );

  for (const statement of statements) {
    await database.prepare(
      statement,
    ).run();
  }
}

async function insertSession(
  sessionId: string,
  expiresAt: string,
): Promise<void> {
  await db.prepare(`
    INSERT INTO upload_sessions (
      id,
      owner_id,
      session_kind,
      description,
      target_memory_status,
      expected_file_count,
      completed_file_count,
      session_status,
      expires_at
    ) VALUES (
      ?,
      'owner-a',
      'create',
      '',
      'published',
      1,
      0,
      'uploading',
      ?
    )
  `)
    .bind(sessionId, expiresAt)
    .run();

  await db.prepare(`
    INSERT INTO upload_session_files (
      id,
      upload_session_id,
      resume_fingerprint,
      content_hash,
      hash_version,
      occurrence_index,
      original_filename,
      mime_type,
      size_bytes,
      original_sort_order,
      review_sort_order,
      target_visibility,
      allow_duplicate,
      object_key,
      file_status
    ) VALUES (
      ?,
      ?,
      ?,
      ?,
      1,
      0,
      'file.jpg',
      'image/jpeg',
      3,
      0,
      0,
      'private',
      0,
      ?,
      'uploaded'
    )
  `)
    .bind(
      `${sessionId}-file`,
      sessionId,
      'a'.repeat(64),
      'b'.repeat(64),
      `originals/owner-a/${sessionId}/file.jpg`,
    )
    .run();
}

async function sessionCount(
  sessionId: string,
): Promise<number> {
  const row = await db.prepare(`
    SELECT COUNT(*) AS value
    FROM upload_sessions
    WHERE id = ?
  `)
    .bind(sessionId)
    .first<{ value: number }>();
  return Number(row?.value ?? 0);
}
