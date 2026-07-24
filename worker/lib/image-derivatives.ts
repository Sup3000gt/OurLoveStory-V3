export type ImageDerivativeVariant = 'thumbnail' | 'preview';

export interface ImageVariantConfig {
  width: number;
  height: number;
  fit: 'scale-down';
  format: 'webp';
  bindingFormat: 'image/webp';
  quality: number;
  anim: false;
}

export const MAX_BINDING_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_REMOTE_TRANSFORM_BYTES = 100 * 1024 * 1024;

const IMAGE_VARIANT_CONFIGS: Record<ImageDerivativeVariant, ImageVariantConfig> = {
  thumbnail: {
    width: 640,
    height: 640,
    fit: 'scale-down',
    format: 'webp',
    bindingFormat: 'image/webp',
    quality: 75,
    anim: false,
  },
  preview: {
    width: 2048,
    height: 2048,
    fit: 'scale-down',
    format: 'webp',
    bindingFormat: 'image/webp',
    quality: 82,
    anim: false,
  },
};

export function imageVariantConfig(variant: ImageDerivativeVariant): ImageVariantConfig {
  return IMAGE_VARIANT_CONFIGS[variant];
}

export function assetDerivativeKey(assetId: string, variant: ImageDerivativeVariant): string {
  return `derivatives/v1/assets/${assetId}/${variant}.webp`;
}

export function sessionThumbnailKey(sessionId: string, sessionFileId: string): string {
  return `derivatives/v1/upload-sessions/${sessionId}/${sessionFileId}/thumbnail.webp`;
}

export function shouldUseBinding(sizeBytes: number): boolean {
  return sizeBytes <= MAX_BINDING_INPUT_BYTES;
}

export function isRemoteTransformSizeSupported(sizeBytes: number): boolean {
  return sizeBytes <= MAX_REMOTE_TRANSFORM_BYTES;
}

export function derivativeCacheControl(publiclyVisible: boolean): string {
  return publiclyVisible
    ? 'public, max-age=31536000, immutable'
    : 'private, no-store';
}

function withoutWeakPrefix(value: string): string {
  return value.trim().replace(/^W\//i, '');
}

export function ifNoneMatchMatches(ifNoneMatch: string | null | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;

  const normalizedEtag = withoutWeakPrefix(etag);
  return ifNoneMatch
    .split(',')
    .some((candidate) => candidate.trim() === '*' || withoutWeakPrefix(candidate) === normalizedEtag);
}
