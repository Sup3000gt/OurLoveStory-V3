import { describe, expect, it } from 'vitest';
import type { Memory } from '../../shared/contracts';
import { replaceAssetVisibility, summarizeAssetVisibility } from './memory-visibility';

const memory: Memory = {
  id: 'memory-1',
  title: 'A day together',
  location: 'New York',
  date: '2026-07-20',
  description: '',
  category: 'Daily Life',
  visibility: 'private',
  featured: false,
  status: 'published',
  coverAssetId: 'asset-1',
  createdAt: '2026-07-20',
  updatedAt: '2026-07-20',
  assets: [
    {
      id: 'asset-1',
      type: 'image',
      thumbnailUrl: '/asset-1/thumbnail',
      previewUrl: '/asset-1/preview',
      originalUrl: '/asset-1/original',
      filename: 'one.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: null,
      height: null,
      sortOrder: 0,
      visibility: 'private',
    },
    {
      id: 'asset-2',
      type: 'image',
      thumbnailUrl: '/asset-2/thumbnail',
      previewUrl: '/asset-2/preview',
      originalUrl: '/asset-2/original',
      filename: 'two.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 100,
      width: null,
      height: null,
      sortOrder: 1,
      visibility: 'public',
    },
  ],
};

describe('summarizeAssetVisibility', () => {
  it('counts public and private assets independently', () => {
    expect(summarizeAssetVisibility(memory.assets)).toEqual({
      publicCount: 1,
      privateCount: 1,
    });
  });
});

describe('replaceAssetVisibility', () => {
  it('updates only the requested asset without mutating the source', () => {
    const updated = replaceAssetVisibility([memory], 'asset-1', 'public');
    expect(updated[0]?.assets[0]?.visibility).toBe('public');
    expect(updated[0]?.assets[1]?.visibility).toBe('public');
    expect(memory.assets[0]?.visibility).toBe('private');
  });
});
