import { describe, expect, it } from 'vitest';
import {
  assertOwnedObjectKey,
  mediaTypeForMime,
  sanitizeDownloadFilename,
  validateCreateMemoryRequest,
  validateUploadFiles,
} from './validation';

const validMemory = {
  title: 'Trip to Paris',
  location: 'Paris, France',
  date: '2024-06-02',
  category: 'Travel' as const,
  description: 'An unforgettable evening.',
  visibility: 'private' as const,
  featured: true,
  status: 'published' as const,
  coverObjectKey: 'originals/user_123/2026/asset.jpg',
  assets: [
    {
      objectKey: 'originals/user_123/2026/asset.jpg',
      originalFilename: 'IMG 1234.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      mediaType: 'image' as const,
      sortOrder: 0,
    },
  ],
};

describe('mediaTypeForMime', () => {
  it('recognizes supported photos and videos', () => {
    expect(mediaTypeForMime('image/jpeg')).toBe('image');
    expect(mediaTypeForMime('video/quicktime')).toBe('video');
  });

  it('rejects unsupported media', () => {
    expect(() => mediaTypeForMime('application/pdf')).toThrow('Unsupported media type');
  });
});

describe('validateUploadFiles', () => {
  it('accepts a valid mixed photo and video batch', () => {
    expect(
      validateUploadFiles([
        { filename: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 2_000_000 },
        { filename: 'clip.mp4', mimeType: 'video/mp4', sizeBytes: 20_000_000 },
      ]),
    ).toHaveLength(2);
  });

  it('rejects more than twenty assets', () => {
    const files = Array.from({ length: 21 }, (_, index) => ({
      filename: `${index}.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 100,
    }));
    expect(() => validateUploadFiles(files)).toThrow('up to 20');
  });

  it('rejects an oversized image', () => {
    expect(() =>
      validateUploadFiles([
        { filename: 'huge.jpg', mimeType: 'image/jpeg', sizeBytes: 51 * 1024 * 1024 },
      ]),
    ).toThrow('50 MiB');
  });
});

describe('validateCreateMemoryRequest', () => {
  it('accepts a complete memory and normalizes strings', () => {
    const result = validateCreateMemoryRequest({ ...validMemory, title: '  Trip to Paris  ' });
    expect(result.title).toBe('Trip to Paris');
  });

  it('requires the cover to belong to the uploaded assets', () => {
    expect(() =>
      validateCreateMemoryRequest({ ...validMemory, coverObjectKey: 'originals/user_123/other.jpg' }),
    ).toThrow('cover');
  });
});

describe('object ownership and filenames', () => {
  it('accepts only keys created for the authenticated owner', () => {
    expect(() => assertOwnedObjectKey('originals/user_123/2026/a.jpg', 'user_123')).not.toThrow();
    expect(() => assertOwnedObjectKey('originals/user_999/2026/a.jpg', 'user_123')).toThrow('owner');
  });

  it('produces a safe download filename', () => {
    expect(sanitizeDownloadFilename('../Paris night ❤️.jpg')).toBe('Paris-night.jpg');
  });
});
