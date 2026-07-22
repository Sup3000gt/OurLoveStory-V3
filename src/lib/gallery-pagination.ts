import type { Memory, MemoryPage } from '../../shared/contracts';

export interface GalleryPageState {
  memories: Memory[];
  currentPage: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export function getGalleryPageState(
  pages: MemoryPage[] | undefined,
  requestedPageIndex: number,
  hasMoreFromServer: boolean,
): GalleryPageState {
  const loadedPages = pages ?? [];
  const lastPageIndex = Math.max(loadedPages.length - 1, 0);
  const pageIndex = Math.min(Math.max(requestedPageIndex, 0), lastPageIndex);

  return {
    memories: loadedPages[pageIndex]?.memories ?? [],
    currentPage: pageIndex + 1,
    totalPages: loadedPages.length,
    hasPreviousPage: pageIndex > 0,
    hasNextPage: pageIndex < lastPageIndex || hasMoreFromServer,
  };
}
