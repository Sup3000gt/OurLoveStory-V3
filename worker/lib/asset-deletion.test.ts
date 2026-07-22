import { describe, expect, it } from 'vitest';
import { planAssetDeletion } from './asset-deletion';
import { imageAssetObjectKeys } from './image-session-lifecycle';

const assets = [
  { id: 'asset-a', sortOrder: 0 },
  { id: 'asset-b', sortOrder: 1 },
  { id: 'asset-c', sortOrder: 2 },
];

describe('planAssetDeletion', () => {
  it('chooses the next asset when deleting the current cover', () => {
    expect(planAssetDeletion(assets, 'asset-b', 'asset-b')).toEqual({
      deleteMemory: false,
      replacementCoverAssetId: 'asset-c',
    });
  });

  it('chooses the previous asset when deleting the last current cover', () => {
    expect(planAssetDeletion(assets, 'asset-c', 'asset-c')).toEqual({
      deleteMemory: false,
      replacementCoverAssetId: 'asset-b',
    });
  });

  it('does not replace the cover when deleting a non-cover asset', () => {
    expect(planAssetDeletion(assets, 'asset-c', 'asset-a')).toEqual({
      deleteMemory: false,
      replacementCoverAssetId: null,
    });
  });

  it('deletes the memory when its final asset is deleted', () => {
    expect(
      planAssetDeletion([{ id: 'only-asset', sortOrder: 0 }], 'only-asset', 'only-asset'),
    ).toEqual({
      deleteMemory: true,
      replacementCoverAssetId: null,
    });
  });
});

describe('imageAssetObjectKeys', () => {
  it('includes the Original and both deterministic image derivatives', () => {
    expect(imageAssetObjectKeys('asset-1', 'originals/owner/session/file.jpg')).toEqual([
      'originals/owner/session/file.jpg',
      'derivatives/v1/assets/asset-1/thumbnail.webp',
      'derivatives/v1/assets/asset-1/preview.webp',
    ]);
  });
});
