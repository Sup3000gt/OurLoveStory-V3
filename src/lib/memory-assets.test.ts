import { describe, expect, it } from 'vitest';
import type { Memory } from '../../shared/contracts';
import {
  adjacentImageAssetId,
  applyAssetDeletion,
  imageAssetsForLightbox,
} from './memory-assets';

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
      thumbnailUrl: '/api/assets/asset-a/thumbnail',
      previewUrl: '/api/assets/asset-a/preview',
      originalUrl: '/api/assets/asset-a/original',
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
      thumbnailUrl: '/api/assets/asset-b/thumbnail',
      previewUrl: '/api/assets/asset-b/preview',
      originalUrl: '/api/assets/asset-b/original',
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

it('preserves image-specific fields when deleting a video asset', () => {
  const withVideo: Memory = {
    ...memory,
    assets: [
      ...memory.assets,
      {
        id: 'video-1',
        type: 'video',
        url: '/video',
        downloadUrl: '/video/download',
        filename: 'video.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 10,
        sortOrder: 2,
        visibility: 'private',
      },
    ],
  };
  const result = applyAssetDeletion([withVideo], {
    deletedAssetId: 'video-1', deletedMemory: false, memoryId: 'memory-1', replacementCoverAssetId: null,
  });
  expect(result[0]?.assets[0]).toMatchObject({ thumbnailUrl: '/api/assets/asset-a/thumbnail', previewUrl: '/api/assets/asset-a/preview' });
});

describe('image lightbox helpers', () => {
  it('filters videos while preserving image union fields', () => {
    const withVideo: Memory = {
      ...memory,
      assets: [
        memory.assets[0]!,
        {
          id: 'video-1', type: 'video', url: '/video', downloadUrl: '/video-download', filename: 'clip.mp4',
          mimeType: 'video/mp4', sizeBytes: 10, sortOrder: 1, visibility: 'private',
        },
        memory.assets[1]!,
      ],
    };
    expect(imageAssetsForLightbox(withVideo).map((asset) => asset.id)).toEqual(['asset-a', 'asset-b']);
    expect(imageAssetsForLightbox(withVideo)[0]).toHaveProperty('previewUrl', '/api/assets/asset-a/preview');
  });

  it('moves previous and next only across image assets', () => {
    expect(adjacentImageAssetId(memory, 'asset-a', 1)).toBe('asset-b');
    expect(adjacentImageAssetId(memory, 'asset-b', -1)).toBe('asset-a');
    expect(adjacentImageAssetId(memory, 'missing', 1)).toBeNull();
  });
});
