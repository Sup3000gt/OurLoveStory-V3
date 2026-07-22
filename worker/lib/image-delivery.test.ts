import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import { signedImageSourceUrl } from './image-source-signature';
import {
  serveImageDerivative,
  serveImageOriginal,
  serveSignedInternalImageSource,
} from './image-delivery';
import { getMemory, serveAsset } from './memories';
import type { ImageRoute } from './image-routes';

const { readOrGenerateDerivative } = vi.hoisted(() => ({
  readOrGenerateDerivative: vi.fn(),
}));
const { optionalOwner } = vi.hoisted(() => ({
  optionalOwner: vi.fn(),
}));

vi.mock('./image-transformer', () => ({ readOrGenerateDerivative }));
vi.mock('./auth', () => ({ optionalOwner }));

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
  const allCall = vi.fn().mockResolvedValue({ results: [] });
  const bind = vi.fn().mockReturnValue({ first: firstCall, all: allCall });
  return {
    DB: { prepare: vi.fn().mockReturnValue({ bind }) },
    firstCall,
    allCall,
  };
}

function envFor(first: unknown, rows: unknown[] = []) {
  const db = dbFor(first);
  db.allCall.mockResolvedValue({ results: rows });
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

function memoryRow(overrides: Record<string, unknown> = {}) {
  return {
    memory_id: 'memory-1',
    title: 'Trip',
    description: '',
    location: 'NY',
    taken_at: '2026-07-20',
    category: 'Travel',
    visibility: 'private',
    is_featured: 0,
    status: 'published',
    cover_asset_id: 'image-1',
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    asset_id: 'image-1',
    media_type: 'image',
    original_filename: 'photo.jpg',
    mime_type: 'image/jpeg',
    size_bytes: 5,
    sort_order: 0,
    asset_visibility: 'public',
    ...overrides,
  };
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

  it('serves generic image display through the Preview derivative', async () => {
    optionalOwner.mockResolvedValue(null);
    const { env } = envFor(descriptor());
    const media = env.MEDIA as unknown as { head: ReturnType<typeof vi.fn> };
    media.head.mockResolvedValueOnce(null).mockResolvedValueOnce(r2Head());
    readOrGenerateDerivative.mockResolvedValueOnce({
      key: 'derivatives/v1/assets/asset-1/preview.webp',
      bytes: new Uint8Array([1, 2]),
      contentType: 'image/webp',
      customMetadata: {},
    });

    const response = await serveAsset(
      new Request('https://example.com/api/assets/asset-1'),
      env,
      'asset-1',
      false,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/webp');
    expect(readOrGenerateDerivative.mock.calls.at(-1)?.[2]).toBe('preview');
    readOrGenerateDerivative.mockReset();
  });

  it('denies a Guest generic image download', async () => {
    optionalOwner.mockResolvedValue(null);
    const { env } = envFor(descriptor({ visibility: 'public', status: 'published' }));

    const response = await serveAsset(
      new Request('https://example.com/api/assets/asset-1/download'),
      env,
      'asset-1',
      true,
    );

    expect(response.status).toBe(404);
  });

  it('serves an Owner generic image download as an Original attachment', async () => {
    optionalOwner.mockResolvedValue({ userId: 'owner-1' });
    const { env } = envFor(descriptor({ visibility: 'private', status: 'draft' }));
    (env.MEDIA as unknown as { head: ReturnType<typeof vi.fn> }).head.mockResolvedValue(r2Head('"original"', 5));

    const response = await serveAsset(
      new Request('https://example.com/api/assets/asset-1/download', { method: 'HEAD' }),
      env,
      'asset-1',
      true,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-disposition')).toContain('attachment');
  });

  it('keeps generic video delivery on the legacy Range route', async () => {
    optionalOwner.mockResolvedValue(null);
    const { env } = envFor(descriptor({
      media_type: 'video',
      mime_type: 'video/mp4',
      visibility: 'public',
      status: 'published',
    }));
    (env.MEDIA as unknown as { get: ReturnType<typeof vi.fn> }).get.mockResolvedValue({
      body: new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([2, 3])); controller.close(); } }),
      size: 2,
      range: { offset: 1, length: 1 },
      httpEtag: '"video"',
      writeHttpMetadata(headers: Headers) { headers.set('content-type', 'video/mp4'); },
    });

    const response = await serveAsset(
      new Request('https://example.com/api/assets/video-1', { headers: { range: 'bytes=1-1' } }),
      env,
      'video-1',
      false,
    );

    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe('bytes 1-1/2');
    expect(response.headers.get('content-type')).toBe('video/mp4');
  });

  it('serializes images without legacy URLs while preserving video URLs', async () => {
    optionalOwner.mockReset();
    const rows = [
      memoryRow(),
      memoryRow({
        asset_id: 'video-1',
        media_type: 'video',
        original_filename: 'clip.mp4',
        mime_type: 'video/mp4',
        sort_order: 1,
      }),
    ];
    const { env } = envFor(null, rows);

    const memory = await getMemory(env, 'memory-1', false);

    expect(memory?.assets[0]).toMatchObject({
      type: 'image',
      thumbnailUrl: '/api/assets/image-1/thumbnail',
      previewUrl: '/api/assets/image-1/preview',
      originalUrl: null,
    });
    expect(memory?.assets[0]).not.toHaveProperty('url');
    expect(memory?.assets[0]).not.toHaveProperty('downloadUrl');
    expect(memory?.assets[1]).toMatchObject({
      type: 'video',
      url: '/api/assets/video-1',
      downloadUrl: '/api/assets/video-1/download',
    });
  });
});
