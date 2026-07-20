import type { MemoryAsset } from '../../shared/contracts';

export function resolveVisibleCoverAssetId(
  configuredCoverAssetId: string,
  visibleAssets: Pick<MemoryAsset, 'id'>[],
): string {
  if (visibleAssets.some((asset) => asset.id === configuredCoverAssetId)) {
    return configuredCoverAssetId;
  }
  return visibleAssets[0]?.id ?? configuredCoverAssetId;
}
