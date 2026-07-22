import type { DeleteAssetResponse, ImageAsset, Memory } from '../../shared/contracts';

export function imageAssetsForLightbox(memory: Memory): ImageAsset[] {
  return memory.assets.filter((asset): asset is ImageAsset => asset.type === 'image');
}

export function adjacentImageAssetId(memory: Memory, currentAssetId: string, direction: -1 | 1): string | null {
  const images = imageAssetsForLightbox(memory);
  const currentIndex = images.findIndex((asset) => asset.id === currentAssetId);
  return currentIndex < 0 ? null : images[currentIndex + direction]?.id ?? null;
}

export function applyAssetDeletion(
  memories: Memory[],
  response: DeleteAssetResponse,
): Memory[] {
  if (response.deletedMemory) {
    return memories.filter((memory) => memory.id !== response.memoryId);
  }

  return memories.map((memory) => {
    if (memory.id !== response.memoryId) return memory;

    return {
      ...memory,
      coverAssetId: response.replacementCoverAssetId ?? memory.coverAssetId,
      assets: memory.assets.filter((asset) => asset.id !== response.deletedAssetId),
    };
  });
}
