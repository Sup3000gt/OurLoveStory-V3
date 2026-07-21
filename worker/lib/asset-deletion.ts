export interface DeletableAsset {
  id: string;
  sortOrder: number;
}

export interface AssetDeletionPlan {
  deleteMemory: boolean;
  replacementCoverAssetId: string | null;
}

export function planAssetDeletion(
  assets: DeletableAsset[],
  deletingAssetId: string,
  coverAssetId: string,
): AssetDeletionPlan {
  const ordered = [...assets].sort((left, right) => left.sortOrder - right.sortOrder);
  const deletingIndex = ordered.findIndex((asset) => asset.id === deletingAssetId);

  if (deletingIndex < 0) throw new Error('The asset to delete was not found.');
  if (ordered.length === 1) {
    return { deleteMemory: true, replacementCoverAssetId: null };
  }
  if (coverAssetId !== deletingAssetId) {
    return { deleteMemory: false, replacementCoverAssetId: null };
  }

  const replacement = ordered[deletingIndex + 1] ?? ordered[deletingIndex - 1];
  if (!replacement) throw new Error('A replacement cover could not be selected.');

  return {
    deleteMemory: false,
    replacementCoverAssetId: replacement.id,
  };
}