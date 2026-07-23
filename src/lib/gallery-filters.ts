import { MEMORY_CATEGORIES, type Memory } from '../../shared/contracts';
import {
  MAX_MEMORY_SEARCH_LENGTH,
  normalizeMemoryDiscoveryFilters,
} from '../../shared/memory-discovery';

export interface GalleryFilterState {
  query: string;
  category: 'All' | Memory['category'];
  year: string;
  month: number | null;
}

export const emptyGalleryFilterState: GalleryFilterState = {
  query: '',
  category: 'All',
  year: '',
  month: null,
};

function toGalleryFilterState(input: {
  query?: unknown;
  category?: unknown;
  year?: unknown;
  month?: unknown;
}): GalleryFilterState {
  const hasYear = typeof input.year === 'string' && input.year.trim() !== '';
  const normalized = normalizeMemoryDiscoveryFilters({
    query: input.query,
    category: input.category === 'All' ? null : input.category,
    year: input.year,
    month: hasYear ? input.month : null,
  });

  return {
    query: normalized.query ?? '',
    category: normalized.category ?? 'All',
    year: normalized.year ?? '',
    month: normalized.month,
  };
}

function sanitizeGallerySearchInput(input: {
  query: string | null;
  category: string | null;
  year: string | null;
  month: string | null;
}) {
  const query = input.query?.trim().replace(/\s+/g, ' ') ?? null;
  const safeQuery = query && query.length <= MAX_MEMORY_SEARCH_LENGTH ? query : null;
  const categoryValue = input.category?.trim() ?? null;
  const category = categoryValue === 'All'
    || (categoryValue !== null && MEMORY_CATEGORIES.includes(categoryValue as Memory['category']))
    ? categoryValue
    : null;
  const year = input.year && /^\d{4}$/.test(input.year.trim())
    ? input.year.trim()
    : null;
  const month = year && input.month && /^\d{1,2}$/.test(input.month.trim())
    && Number(input.month) >= 1 && Number(input.month) <= 12
    ? input.month.trim()
    : null;

  return { query: safeQuery, category, year, month };
}

export function parseGallerySearch(search: string): GalleryFilterState {
  const params = new URLSearchParams(search);
  return toGalleryFilterState(sanitizeGallerySearchInput({
    query: params.get('q'),
    category: params.get('category'),
    year: params.get('year'),
    month: params.get('month'),
  }));
}

export function normalizeGalleryFilterState(
  state: Partial<GalleryFilterState>,
): GalleryFilterState {
  return toGalleryFilterState({
    query: state.query ?? emptyGalleryFilterState.query,
    category: state.category ?? emptyGalleryFilterState.category,
    year: state.year ?? emptyGalleryFilterState.year,
    month: state.month ?? emptyGalleryFilterState.month,
  });
}

export function toGallerySearch(state: GalleryFilterState): string {
  const normalized = normalizeGalleryFilterState(state);
  const params = new URLSearchParams();

  if (normalized.query) params.set('q', normalized.query);
  if (normalized.category !== 'All') params.set('category', normalized.category);
  if (normalized.year) params.set('year', normalized.year);
  if (normalized.month !== null) params.set('month', String(normalized.month));

  const search = params.toString();
  return search ? `?${search}` : '';
}

export function hasActiveGalleryFilters(state: GalleryFilterState): boolean {
  return toGallerySearch(state) !== '';
}
