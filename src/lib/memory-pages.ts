import type { InfiniteData } from '@tanstack/react-query';
import type { Memory, MemoryPage } from '../../shared/contracts';

export function updateMemoryPages(
  current: InfiniteData<MemoryPage> | undefined,
  update: (memories: Memory[]) => Memory[],
): InfiniteData<MemoryPage> | undefined {
  if (!current) return current;

  return {
    ...current,
    pages: current.pages.map((page) => ({
      ...page,
      memories: update(page.memories),
    })),
  };
}
