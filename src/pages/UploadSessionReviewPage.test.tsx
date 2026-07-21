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