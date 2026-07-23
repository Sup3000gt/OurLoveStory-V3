import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import {
  normalizeGalleryFilterState,
  parseGallerySearch,
  toGallerySearch,
  type GalleryFilterState,
} from '../lib/gallery-filters';

export interface GalleryFiltersController {
  filters: GalleryFilterState;
  updateFilters(
    next: GalleryFilterState,
    options?: { replace?: boolean },
  ): void;
  clearFilters(): void;
}

export function useGalleryFilters(): GalleryFiltersController {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.toString();
  const filters = useMemo(
    () => parseGallerySearch(search),
    [search],
  );
  const canonicalSearch = toGallerySearch(filters);
  const canonicalParams = canonicalSearch.startsWith('?')
    ? canonicalSearch.slice(1)
    : canonicalSearch;

  useEffect(() => {
    if (location.pathname !== '/gallery' || search === canonicalParams) return;
    setSearchParams(canonicalSearch, { replace: true });
  }, [canonicalParams, canonicalSearch, location.pathname, search, setSearchParams]);

  const updateFilters = useCallback((
    next: GalleryFilterState,
    options?: { replace?: boolean },
  ) => {
    const normalized = normalizeGalleryFilterState(next);
    setSearchParams(toGallerySearch(normalized), {
      replace: options?.replace,
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams('', { replace: true });
  }, [setSearchParams]);

  return {
    filters,
    updateFilters,
    clearFilters,
  };
}
