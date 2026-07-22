import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import {
  deleteSessionImageObjects,
  finalizeConfirmedImages,
  imageAssetObjectKeys,
  type ConfirmedImageMapping,
} from './image-session-lifecycle';
import { assetDerivativeKey, sessionThumbnailKey } from './image-derivatives';

const { readOrGenerateDerivative } = vi.hoisted(() => ({
  readOrGenerateDerivative: vi.fn(),
}));

vi.mock('./image-transformer', () => ({ readOrGenerateDerivative }));

const mapping: ConfirmedImageMapping = {
  sessionId: 'session-1',
  sessionFileId: 'file-1',
  assetId: 'asset-1',
  objectKey: 'originals/owner/session-1/file-1.jpg',
  sizeBytes: 3,
};

function envFor(sessionThumbnail: Uint8Array | null = new Uint8Array([7, 8])) {
  const get = vi.fn().mockResolvedValue(
    sessionThumbnail
      ? {
          body: new ReadableStream({
            start(controller) {
              controller.enqueue(sessionThumbnail);
              controller.close();
            },
          }),
          arrayBuffer: async () => sessionThumbnail.buffer,
        }
      : null,
  );
  return {
    env: {
      MEDIA: {
        get,
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      },
      IMAGES: {},
      IMAGE_SOURCE_SIGNING_KEY: 'test-secret',
    } as unknown as Env,
    get,
  };
}

describe('image Session lifecycle', () => {
  it('promotes a Session Thumbnail, deletes the Session copy, and schedules Preview generation', async () => {
    const { env } = envFor();
    readOrGenerateDerivative.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: 'image/webp' });

    await finalizeConfirmedImages(env, [mapping], 'https://example.com');

    expect(env.MEDIA.put).toHaveBeenCalledWith(
      assetDerivativeKey('asset-1', 'thumbnail'),
      new Uint8Array([7, 8]),
      expect.objectContaining({ httpMetadata: { contentType: 'image/webp' } }),
    );
    expect(env.MEDIA.delete).toHaveBeenCalledWith(sessionThumbnailKey('session-1', 'file-1'));
    expect(readOrGenerateDerivative).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ kind: 'asset', assetId: 'asset-1' }),
      'preview',
      assetDerivativeKey('asset-1', 'preview'),
      { sourceOrigin: 'https://example.com' },
    );
    readOrGenerateDerivative.mockReset();
  });

  it('generates both final variants when a Session Thumbnail is absent', async () => {
    const { env } = envFor(null);
    readOrGenerateDerivative.mockResolvedValue({ bytes: new Uint8Array([1]), contentType: 'image/webp' });

    await finalizeConfirmedImages(env, [mapping], 'https://example.com');

    expect(readOrGenerateDerivative).toHaveBeenCalledTimes(2);
    expect(readOrGenerateDerivative).toHaveBeenCalledWith(
      env,
      expect.objectContaining({ kind: 'asset', assetId: 'asset-1' }),
      'thumbnail',
      assetDerivativeKey('asset-1', 'thumbnail'),
      { sourceOrigin: 'https://example.com' },
    );
    readOrGenerateDerivative.mockReset();
  });

  it('contains post-confirm derivative failures without rejecting confirmation work', async () => {
    const { env } = envFor();
    readOrGenerateDerivative.mockRejectedValue(new Error('transform failed'));

    await expect(finalizeConfirmedImages(env, [mapping], 'https://example.com')).resolves.toBeUndefined();
    readOrGenerateDerivative.mockReset();
  });

  it('deletes Session Originals and Session Thumbnails during abandonment cleanup', async () => {
    const { env } = envFor();

    await deleteSessionImageObjects(env, 'session-1', [
      { id: 'file-1', objectKey: mapping.objectKey },
      { id: 'file-2', objectKey: null },
    ]);

    expect(env.MEDIA.delete).toHaveBeenCalledWith([
      mapping.objectKey,
      sessionThumbnailKey('session-1', 'file-1'),
      sessionThumbnailKey('session-1', 'file-2'),
    ]);
  });

  it('returns Original plus both final derivative keys for an image Asset', () => {
    expect(imageAssetObjectKeys('asset-1', mapping.objectKey)).toEqual([
      mapping.objectKey,
      assetDerivativeKey('asset-1', 'thumbnail'),
      assetDerivativeKey('asset-1', 'preview'),
    ]);
  });
});
