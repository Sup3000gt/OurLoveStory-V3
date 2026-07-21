import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  UploadSession,
  UploadSessionFile,
} from '../../shared/contracts';
import {
  buildSessionPhotoLookup,
  hasLocalSession,
} from './PhotoSessionUploadContext';
import {
  bindSelectedPhotos,
  toSessionUploadPhotos,
  type SelectedPhoto,
} from '../hooks/usePhotoSessionUpload';

function selected(
  sessionFileId: string | null,
  status: SelectedPhoto['status'] = 'pending',
): SelectedPhoto {
  return {
    localId: crypto.randomUUID(),
    file: new File(
      ['photo'],
      'photo.jpg',
      {
        type: 'image/jpeg',
      },
    ),
    previewUrl:
      `blob:${sessionFileId ?? 'local'}`,
    resumeFingerprint:
      'a'.repeat(64),
    contentHash:
      'b'.repeat(64),
    occurrenceIndex: 0,
    targetVisibility: 'private',
    sessionFileId,
    status,
    allowDuplicate: false,
    message: '',
  };
}

function serverFile(
  id: string,
  status: UploadSessionFile['status'],
): UploadSessionFile {
  return {
    id,
    resumeFingerprint: 'a'.repeat(64),
    contentHash: 'b'.repeat(64),
    occurrenceIndex: 0,
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 5,
    originalSortOrder: 0,
    reviewSortOrder: 0,
    targetVisibility: 'private',
    allowDuplicate: false,
    objectKey:
      status === 'uploaded'
        ? `originals/${id}`
        : null,
    status,
    lastError: null,
  };
}

function uploadSession(
  file: UploadSessionFile,
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
    expectedFileCount: 1,
    completedFileCount:
      file.status === 'uploaded'
        || file.status === 'skipped'
        ? 1
        : 0,
    reservedSortStart: 10,
    proposedCoverSessionFileId: null,
    status:
      file.status === 'uploaded'
        || file.status === 'skipped'
        ? 'review'
        : 'uploading',
    expiresAt: '',
    createdAt: '',
    updatedAt: '',
    files: [file],
  };
}

describe('Photo Session context helpers', () => {
  it('recognizes only the local active Session', () => {
    expect(
      hasLocalSession(
        { id: 'session-a' },
        'session-a',
      ),
    ).toBe(true);

    expect(
      hasLocalSession(
        { id: 'session-a' },
        'session-b',
      ),
    ).toBe(false);

    expect(
      hasLocalSession(
        null,
        'session-a',
      ),
    ).toBe(false);
  });

  it('indexes local previews by Session file ID', () => {
    const lookup =
      buildSessionPhotoLookup([
        selected('file-a'),
        selected(null),
        selected('file-b'),
      ]);

    expect(
      [...lookup.keys()],
    ).toEqual([
      'file-a',
      'file-b',
    ]);
  });

  it('binds a local preview to the server Session file', () => {
    const local = selected(null);
    const bound = bindSelectedPhotos(
      [local],
      uploadSession(
        serverFile(
          'server-a',
          'uploaded',
        ),
      ),
    );

    expect(bound[0]).toMatchObject({
      localId: local.localId,
      previewUrl: local.previewUrl,
      sessionFileId: 'server-a',
      status: 'uploaded',
    });
  });

  it('maps server-complete photos without changing their status', () => {
    const photos = [
      selected('uploaded', 'uploaded'),
      selected('skipped', 'skipped'),
      selected('pending', 'pending'),
    ];

    expect(
      toSessionUploadPhotos(photos)
        .map((photo) => photo.status),
    ).toEqual([
      'uploaded',
      'skipped',
      'pending',
    ]);
  });
});