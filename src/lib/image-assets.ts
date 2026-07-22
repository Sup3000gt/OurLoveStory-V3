import type { ImageAsset, MemoryAsset } from '../../shared/contracts';

export function isImageAsset(asset: MemoryAsset): asset is ImageAsset {
  return asset.type === 'image';
}

export function assetNormalDownloadUrl(
  asset: MemoryAsset,
  isOwner: boolean,
): string | null {
  if (!isImageAsset(asset)) return asset.downloadUrl;
  return isOwner ? asset.originalUrl : null;
}

export function sessionThumbnailUrl(sessionId: string, sessionFileId: string): string {
  return `/api/upload-sessions/${encodeURIComponent(sessionId)}/files/${encodeURIComponent(sessionFileId)}/thumbnail`;
}

export function appendRetryNonce(url: string, nonce = Date.now()): string {
  const withoutRetry = url.replace(/([?&])retry=[^&]*/g, '$1').replace(/[?&]$/, '');
  return `${withoutRetry}${withoutRetry.includes('?') ? '&' : '?'}retry=${nonce}`;
}
