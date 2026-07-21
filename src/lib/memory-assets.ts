import type { DeleteAssetResponse, Memory } from '../../shared/contracts';

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