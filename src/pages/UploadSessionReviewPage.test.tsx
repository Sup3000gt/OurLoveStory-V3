import {
  describe,
  expect,
  it,
} from 'vitest';
import type {
  UploadSession,
} from '../../shared/contracts';
import {
  reviewRecoveryMode,
  reviewPreviewUrl,
} from './UploadSessionReviewPage';

function session(
  status:
    UploadSession['status'],
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
      status === 'review'
        ? 1
        : 0,
    reservedSortStart: 10,
    proposedCoverSessionFileId: null,
    status,
    expiresAt: '',
    createdAt: '',
    updatedAt: '',
    files: [
      {
        id: 'file-a',
        resumeFingerprint:
          'a'.repeat(64),
        contentHash:
          'b'.repeat(64),
        occurrenceIndex: 0,
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        originalSortOrder: 0,
        reviewSortOrder: 0,
        targetVisibility: 'private',
        allowDuplicate: false,
        objectKey:
          status === 'review'
            ? 'originals/photo.jpg'
            : null,
        status:
          status === 'review'
            ? 'uploaded'
            : 'pending',
        lastError: null,
      },
    ],
  };
}

describe('reviewRecoveryMode', () => {
  it('requests original files when upload is incomplete and local files are absent', () => {
    expect(
      reviewRecoveryMode(
        session('uploading'),
        false,
      ),
    ).toBe('reselect');
  });

  it('allows review without local previews when server upload is complete', () => {
    expect(
      reviewRecoveryMode(
        session('review'),
        false,
      ),
    ).toBe('review');
  });

  it('allows retry when local files are still present', () => {
    expect(
      reviewRecoveryMode(
        session('uploading'),
        true,
      ),
    ).toBe('retry');
  });
});

describe('reviewPreviewUrl', () => {
  it('prefers a local Blob URL over the persisted Session Thumbnail', () => {
    expect(
      reviewPreviewUrl(
        'session/a',
        'file ? ',
        'uploaded',
        'blob:http://local-preview',
      ),
    ).toBe('blob:http://local-preview');
  });

  it('uses the encoded Session Thumbnail URL for uploaded files without a local Blob', () => {
    expect(
      reviewPreviewUrl(
        'session/a',
        'file ? ',
        'uploaded',
        null,
      ),
    ).toBe(
      '/api/upload-sessions/session%2Fa/files/file%20%3F%20/thumbnail',
    );
  });

  it.each([
    'pending',
    'authorized',
    'uploading',
    'failed',
    'skipped',
  ] as const)('returns no preview for %s files without a local Blob', (status) => {
    expect(
      reviewPreviewUrl(
        'session-a',
        'file-a',
        status,
        null,
      ),
    ).toBeNull();
  });
});
