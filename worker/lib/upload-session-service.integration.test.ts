// @vitest-environment node

import { readFileSync } from 'node:fs';
import { Miniflare } from 'miniflare';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import type {
  AppendPhotoSessionRequest,
  UploadSessionFileStatus,
  Visibility,
} from '../../shared/contracts';
import type { Env, OwnerIdentity } from '../env';
import {
  abandonUploadSession,
  confirmUploadSession,
  createUploadSession,
  readUploadSession,
} from './upload-session-service';

const schema = readFileSync('database/schema.sql', 'utf8');

const owner: OwnerIdentity = {
  userId: 'user-owner',
  email: 'owner@example.com',
  displayName: 'Owner',
};

const otherOwner: OwnerIdentity = {
  userId: 'user-other',
  email: 'other@example.com',
  displayName: 'Other',
};

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
    d1Databases: { DB: '00000000-0000-0000-0000-000000000001' },
    r2Buckets: ['MEDIA'],
  });

  db = await mf.getD1Database('DB') as unknown as D1Database;
  media = await mf.getR2Bucket('MEDIA') as unknown as R2Bucket;
  env = {
    DB: db,
    MEDIA: media,
  } as Env;

  await applyTestSchema(db, schema);
  await insertOwner(owner);
  await insertOwner(otherOwner);
});

afterEach(async () => {
  await mf.dispose();
});

async function applyTestSchema(
  database: D1Database,
  sql: string,
): Promise<void> {
  const statements = sql
    .replace(/^\uFEFF/, '')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter(
      (statement) =>
        !/^PRAGMA\s+foreign_keys\s*=/i.test(statement),
    );

  for (const statement of statements) {
    await database.prepare(statement).run();
  }
}
describe('upload Session service with real D1 and R2 bindings', () => {
  it('enforces one active Append Session per Memory', async () => {
    await insertMemory('memory-one-active');

    const request = appendRequest(
      'memory-one-active',
      'photo-a',
      hash(1),
    );

    await createUploadSession(
      env,
      owner,
      request,
      'request-first',
    );

    await expect(
      createUploadSession(
        env,
        owner,
        {
          ...request,
          files: [
            {
              ...request.files[0]!,
              resumeFingerprint: hash(2),
              contentHash: hash(3),
              filename: 'photo-b.jpg',
            },
          ],
        },
        'request-second',
      ),
    ).rejects.toMatchObject({
      status: 409,
    });
  });

  it('hides another Owner Session as not found', async () => {
    await insertMemory('memory-owner-scope');

    const session = await createUploadSession(
      env,
      owner,
      appendRequest(
        'memory-owner-scope',
        'owner-only',
        hash(10),
      ),
      'request-owner',
    );

    await expect(
      readUploadSession(
        env,
        otherOwner,
        session.id,
      ),
    ).rejects.toMatchObject({
      status: 404,
    });
  });

  it('confirms a Create Session into a new Memory atomically', async () => {
    const sessionId = 'session-create';
    const fileId = 'session-create-file';
    const objectKey =
      `originals/${owner.userId}/${sessionId}/${fileId}.jpg`;

    await insertCreateReviewSession({
      sessionId,
      fileId,
      objectKey,
      targetVisibility: 'public',
    });
    await putPhoto(objectKey);

    const memory = await confirmUploadSession(
      env,
      owner,
      sessionId,
      'request-create-confirm',
    );

    expect(memory.title).toBe('Create Test');
    expect(memory.assets).toHaveLength(1);
    expect(memory.assets[0]).toMatchObject({
      filename: 'create.jpg',
      visibility: 'public',
      sortOrder: 0,
    });

    const session = await db.prepare(`
      SELECT memory_id, session_status
      FROM upload_sessions
      WHERE id = ?
    `)
      .bind(sessionId)
      .first<{
        memory_id: string;
        session_status: string;
      }>();

    expect(session).toEqual({
      memory_id: memory.id,
      session_status: 'completed',
    });
  });

  it('appends in review order without changing old sort orders', async () => {
    const memoryId = 'memory-order';
    await insertMemory(memoryId);
    await insertFinalizedAsset({
      id: 'old-a',
      memoryId,
      objectKey: 'originals/user-owner/existing/old-a.jpg',
      filename: 'old-a.jpg',
      sortOrder: 0,
      visibility: 'public',
    });
    await insertFinalizedAsset({
      id: 'old-b',
      memoryId,
      objectKey: 'originals/user-owner/existing/old-b.jpg',
      filename: 'old-b.jpg',
      sortOrder: 1,
      visibility: 'public',
    });

    const sessionId = 'session-order';
    const firstFileId = 'new-private-first';
    const laterFileId = 'new-public-later';
    const firstKey =
      `originals/${owner.userId}/${sessionId}/${firstFileId}.jpg`;
    const laterKey =
      `originals/${owner.userId}/${sessionId}/${laterFileId}.jpg`;

    await insertAppendReviewSession({
      sessionId,
      memoryId,
      proposedCoverSessionFileId: firstFileId,
      files: [
        {
          id: laterFileId,
          objectKey: laterKey,
          filename: 'later.jpg',
          reviewSortOrder: 1,
          targetVisibility: 'public',
          contentHash: hash(21),
        },
        {
          id: firstFileId,
          objectKey: firstKey,
          filename: 'first-private.jpg',
          reviewSortOrder: 0,
          targetVisibility: 'private',
          contentHash: hash(22),
        },
      ],
    });

    await putPhoto(firstKey);
    await putPhoto(laterKey);

    const memory = await confirmUploadSession(
      env,
      owner,
      sessionId,
      'request-append-confirm',
    );

    const rows = await db.prepare(`
      SELECT id, original_filename, sort_order, visibility
      FROM media_assets
      WHERE memory_id = ?
      ORDER BY sort_order ASC, id ASC
    `)
      .bind(memoryId)
      .all<{
        id: string;
        original_filename: string;
        sort_order: number;
        visibility: Visibility;
      }>();

    expect(
      rows.results.map((row) => ({
        filename: row.original_filename,
        sortOrder: row.sort_order,
        visibility: row.visibility,
      })),
    ).toEqual([
      {
        filename: 'old-a.jpg',
        sortOrder: 0,
        visibility: 'public',
      },
      {
        filename: 'old-b.jpg',
        sortOrder: 1,
        visibility: 'public',
      },
      {
        filename: 'first-private.jpg',
        sortOrder: 2,
        visibility: 'private',
      },
      {
        filename: 'later.jpg',
        sortOrder: 3,
        visibility: 'public',
      },
    ]);

    const privateCover = rows.results.find(
      (row) => row.original_filename === 'first-private.jpg',
    );
    expect(memory.coverAssetId).toBe(privateCover?.id);
  });

  it('rolls back every Asset when a later insert conflicts', async () => {
    const memoryId = 'memory-rollback';
    const oldCoverId = 'rollback-old-cover';
    const conflictKey =
      `originals/${owner.userId}/session-rollback/conflict.jpg`;

    await insertMemory(memoryId, oldCoverId);
    await insertFinalizedAsset({
      id: oldCoverId,
      memoryId,
      objectKey: conflictKey,
      filename: 'existing.jpg',
      sortOrder: 0,
      visibility: 'public',
    });

    const sessionId = 'session-rollback';
    const newKey =
      `originals/${owner.userId}/${sessionId}/new.jpg`;

    await insertAppendReviewSession({
      sessionId,
      memoryId,
      proposedCoverSessionFileId: null,
      files: [
        {
          id: 'new-safe',
          objectKey: newKey,
          filename: 'new-safe.jpg',
          reviewSortOrder: 0,
          targetVisibility: 'private',
          contentHash: hash(31),
        },
        {
          id: 'new-conflict',
          objectKey: conflictKey,
          filename: 'new-conflict.jpg',
          reviewSortOrder: 1,
          targetVisibility: 'private',
          contentHash: hash(32),
        },
      ],
    });

    await putPhoto(newKey);
    await putPhoto(conflictKey);

    await expect(
      confirmUploadSession(
        env,
        owner,
        sessionId,
        'request-rollback',
      ),
    ).rejects.toBeTruthy();

    const count = await scalar(
      'SELECT COUNT(*) AS value FROM media_assets WHERE memory_id = ?',
      memoryId,
    );
    const memory = await db.prepare(`
      SELECT cover_asset_id
      FROM memories
      WHERE id = ?
    `)
      .bind(memoryId)
      .first<{ cover_asset_id: string }>();
    const session = await db.prepare(`
      SELECT session_status
      FROM upload_sessions
      WHERE id = ?
    `)
      .bind(sessionId)
      .first<{ session_status: string }>();

    expect(count).toBe(1);
    expect(memory?.cover_asset_id).toBe(oldCoverId);
    expect(session?.session_status).toBe('review');
  });

  it('rejects the one thousand and first finalized Asset', async () => {
    const memoryId = 'memory-capacity';
    await insertMemory(memoryId, 'capacity-0');

    await db.prepare(`
      WITH RECURSIVE sequence(value) AS (
        SELECT 0
        UNION ALL
        SELECT value + 1
        FROM sequence
        WHERE value < 999
      )
      INSERT INTO media_assets (
        id,
        memory_id,
        media_type,
        object_key,
        original_filename,
        mime_type,
        size_bytes,
        sort_order,
        visibility,
        content_hash,
        hash_version
      )
      SELECT
        printf('capacity-%d', value),
        ?,
        'image',
        printf('originals/user-owner/capacity/%d.jpg', value),
        printf('%d.jpg', value),
        'image/jpeg',
        3,
        value,
        'private',
        printf('%064x', value + 1),
        1
      FROM sequence
    `)
      .bind(memoryId)
      .run();

    const sessionId = 'session-capacity';
    const fileId = 'capacity-new';
    const objectKey =
      `originals/${owner.userId}/${sessionId}/${fileId}.jpg`;

    await insertAppendReviewSession({
      sessionId,
      memoryId,
      proposedCoverSessionFileId: null,
      files: [
        {
          id: fileId,
          objectKey,
          filename: 'one-too-many.jpg',
          reviewSortOrder: 0,
          targetVisibility: 'private',
          contentHash: hash(9001),
        },
      ],
    });
    await putPhoto(objectKey);

    await expect(
      confirmUploadSession(
        env,
        owner,
        sessionId,
        'request-capacity',
      ),
    ).rejects.toMatchObject({
      status: 409,
    });

    expect(
      await scalar(
        'SELECT COUNT(*) AS value FROM media_assets WHERE memory_id = ?',
        memoryId,
      ),
    ).toBe(1000);
  });

  it('abandons only the current Session and its R2 objects', async () => {
    const memoryId = 'memory-abandon';
    await insertMemory(memoryId, 'old-abandon');
    await insertFinalizedAsset({
      id: 'old-abandon',
      memoryId,
      objectKey: 'originals/user-owner/existing/old-abandon.jpg',
      filename: 'old-abandon.jpg',
      sortOrder: 0,
      visibility: 'public',
    });

    const sessionId = 'session-abandon';
    const sessionFileId = 'session-abandon-file';
    const sessionKey =
      `originals/${owner.userId}/${sessionId}/${sessionFileId}.jpg`;

    await insertAppendUploadingSession({
      sessionId,
      memoryId,
      fileId: sessionFileId,
      objectKey: sessionKey,
    });
    await putPhoto(sessionKey);

    await abandonUploadSession(
      env,
      owner,
      sessionId,
      'request-abandon',
    );

    expect(
      await scalar(
        'SELECT COUNT(*) AS value FROM upload_sessions WHERE id = ?',
        sessionId,
      ),
    ).toBe(0);
    expect(
      await scalar(
        'SELECT COUNT(*) AS value FROM memories WHERE id = ?',
        memoryId,
      ),
    ).toBe(1);
    expect(
      await scalar(
        'SELECT COUNT(*) AS value FROM media_assets WHERE memory_id = ?',
        memoryId,
      ),
    ).toBe(1);
    expect(await media.head(sessionKey)).toBeNull();
  });
});

function appendRequest(
  memoryId: string,
  label: string,
  contentHash: string,
): AppendPhotoSessionRequest {
  return {
    sessionKind: 'append',
    memoryId,
    files: [
      {
        resumeFingerprint: hash(contentHash.charCodeAt(0) + 100),
        contentHash,
        occurrenceIndex: 0,
        filename: `${label}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 3,
        originalSortOrder: 0,
        targetVisibility: 'private',
      },
    ],
  };
}

async function insertOwner(identity: OwnerIdentity): Promise<void> {
  await db.prepare(`
    INSERT INTO owners (
      clerk_user_id,
      email,
      display_name
    ) VALUES (?, ?, ?)
  `)
    .bind(
      identity.userId,
      identity.email,
      identity.displayName,
    )
    .run();
}

async function insertMemory(
  memoryId: string,
  coverAssetId = `${memoryId}-cover`,
): Promise<void> {
  await db.prepare(`
    INSERT INTO memories (
      id,
      title,
      description,
      location,
      taken_at,
      category,
      visibility,
      is_featured,
      status,
      cover_asset_id,
      created_by
    ) VALUES (?, ?, '', 'New York', '2026-07-21', 'Travel', 'private', 0, 'published', ?, ?)
  `)
    .bind(
      memoryId,
      `Memory ${memoryId}`,
      coverAssetId,
      owner.userId,
    )
    .run();
}

async function insertFinalizedAsset(input: {
  id: string;
  memoryId: string;
  objectKey: string;
  filename: string;
  sortOrder: number;
  visibility: Visibility;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO media_assets (
      id,
      memory_id,
      media_type,
      object_key,
      original_filename,
      mime_type,
      size_bytes,
      sort_order,
      visibility,
      content_hash,
      hash_version
    ) VALUES (?, ?, 'image', ?, ?, 'image/jpeg', 3, ?, ?, ?, 1)
  `)
    .bind(
      input.id,
      input.memoryId,
      input.objectKey,
      input.filename,
      input.sortOrder,
      input.visibility,
      hash(input.sortOrder + 500),
    )
    .run();
}

async function insertCreateReviewSession(input: {
  sessionId: string;
  fileId: string;
  objectKey: string;
  targetVisibility: Visibility;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO upload_sessions (
      id,
      owner_id,
      session_kind,
      memory_id,
      title,
      description,
      location,
      taken_at,
      category,
      is_featured,
      target_memory_status,
      expected_file_count,
      completed_file_count,
      reserved_sort_start,
      proposed_cover_session_file_id,
      session_status,
      expires_at
    ) VALUES (?, ?, 'create', NULL, 'Create Test', '', 'New York', '2026-07-21', 'Travel', 0, 'published', 1, 1, 0, ?, 'review', '2026-07-28T00:00:00.000Z')
  `)
    .bind(
      input.sessionId,
      owner.userId,
      input.fileId,
    )
    .run();

  await insertSessionFile({
    sessionId: input.sessionId,
    id: input.fileId,
    objectKey: input.objectKey,
    filename: 'create.jpg',
    reviewSortOrder: 0,
    targetVisibility: input.targetVisibility,
    contentHash: hash(1000),
    status: 'uploaded',
  });
}

async function insertAppendReviewSession(input: {
  sessionId: string;
  memoryId: string;
  proposedCoverSessionFileId: string | null;
  files: Array<{
    id: string;
    objectKey: string;
    filename: string;
    reviewSortOrder: number;
    targetVisibility: Visibility;
    contentHash: string;
  }>;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO upload_sessions (
      id,
      owner_id,
      session_kind,
      memory_id,
      description,
      target_memory_status,
      expected_file_count,
      completed_file_count,
      reserved_sort_start,
      proposed_cover_session_file_id,
      session_status,
      expires_at
    ) VALUES (?, ?, 'append', ?, '', 'published', ?, ?, 0, ?, 'review', '2026-07-28T00:00:00.000Z')
  `)
    .bind(
      input.sessionId,
      owner.userId,
      input.memoryId,
      input.files.length,
      input.files.length,
      input.proposedCoverSessionFileId,
    )
    .run();

  for (const [index, file] of input.files.entries()) {
    await insertSessionFile({
      sessionId: input.sessionId,
      id: file.id,
      objectKey: file.objectKey,
      filename: file.filename,
      reviewSortOrder: file.reviewSortOrder,
      targetVisibility: file.targetVisibility,
      contentHash: file.contentHash,
      status: 'uploaded',
      originalSortOrder: index,
    });
  }
}

async function insertAppendUploadingSession(input: {
  sessionId: string;
  memoryId: string;
  fileId: string;
  objectKey: string;
}): Promise<void> {
  await db.prepare(`
    INSERT INTO upload_sessions (
      id,
      owner_id,
      session_kind,
      memory_id,
      description,
      target_memory_status,
      expected_file_count,
      completed_file_count,
      reserved_sort_start,
      session_status,
      expires_at
    ) VALUES (?, ?, 'append', ?, '', 'published', 1, 0, 1, 'uploading', '2026-07-28T00:00:00.000Z')
  `)
    .bind(
      input.sessionId,
      owner.userId,
      input.memoryId,
    )
    .run();

  await insertSessionFile({
    sessionId: input.sessionId,
    id: input.fileId,
    objectKey: input.objectKey,
    filename: 'abandon.jpg',
    reviewSortOrder: 0,
    targetVisibility: 'private',
    contentHash: hash(2000),
    status: 'authorized',
  });
}

async function insertSessionFile(input: {
  sessionId: string;
  id: string;
  objectKey: string;
  filename: string;
  reviewSortOrder: number;
  targetVisibility: Visibility;
  contentHash: string;
  status: UploadSessionFileStatus;
  originalSortOrder?: number;
}): Promise<void> {
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
      file_status,
      last_error
    ) VALUES (?, ?, ?, ?, 1, 0, ?, 'image/jpeg', 3, ?, ?, ?, 0, ?, ?, NULL)
  `)
    .bind(
      input.id,
      input.sessionId,
      hash(input.id.length + 3000),
      input.contentHash,
      input.filename,
      input.originalSortOrder ?? input.reviewSortOrder,
      input.reviewSortOrder,
      input.targetVisibility,
      input.objectKey,
      input.status,
    )
    .run();
}

async function putPhoto(objectKey: string): Promise<void> {
  await media.put(
    objectKey,
    new Uint8Array([1, 2, 3]),
    {
      httpMetadata: {
        contentType: 'image/jpeg',
      },
    },
  );
}

async function scalar(
  sql: string,
  ...bindings: unknown[]
): Promise<number> {
  const row = await db.prepare(sql)
    .bind(...bindings)
    .first<{ value: number }>();
  return Number(row?.value ?? 0);
}

function hash(value: number | string): string {
  const numeric = typeof value === 'number'
    ? value
    : [...value].reduce(
        (total, character) => total + character.charCodeAt(0),
        0,
      );
  return numeric.toString(16).padStart(64, '0').slice(-64);
}