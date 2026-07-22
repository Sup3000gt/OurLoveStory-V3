import { describe, expect, it } from 'vitest';
import type { MemoryPage } from '../../shared/contracts';
import { getGalleryPageState } from './gallery-pagination';

describe('getGalleryPageState', () => {
  it('returns only the selected page instead of flattening earlier pages', () => {
    const pages: MemoryPage[] = [
      { memories: [{ id: 'page-1' } as MemoryPage['memories'][number]], nextCursor: 'cursor-2' },
      { memories: [{ id: 'page-2' } as MemoryPage['memories'][number]], nextCursor: null },
    ];

    expect(getGalleryPageState(pages, 1, false)).toEqual({
      memories: [{ id: 'page-2' }],
      currentPage: 2,
      totalPages: 2,
      hasPreviousPage: true,
      hasNextPage: false,
    });
  });
});
