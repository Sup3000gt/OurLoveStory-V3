import type { Memory, MemoryAsset, Visibility } from '../../shared/contracts';

export interface AssetVisibilitySummary {
  publicCount: number;
  privateCount: number;
}

export function summarizeAssetVisibility(
  assets: Pick<MemoryAsset, 'visibility'>[],
): AssetVisibilitySummary {
  let publicCount = 0;
  let privateCount = 0;
  for (const asset of assets) {
    if (asset.visibility === 'public') publicCount += 1;
    else privateCount += 1;
  }
  return { publicCount, privateCount };
}

export function replaceAssetVisibility(
  memories: Memory[],
  assetId: string,
  visibility: Visibility,
): Memory[] {
  return memories.map((memory) => {
    if (!memory.assets.some((asset) => asset.id === assetId)) return memory;
    return {
      ...memory,
      assets: memory.assets.map((asset) =>
        asset.id === assetId ? { ...asset, visibility } : asset,
      ),
    };
  });
}
