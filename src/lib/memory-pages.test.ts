import { describe, expect, it } from 'vitest';
import type { MemoryPage } from '../../shared/contracts';
import { updateMemoryPages } from './memory-pages';

describe('updateMemoryPages', () => {
  it('updates memories inside every infinite-query page and preserves cursors', () => {
    const current = {
      pages: [
        { memories: [{ id: 'memory-1' }], nextCursor: 'cursor-1' },
        { memories: [{ id: 'memory-2' }], nextCursor: null },
      ] as MemoryPage[],
      pageParams: [null, 'cursor-1'],
    };

    const updated = updateMemoryPages(current, (memories) => [
      ...memories,
      { id: `count-${memories.length}` } as MemoryPage['memories'][number],
    ]);

    expect(updated).toEqual({
      pages: [
        { memories: [{ id: 'memory-1' }, { id: 'count-1' }], nextCursor: 'cursor-1' },
        { memories: [{ id: 'memory-2' }, { id: 'count-1' }], nextCursor: null },
      ],
      pageParams: [null, 'cursor-1'],
    });
  });
});
