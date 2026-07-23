import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
} from './contracts';

export const MAX_MEMORY_SEARCH_LENGTH = 80;

export interface MemoryDiscoveryFilters {
  query: string | null;
  category: MemoryCategory | null;
  year: string | null;
  month: number | null;
}

export interface MemoryFacets {
  years: Array<{ year: number; months: number[] }>;
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, ' ');
  return normalized || null;
}

function normalizeCategory(value: unknown): MemoryCategory | null {
  const normalized = normalizeText(value);
  return normalized && MEMORY_CATEGORIES.includes(normalized as MemoryCategory)
    ? normalized as MemoryCategory
    : null;
}

function normalizeYear(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized && /^\d{4}$/.test(normalized) ? normalized : null;
}

function normalizeMonth(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value >= 1 && value <= 12 ? value : null;
  }

  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value.trim())) {
    return null;
  }

  const month = Number(value.trim());
  return month >= 1 && month <= 12 ? month : null;
}

export function normalizeMemoryDiscoveryFilters(input: {
  query?: unknown;
  category?: unknown;
  year?: unknown;
  month?: unknown;
}): MemoryDiscoveryFilters {
  const query = normalizeText(input.query);
  if (query && query.length > MAX_MEMORY_SEARCH_LENGTH) {
    throw new Error('Search query is too long.');
  }

  const year = normalizeYear(input.year);
  const month = normalizeMonth(input.month);
  if (month !== null && year === null) {
    throw new Error('Month requires a year.');
  }

  return {
    query,
    category: normalizeCategory(input.category),
    year,
    month,
  };
}

export function parseMemoryDiscoveryFilters(
  params: URLSearchParams,
): MemoryDiscoveryFilters {
  return normalizeMemoryDiscoveryFilters({
    query: params.get('q'),
    category: params.get('category'),
    year: params.get('year'),
    month: params.get('month'),
  });
}
