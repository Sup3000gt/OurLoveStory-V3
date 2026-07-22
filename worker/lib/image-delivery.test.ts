import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { signedImageSourceUrl } from './image-source-signature';
import {
  serveImageDerivative,
  serveImageOriginal,
  serveSignedInternalImageSource,
} from './image-delivery';
import type { ImageRoute } from './image-routes';

const { readOrGenerateDerivative } = vi.hoisted(() => ({
  readOrGenerateDerivative: vi.fn(),
}));

vi.mock('./image-transformer', () => ({ readOrGenerateDerivative }));

function descriptor(overrides: Record<string, unknown> = {}) {
  return {
    asset_id: 'asset-1',
    media_type: 'image',
    object_key: 'originals/owner/session/file.jpg',
    original_filename: 'file.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 5,
    visibility: 'public',
    status: 'published',
    ...overrides,
  };
}

function r2Head(etag = '"etag-1"', size = 2) {
  return {
    size,
    httpEtag: etag,
    writeHttpMetadata(headers: Headers) {
      headers.set('content-type', 'image/webp');
    },
  } as unknown as R2Object;
}

function dbFor(first: unknown) {
  const firstCall = vi.fn().mockResolvedValue(first);
  const bind = vi.fn().mockReturnValue({ first: firstCall });
  return {
    DB: { prepare: vi.fn().mockReturnValue({ bind }) },
    firstCall,
  };
}

function envFor(first: unknown) {
  const db = dbFor(first);
  const env = {
    DB: db.DB,
    MEDIA: {
      head: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
    },
    IMAGE_SOURCE_SIGNING_KEY: 'test-signing-secret',
    IMAGES: {},
  } as unknown as Env;
  return { env, db };
}

describe('secure image delivery', () => {
  it.each([
    ['public', 'published', true, 'public, no-cache, must-revalidate'],
    ['private', 'published', true, 'private, no-store'],
  ])('serves an Owner %s %s derivative', async (visibility, status, isOwner, cacheControl) => {
    const { env } = envFor(descriptor({ visibility, status }));
    const media = env.MEDIA as unknown as { head: ReturnType<typeof vi.fn> };
    media.head.mockResolvedValueOnce(null).mockResolvedValueOnce(r2Head());
    readOrGenerateDerivative.mockResolvedValueOnce({
      key: 'derivatives/v1/assets/asset-1/thumbnail.webp',
      bytes: new Uint8Array([1, 2]),
      contentType: 'image/webp',
      customMetadata: {},
    });

    const response = await serveImageDerivative(
      new Request('https://example.com/api/assets/asset-1/thumbnail'),
      env,
      'asset-1',
      'thumbnail',
      isOwner,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(cacheControl);
    expect(readOrGenerateDerivative).toHaveBeenCalledOnce();
    readOrGenerateDerivative.mockReset();
  });

  it('returns 404 before R2 access for a Guest requesting a private or draft derivative', async () => {
    for (const asset of [
      descriptor({ visibility: 'private', status: 'published' }),
      descriptor({ visibility: 'public', status: 'draft' }),
    ]) {
      const { env } = envFor(asset);
      const response = await serveImageDerivative(
        new Request('https://example.com/api/assets/asset-1/thumbnail'),
        env,
        'asset-1',
        'thumbnail',
        false,
      );

      expect(response.status).toBe(404);
      expect((env.MEDIA as unknown as { head: ReturnType<typeof vi.fn> }).head).not.toHaveBeenCalled();
      expect(readOrGenerateDerivative).not.toHaveBeenCalled();
    }
  });

  it('returns 404 before R2 access when a Guest requests an image Original', async () => {
    const { env } = envFor(descriptor({ visibility: 'public', status: 'published' }));
    const response = await serveImageOriginal(
      new Request('https://example.com/api/assets/asset-1/original'),
      env,
      'asset-1',
      false,
    );

    expect(response.status).toBe(404);
    expect((env.MEDIA as unknown as { head: ReturnType<typeof vi.fn> }).head).not.toHaveBeenCalled();
  });

  it('supports Owner Original HEAD and Range responses', async () => {
    const { env } = envFor(descriptor({ visibility: 'private', status: 'draft', mime_type: 'image/jpeg' }));
    const media = env.MEDIA as unknown as { head: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    media.head.mockResolvedValue(r2Head('"original"', 5));

    const headResponse = await serveImageOriginal(
      new Request('https://example.com/api/assets/asset-1/original', { method: 'HEAD' }),
      env,
      'asset-1',
      true,
    );
    expect(headResponse.status).toBe(200);
    expect(headResponse.body).toBeNull();
    expect(headResponse.headers.get('content-disposition')).toContain('attachment');

    media.get.mockResolvedValue({
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([2, 3])); controller.close(); } }),
      size: 2,
      range: { offset: 1, length: 2 },
      httpEtag: '"original"',
      writeHttpMetadata(headers: Headers) { headers.set('content-type', 'image/jpeg'); },
    });
    const rangeResponse = await serveImageOriginal(
      new Request('https://example.com/api/assets/asset-1/original', { headers: { range: 'bytes=1-2' } }),
      env,
      'asset-1',
      true,
    );
    expect(rangeResponse.status).toBe(206);
    expect(rangeResponse.headers.get('accept-ranges')).toBe('bytes');
  });

  it('returns 304 for a matching derivative ETag', async () => {
    const { env } = envFor(descriptor());
    const media = env.MEDIA as unknown as { head: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
    media.head.mockResolvedValue(r2Head());
    const response = await serveImageDerivative(
      new Request('https://example.com/api/assets/asset-1/thumbnail', { headers: { 'if-none-match': '"etag-1"' } }),
      env,
      'asset-1',
      'thumbnail',
      false,
    );

    expect(response.status).toBe(304);
    expect(media.get).not.toHaveBeenCalled();
    expect(readOrGenerateDerivative).not.toHaveBeenCalled();
  });

  it('returns 503 with Retry-After when derivative generation fails', async () => {
    const { env } = envFor(descriptor());
    (env.MEDIA as unknown as { head: ReturnType<typeof vi.fn> }).head.mockResolvedValue(null);
    readOrGenerateDerivative.mockRejectedValueOnce(new Error('transform failed'));

    const response = await serveImageDerivative(
      new Request('https://example.com/api/assets/asset-1/thumbnail'),
      env,
      'asset-1',
      'thumbnail',
      true,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('5');
    expect(response.headers.get('cache-control')).toBe('no-store');
    readOrGenerateDerivative.mockReset();
  });

  it('streams the exact Original for a valid signed internal source request', async () => {
    const { env } = envFor(descriptor());
    const media = env.MEDIA as unknown as { get: ReturnType<typeof vi.fn> };
    media.get.mockResolvedValue({
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([8])); controller.close(); } }),
      size: 1,
      httpEtag: '"source"',
      writeHttpMetadata(headers: Headers) { headers.set('content-type', 'image/jpeg'); },
    });
    const signed = await signedImageSourceUrl(
      'https://example.com',
      '/api/internal/image-source/assets/asset-1',
      'test-signing-secret',
      Math.floor(Date.now() / 1000),
    );
    const route: ImageRoute = { action: 'internal-asset-source', assetId: 'asset-1' };
    const response = await serveSignedInternalImageSource(new Request(signed.url), env, route);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.arrayBuffer()).toEqual(new Uint8Array([8]).buffer);
  });

  it('returns 404 for an invalid internal source signature', async () => {
    const { env } = envFor(descriptor());
    const route: ImageRoute = { action: 'internal-asset-source', assetId: 'asset-1' };
    const response = await serveSignedInternalImageSource(
      new Request('https://example.com/api/internal/image-source/assets/asset-1?expires=1&signature=bad'),
      env,
      route,
    );

    expect(response.status).toBe(404);
    expect((env.MEDIA as unknown as { get: ReturnType<typeof vi.fn> }).get).not.toHaveBeenCalled();
  });
});
