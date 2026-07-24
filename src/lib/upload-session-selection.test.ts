import { describe, expect, it } from 'vitest';
import type {
  UploadSession,
  UploadSessionFile,
} from '../../shared/contracts';
import {
  bindLocalPhotosToSession,
  matchLocalPhotosToSession,
  pendingLocalPhotos,
  preparePhotoMetadata,
} from './upload-session-selection';

function sessionFile(
  id: string,
  fingerprint: string,
  occurrenceIndex: number,
  status: UploadSessionFile['status'],
): UploadSessionFile {
  return {
    id,
    resumeFingerprint: fingerprint,
    contentHash: id.padEnd(64, '0').slice(0, 64),
    occurrenceIndex,
    filename: 'same.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 4,
    originalSortOrder: occurrenceIndex,
    reviewSortOrder: occurrenceIndex,
    targetVisibility: 'private',
    allowDuplicate: false,
    objectKey: null,
    status,
    lastError: status === 'skipped' ? 'duplicate' : null,
  };
}

function uploadSession(
  files: UploadSessionFile[],
): UploadSession {
  return {
    id: 'session-a',
    kind: 'append',
    memoryId: 'memory-a',
    title: null,
    location: null,
    date: null,
    category: null,
    description: '',
    featured: false,
    targetMemoryStatus: 'published',
    expectedFileCount: files.length,
    completedFileCount: 0,
    reservedSortStart: 10,
    proposedCoverSessionFileId: null,
    status: 'uploading',
    expiresAt: '2026-07-28T00:00:00.000Z',
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
    files,
  };
}

describe('preparePhotoMetadata', () => {
  it('hashes files one at a time and keeps selection order', async () => {
    const calls: string[] = [];
    const files = [
      new File(['one'], 'one.jpg', {
        type: 'image/jpeg',
      }),
      new File(['two'], 'two.jpg', {
        type: 'image/jpeg',
      }),
    ];

    const prepared = await preparePhotoMetadata(
      files,
      {
        hash: async (file) => {
          calls.push(file.name);
          return file.name
            .charCodeAt(0)
            .toString(16)
            .padStart(64, '0');
        },
      },
      undefined,
      async (file) => ({
        width:
          file.name === 'one.jpg'
            ? 1600
            : 1200,
        height: 900,
      }),
    );

    expect(calls).toEqual(['one.jpg', 'two.jpg']);
    expect(prepared.map((item) => item.file.name)).toEqual([
      'one.jpg',
      'two.jpg',
    ]);
    expect(
      prepared.every(
        (item) => item.targetVisibility === 'private',
      ),
    ).toBe(true);
    expect(
      prepared.map((item) => [
        item.width,
        item.height,
      ]),
    ).toEqual([
      [1600, 900],
      [1200, 900],
    ]);
  });
});

describe('Session matching', () => {
  it('matches repeated fingerprints by occurrence index', () => {
    const local = [
      {
        localId: 'local-0',
        file: new File(['same'], 'same.jpg', {
          type: 'image/jpeg',
        }),
        resumeFingerprint: 'fingerprint',
        contentHash: 'a'.repeat(64),
        occurrenceIndex: 0,
        targetVisibility: 'private' as const,
        width: 1200,
        height: 800,
      },
      {
        localId: 'local-1',
        file: new File(['same'], 'same.jpg', {
          type: 'image/jpeg',
        }),
        resumeFingerprint: 'fingerprint',
        contentHash: 'a'.repeat(64),
        occurrenceIndex: 1,
        targetVisibility: 'private' as const,
        width: 1200,
        height: 800,
      },
    ];

    const serverFiles = [
      sessionFile(
        'server-0',
        'fingerprint',
        0,
        'uploaded',
      ),
      sessionFile(
        'server-1',
        'fingerprint',
        1,
        'pending',
      ),
    ];

    expect(
      matchLocalPhotosToSession(local, serverFiles),
    ).toEqual([
      {
        localId: 'local-0',
        sessionFileId: 'server-0',
      },
      {
        localId: 'local-1',
        sessionFileId: 'server-1',
      },
    ]);
  });

  it('does not schedule uploaded or skipped files', () => {
    const local = [
      {
        localId: 'local-0',
        file: new File(['same'], 'same.jpg', {
          type: 'image/jpeg',
        }),
        resumeFingerprint: 'fingerprint',
        contentHash: 'a'.repeat(64),
        occurrenceIndex: 0,
        targetVisibility: 'private' as const,
        width: 1200,
        height: 800,
      },
      {
        localId: 'local-1',
        file: new File(['same'], 'same.jpg', {
          type: 'image/jpeg',
        }),
        resumeFingerprint: 'fingerprint',
        contentHash: 'b'.repeat(64),
        occurrenceIndex: 1,
        targetVisibility: 'private' as const,
        width: 1200,
        height: 800,
      },
    ];

    const session = uploadSession([
      sessionFile(
        'server-0',
        'fingerprint',
        0,
        'uploaded',
      ),
      sessionFile(
        'server-1',
        'fingerprint',
        1,
        'skipped',
      ),
    ]);

    const bound = bindLocalPhotosToSession(local, session);

    expect(pendingLocalPhotos(bound)).toEqual([]);
    expect(bound.map((item) => item.status)).toEqual([
      'uploaded',
      'duplicate',
    ]);
  });
});
