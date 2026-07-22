import type { Env } from '../env';
import {
  imageVariantConfig,
  isRemoteTransformSizeSupported,
  shouldUseBinding,
  type ImageDerivativeVariant,
} from './image-derivatives';

export type ImageSourceDescriptor =
  | { kind: 'asset'; assetId: string; objectKey: string; sizeBytes: number }
  | { kind: 'upload-session'; sessionId: string; sessionFileId: string; objectKey: string; sizeBytes: number };

export interface GeneratedDerivative {
  key: string;
  bytes: Uint8Array;
  contentType: 'image/webp';
  customMetadata: Record<string, string>;
}

export type ImageDerivativeErrorCode = 'SOURCE_TOO_LARGE' | 'REMOTE_FAILED' | 'QUOTA_EXCEEDED';

export class ImageDerivativeError extends Error {
  constructor(public readonly code: ImageDerivativeErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageDerivativeError';
  }
}

export interface ImageTransformerOptions {
  fetchImpl?: typeof fetch;
  sourceOrigin?: string;
  nowSeconds?: number;
}

const inFlight = new Map<string, Promise<GeneratedDerivative>>();
const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signedSourceUrl(env: Env, source: ImageSourceDescriptor, options: ImageTransformerOptions): Promise<string> {
  const pathname = source.kind === 'asset'
    ? `/api/internal/image-source/assets/${encodeURIComponent(source.assetId)}`
    : `/api/internal/image-source/upload-sessions/${encodeURIComponent(source.sessionId)}/${encodeURIComponent(source.sessionFileId)}`;
  const now = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expires = now + 60;
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.IMAGE_SOURCE_SIGNING_KEY ?? ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${pathname}\n${expires}`));
  const url = new URL(pathname, options.sourceOrigin ?? 'https://internal.invalid');
  url.searchParams.set('expires', String(expires));
  url.searchParams.set('signature', base64Url(new Uint8Array(signature)));
  return url.toString();
}

function mapImageError(error: unknown): ImageDerivativeError {
  if (error instanceof ImageDerivativeError) return error;
  if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: unknown }).code === 9422) {
    return new ImageDerivativeError('QUOTA_EXCEEDED', 'Image transformation quota exceeded', { cause: error });
  }
  return error instanceof Error ? new ImageDerivativeError('REMOTE_FAILED', error.message, { cause: error }) : new ImageDerivativeError('REMOTE_FAILED', 'Image transformation failed');
}

async function bytesFromResponse(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

async function transform(env: Env, source: ImageSourceDescriptor, variant: ImageDerivativeVariant, options: ImageTransformerOptions): Promise<Uint8Array> {
  if (!isRemoteTransformSizeSupported(source.sizeBytes)) {
    throw new ImageDerivativeError('SOURCE_TOO_LARGE', 'Image source exceeds the 100 MB transformation limit');
  }

  const config = imageVariantConfig(variant);
  if (shouldUseBinding(source.sizeBytes)) {
    const original = await env.MEDIA.get(source.objectKey);
    if (!original?.body) throw new ImageDerivativeError('REMOTE_FAILED', 'Image source is unavailable');
    try {
      const result = await env.IMAGES.input(original.body)
        .transform({ width: config.width, height: config.height, fit: config.fit })
        .output({ format: config.bindingFormat, quality: config.quality, anim: config.anim });
      return bytesFromResponse(await result.response());
    } catch (error) {
      throw mapImageError(error);
    }
  }

  const response = await (options.fetchImpl ?? fetch)(await signedSourceUrl(env, source, options), {
    cf: { image: { format: config.format, quality: config.quality, fit: config.fit, anim: config.anim } },
  });
  if (!response.ok) {
    let code: unknown;
    try { code = (await response.clone().json() as { code?: unknown }).code; } catch { /* non-JSON response */ }
    if (code === 9422) throw new ImageDerivativeError('QUOTA_EXCEEDED', 'Image transformation quota exceeded');
    throw new ImageDerivativeError('REMOTE_FAILED', `Image source transformation failed (${response.status})`);
  }
  return bytesFromResponse(response);
}

export function generateAndPersistDerivative(
  env: Env,
  source: ImageSourceDescriptor,
  variant: ImageDerivativeVariant,
  key: string,
  options: ImageTransformerOptions = {},
): Promise<GeneratedDerivative> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const bytes = await transform(env, source, variant, options);
    const customMetadata = {
      version: 'v1',
      source: source.kind === 'asset' ? `asset:${source.assetId}` : `upload-session:${source.sessionId}:${source.sessionFileId}`,
      variant,
    };
    await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: 'image/webp' }, customMetadata });
    return { key, bytes, contentType: 'image/webp' as const, customMetadata };
  })().catch((error) => { throw mapImageError(error); }).finally(() => { inFlight.delete(key); });
  inFlight.set(key, promise);
  return promise;
}

export async function readOrGenerateDerivative(
  env: Env,
  source: ImageSourceDescriptor,
  variant: ImageDerivativeVariant,
  key: string,
  options: ImageTransformerOptions = {},
): Promise<GeneratedDerivative> {
  const cached = await env.MEDIA.get(key);
  if (cached?.body) {
    return {
      key,
      bytes: new Uint8Array(await cached.arrayBuffer()),
      contentType: 'image/webp',
      customMetadata: cached.customMetadata ?? { version: 'v1', source: 'cached', variant },
    };
  }
  return generateAndPersistDerivative(env, source, variant, key, options);
}
