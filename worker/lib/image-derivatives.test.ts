import { describe, expect, it } from 'vitest';
import {
  assetDerivativeKey,
  derivativeCacheControl,
  ifNoneMatchMatches,
  imageVariantConfig,
  isRemoteTransformSizeSupported,
  sessionThumbnailKey,
  shouldUseBinding,
} from './image-derivatives';

describe('image derivative primitives', () => {
  it('uses the approved thumbnail and preview transformation configurations', () => {
    expect(imageVariantConfig('thumbnail')).toEqual({
      width: 640,
      height: 640,
      fit: 'scale-down',
      format: 'webp',
      bindingFormat: 'image/webp',
      quality: 75,
      anim: false,
    });
    expect(imageVariantConfig('preview')).toEqual({
      width: 2048,
      height: 2048,
      fit: 'scale-down',
      format: 'webp',
      bindingFormat: 'image/webp',
      quality: 82,
      anim: false,
    });
  });

  it('builds deterministic versioned R2 keys', () => {
    expect(assetDerivativeKey('a', 'preview')).toBe('derivatives/v1/assets/a/preview.webp');
    expect(sessionThumbnailKey('s', 'f')).toBe('derivatives/v1/upload-sessions/s/f/thumbnail.webp');
  });

  it('selects binding and remote transformation at the approved size boundaries', () => {
    expect(shouldUseBinding(20 * 1024 * 1024)).toBe(true);
    expect(shouldUseBinding(20 * 1024 * 1024 + 1)).toBe(false);
    expect(isRemoteTransformSizeSupported(100 * 1024 * 1024)).toBe(true);
    expect(isRemoteTransformSizeSupported(100 * 1024 * 1024 + 1)).toBe(false);
  });

  it('uses public revalidation only for public derivatives', () => {
    expect(derivativeCacheControl(true)).toBe('public, no-cache, must-revalidate');
    expect(derivativeCacheControl(false)).toBe('private, no-store');
  });

  it('matches an ETag in a single or comma-separated If-None-Match header', () => {
    expect(ifNoneMatchMatches('"etag-1"', '"etag-1"')).toBe(true);
    expect(ifNoneMatchMatches('"etag-0", "etag-1"', '"etag-1"')).toBe(true);
    expect(ifNoneMatchMatches('W/"etag-1"', '"etag-1"')).toBe(true);
    expect(ifNoneMatchMatches('"etag-0"', '"etag-1"')).toBe(false);
    expect(ifNoneMatchMatches(undefined, '"etag-1"')).toBe(false);
  });
});
