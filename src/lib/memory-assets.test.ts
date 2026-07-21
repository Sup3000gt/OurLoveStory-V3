import { describe, expect, it } from 'vitest';
import type { Memory } from '../../shared/contracts';
import { applyAssetDeletion } from './memory-assets';

const memory: Memory = {
  id: 'memory-1',
  title: 'New York',
  location: 'New York',
  date: '2026-07-20',
  description: '',
  category: 'Travel',
  visibility: 'private',
  featured: false,
  status: 'published',
  coverAssetId: 'asset-a',
  assets: [
    {
      id: 'asset-a',
      type: 'image',
      url: '/api/assets/asset-a',
      downloadUrl: '/api/assets/asset-a/download',
      filename: 'a.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      sortOrder: 0,
      visibility: 'private',
    },
    {
      id: 'asset-b',
      type: 'image',
      url: '/api/assets/asset-b',
      downloadUrl: '/api/assets/asset-b/download',
      filename: 'b.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      sortOrder: 1,
      visibility: 'public',
    },
  ],
  createdAt: '2026-07-20T00:00:00Z',
  updatedAt: '2026-07-20T00:00:00Z',
};

describe('applyAssetDeletion', () => {
  it('removes one asset and applies a replacement cover', () => {
    const result = applyAssetDeletion([memory], {
      deletedAssetId: 'asset-a',
      deletedMemory: false,
      memoryId: 'memory-1',
      replacementCoverAssetId: 'asset-b',
    });

    expect(result[0]?.assets.map((asset) => asset.id)).toEqual(['asset-b']);
    expect(result[0]?.coverAssetId).toBe('asset-b');
  });

  it('removes the whole memory when the final asset deleted it', () => {
    const result = applyAssetDeletion([memory], {
      deletedAssetId: 'asset-a',
      deletedMemory: true,
      memoryId: 'memory-1',
      replacementCoverAssetId: null,
    });

    expect(result).toEqual([]);
  });
});