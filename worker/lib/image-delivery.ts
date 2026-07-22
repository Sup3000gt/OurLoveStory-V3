import type { Env } from '../env';
import { assetDerivativeKey } from './image-derivatives';
import {
  derivativeCacheControl,
  ifNoneMatchMatches,
  type ImageDerivativeVariant,
} from './image-derivatives';
import { readOrGenerateDerivative, type ImageSourceDescriptor } from './image-transformer';
import type { ImageRoute } from './image-routes';
import { notFound } from './responses';
import { sanitizeDownloadFilename } from './validation';
import { verifyImageSourceSignature } from './image-source-signature';

interface AssetDescriptorRow {
  asset_id: string;
  media_type: 'image' | 'video';
  object_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  visibility: 'public' | 'private';
  status: 'draft' | 'published';
}

interface SessionSourceDescriptor {
  object_key: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
}

function responseHeaders(
  cacheControl: string,
  etag?: string,
  contentLength?: number,
): Headers {
  const headers = new Headers();
  headers.set('content-type', 'image/webp');
  headers.set('cache-control', cacheControl);
  headers.set('x-content-type-options', 'nosniff');
  if (etag) headers.set('etag', etag);
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  return headers;
}

function originalHeaders(
  descriptor: Pick<AssetDescriptorRow, 'original_filename' | 'mime_type'>,
  etag?: string,
  contentLength?: number,
): Headers {
  const headers = new Headers();
  headers.set('content-type', descriptor.mime_type || 'application/octet-stream');
  headers.set('cache-control', 'private, no-store');
  headers.set('content-disposition', `attachment; filename="${sanitizeDownloadFilename(descriptor.original_filename)}"`);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('accept-ranges', 'bytes');
  if (etag) headers.set('etag', etag);
  if (contentLength !== undefined) headers.set('content-length', String(contentLength));
  return headers;
}

async function assetDescriptor(env: Env, assetId: string): Promise<AssetDescriptorRow | null> {
  return env.DB.prepare(`
    SELECT
      a.id AS asset_id,
      a.media_type,
      a.object_key,
      a.original_filename,
      a.mime_type,
      a.size_bytes,
      a.visibility,
      m.status
    FROM media_assets a
    INNER JOIN memories m ON m.id = a.memory_id
    WHERE a.id = ?
    LIMIT 1
  `).bind(assetId).first<AssetDescriptorRow>();
}

function publiclyVisible(descriptor: Pick<AssetDescriptorRow, 'visibility' | 'status'>): boolean {
  return descriptor.visibility === 'public' && descriptor.status === 'published';
}

function imageSourceForAsset(descriptor: AssetDescriptorRow): ImageSourceDescriptor {
  return {
    kind: 'asset',
    assetId: descriptor.asset_id,
    objectKey: descriptor.object_key,
    sizeBytes: descriptor.size_bytes,
  };
}

export async function serveImageDerivative(
  request: Request,
  env: Env,
  assetId: string,
  variant: ImageDerivativeVariant,
  isOwner: boolean,
): Promise<Response> {
  const descriptor = await assetDescriptor(env, assetId);
  if (!descriptor || descriptor.media_type !== 'image') return notFound();

  const isPublic = publiclyVisible(descriptor);
  if (!isPublic && !isOwner) return notFound();

  const key = assetDerivativeKey(assetId, variant);
  const cacheControl = derivativeCacheControl(isPublic);

  try {
    let head = await env.MEDIA.head(key);
    if (head) {
      const headers = responseHeaders(cacheControl, head.httpEtag, head.size);
      if (ifNoneMatchMatches(request.headers.get('if-none-match'), head.httpEtag)) {
        return new Response(null, { status: 304, headers });
      }
      if (request.method === 'HEAD') return new Response(null, { status: 200, headers });

      const object = await env.MEDIA.get(key);
      if (object && 'body' in object && object.body) {
        const objectHeaders = responseHeaders(cacheControl, object.httpEtag, object.size);
        return new Response(object.body, { status: 200, headers: objectHeaders });
      }
      head = null;
    }

    const generated = await readOrGenerateDerivative(
      env,
      imageSourceForAsset(descriptor),
      variant,
      key,
    );
    head = await env.MEDIA.head(key);
    const headers = responseHeaders(
      cacheControl,
      head?.httpEtag,
      head?.size ?? generated.bytes.byteLength,
    );
    if (ifNoneMatchMatches(request.headers.get('if-none-match'), head?.httpEtag ?? '')) {
      return new Response(null, { status: 304, headers });
    }
    if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
    return new Response(generated.bytes, { status: 200, headers });
  } catch {
    return new Response(null, {
      status: 503,
      headers: {
        'cache-control': 'no-store',
        'retry-after': '5',
      },
    });
  }
}

function normalizeR2Range(range: R2Range, objectSize: number): { offset: number; length: number } {
  if ('suffix' in range) {
    const length = Math.min(range.suffix, objectSize);
    return { offset: objectSize - length, length };
  }
  const offset = range.offset ?? 0;
  const length = range.length ?? Math.max(0, objectSize - offset);
  return { offset, length };
}

export async function serveImageOriginal(
  request: Request,
  env: Env,
  assetId: string,
  isOwner: boolean,
): Promise<Response> {
  const descriptor = await assetDescriptor(env, assetId);
  if (!descriptor || descriptor.media_type !== 'image' || !isOwner) return notFound();

  if (request.method === 'HEAD') {
    const head = await env.MEDIA.head(descriptor.object_key);
    if (!head) return notFound();
    return new Response(null, {
      status: 200,
      headers: originalHeaders(descriptor, head.httpEtag, head.size),
    });
  }

  const object = await env.MEDIA.get(descriptor.object_key, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (!object) return notFound();
  if (!('body' in object) || !object.body) return new Response(null, { status: 412 });

  const headers = originalHeaders(descriptor, object.httpEtag, object.size);
  let status = 200;
  if (object.range) {
    const { offset, length } = normalizeR2Range(object.range, object.size);
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    status = 206;
  }
  return new Response(object.body, { status, headers });
}

async function sessionSourceDescriptor(
  env: Env,
  sessionId: string,
  fileId: string,
): Promise<SessionSourceDescriptor | null> {
  return env.DB.prepare(`
    SELECT f.object_key, f.original_filename, f.mime_type, f.size_bytes
    FROM upload_session_files f
    INNER JOIN upload_sessions s ON s.id = f.upload_session_id
    WHERE s.id = ?
      AND f.id = ?
      AND f.file_status = 'uploaded'
      AND f.object_key IS NOT NULL
    LIMIT 1
  `).bind(sessionId, fileId).first<SessionSourceDescriptor>();
}

export async function serveSignedInternalImageSource(
  request: Request,
  env: Env,
  route: Extract<ImageRoute, { action: 'internal-asset-source' | 'internal-session-source' }>,
): Promise<Response> {
  const url = new URL(request.url);
  const expires = Number(url.searchParams.get('expires'));
  const signature = url.searchParams.get('signature');
  if (!signature || !Number.isInteger(expires)) return notFound();
  if (!await verifyImageSourceSignature(
    env.IMAGE_SOURCE_SIGNING_KEY,
    url.pathname,
    expires,
    signature,
    Math.floor(Date.now() / 1000),
  )) return notFound();

  const descriptor = route.action === 'internal-asset-source'
    ? await assetDescriptor(env, route.assetId)
    : await sessionSourceDescriptor(env, route.sessionId, route.fileId);
  if (!descriptor || ('media_type' in descriptor && descriptor.media_type !== 'image')) return notFound();

  const object = await env.MEDIA.get(descriptor.object_key);
  if (!object || !('body' in object) || !object.body) return notFound();
  const headers = new Headers();
  headers.set('content-type', descriptor.mime_type || 'application/octet-stream');
  headers.set('cache-control', 'private, no-store');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('content-length', String(object.size));
  headers.set('etag', object.httpEtag);
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(object.body, { status: 200, headers });
}
