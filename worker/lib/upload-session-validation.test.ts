import { describe, expect, it } from 'vitest';
import {
  validateAuthorizeSessionBatchRequest,
  validateCreateUploadSessionRequest,
  validateUpdateSessionFileRequest,
  validateUpdateSessionReviewRequest,
} from './upload-session-validation';

function photo(index: number) {
  return {
    resumeFingerprint: index.toString(16).padStart(64, '0'),
    contentHash: (index + 200).toString(16).padStart(64, '0'),
    occurrenceIndex: 0,
    filename: `photo-${index}.jpg`,
    mimeType: 'image/jpeg',
    sizeBytes: 2_000,
    originalSortOrder: index,
    targetVisibility: 'private' as const,
  };
}

describe('validateCreateUploadSessionRequest', () => {
  it('accepts one hundred create photos', () => {
    const result = validateCreateUploadSessionRequest({
      sessionKind: 'create',
      title: 'Trip',
      location: 'New York',
      date: '2026-07-21',
      category: 'Travel',
      description: '',
      featured: false,
      targetMemoryStatus: 'published',
      files: Array.from({ length: 100 }, (_, index) => photo(index)),
    });

    expect(result.files).toHaveLength(100);
  });

  it('accepts an append session bound to a Memory', () => {
    const result = validateCreateUploadSessionRequest({
      sessionKind: 'append',
      memoryId: 'memory-a',
      files: [photo(0)],
    });

    expect(result.sessionKind).toBe('append');
  });

  it('rejects one hundred and one photos', () => {
    expect(() =>
      validateCreateUploadSessionRequest({
        sessionKind: 'append',
        memoryId: 'memory-a',
        files: Array.from({ length: 101 }, (_, index) => photo(index)),
      }),
    ).toThrow('100');
  });

  it('rejects a video MIME type', () => {
    expect(() =>
      validateCreateUploadSessionRequest({
        sessionKind: 'append',
        memoryId: 'memory-a',
        files: [{ ...photo(0), mimeType: 'video/mp4' }],
      }),
    ).toThrow('photos only');
  });

  it('rejects a malformed SHA-256 hash', () => {
    expect(() =>
      validateCreateUploadSessionRequest({
        sessionKind: 'append',
        memoryId: 'memory-a',
        files: [{ ...photo(0), contentHash: 'not-a-hash' }],
      }),
    ).toThrow('SHA-256');
  });
});

describe('upload session endpoint payloads', () => {
  it('rejects authorization batches larger than twenty', () => {
    expect(() =>
      validateAuthorizeSessionBatchRequest({
        sessionFileIds: Array.from({ length: 21 }, (_, index) => `file-${index}`),
      }),
    ).toThrow('20');
  });

  it('accepts an explicit duplicate override', () => {
    expect(
      validateUpdateSessionFileRequest({
        allowDuplicate: true,
        skipped: false,
      }),
    ).toEqual({
      allowDuplicate: true,
      skipped: false,
    });
  });

  it('rejects duplicate review sort orders', () => {
    expect(() =>
      validateUpdateSessionReviewRequest({
        proposedCoverSessionFileId: null,
        files: [
          {
            sessionFileId: 'file-a',
            reviewSortOrder: 0,
            targetVisibility: 'private',
            allowDuplicate: false,
            skipped: false,
          },
          {
            sessionFileId: 'file-b',
            reviewSortOrder: 0,
            targetVisibility: 'public',
            allowDuplicate: false,
            skipped: false,
          },
        ],
      }),
    ).toThrow('unique');
  });
});