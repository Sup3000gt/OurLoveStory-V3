import { describe, expect, it } from 'vitest';
import type { ImageAsset, VideoAsset } from '../../shared/contracts';
import {
  appendRetryNonce,
  assetNormalDownloadUrl,
  isImageAsset,
  sessionThumbnailUrl,
} from './image-assets';

const image: ImageAsset = {
  id: 'asset/image 1',
  type: 'image',
  thumbnailUrl: '/api/assets/image/thumbnail',
  previewUrl: '/api/assets/image/preview',
  originalUrl: '/api/assets/image/original',
  filename: 'image.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 10,
  sortOrder: 0,
  visibility: 'private',
};

const guestImage = { ...image, originalUrl: null };
const video: VideoAsset = {
  id: 'video-1',
  type: 'video',
  url: '/video',
  downloadUrl: '/video/download',
  filename: 'video.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 10,
  sortOrder: 1,
  visibility: 'private',
};

describe('image asset helpers', () => {
  it('uses the original URL for an owner image download', () => {
    expect(assetNormalDownloadUrl(image, true)).toBe(image.originalUrl);
  });

  it('does not expose a guest image original download', () => {
    expect(assetNormalDownloadUrl(guestImage, false)).toBeNull();
  });

  it('keeps video downloads on the legacy download URL', () => {
    expect(assetNormalDownloadUrl(video, true)).toBe(video.downloadUrl);
  });

  it('recognizes only image assets', () => {
    expect(isImageAsset(image)).toBe(true);
    expect(isImageAsset(video)).toBe(false);
  });

  it('encodes session and file IDs in a thumbnail URL', () => {
    expect(sessionThumbnailUrl('session/a', 'file ?')).toBe(
      '/api/upload-sessions/session%2Fa/files/file%20%3F/thumbnail',
    );
  });

  it('appends or replaces a retry nonce without dropping the URL query', () => {
    expect(appendRetryNonce('/preview?size=small', 123)).toBe(
      '/preview?size=small&retry=123',
    );
    expect(appendRetryNonce('/preview?retry=1', 456)).toBe('/preview?retry=456');
  });
});
