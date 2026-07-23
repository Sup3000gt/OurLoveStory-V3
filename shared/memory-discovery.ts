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

export class MemoryDiscoveryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MemoryDiscoveryValidationError';
  }
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
  if (normalized === null && (value == null || typeof value === 'string')) {
    return null;
  }
  if (!normalized || !MEMORY_CATEGORIES.includes(normalized as MemoryCategory)) {
    throw new MemoryDiscoveryValidationError(
      'Category must be a valid memory category.',
    );
  }
  return normalized as MemoryCategory;
}

function normalizeYear(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (normalized === null && (value == null || typeof value === 'string')) {
    return null;
  }
  if (!normalized || !/^\d{4}$/.test(normalized)) {
    throw new MemoryDiscoveryValidationError('Year must use YYYY format.');
  }
  return normalized;
}

function normalizeMonth(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 1 && value <= 12) return value;
    throw new MemoryDiscoveryValidationError(
      'Month must be an integer from 1 to 12.',
    );
  }

  if (value == null || (typeof value === 'string' && !value.trim())) {
    return null;
  }

  if (typeof value !== 'string' || !/^\d{1,2}$/.test(value.trim())) {
    throw new MemoryDiscoveryValidationError(
      'Month must be an integer from 1 to 12.',
    );
  }

  const month = Number(value.trim());
  if (month < 1 || month > 12) {
    throw new MemoryDiscoveryValidationError(
      'Month must be an integer from 1 to 12.',
    );
  }
  return month;
}

export function normalizeMemoryDiscoveryFilters(input: {
  query?: unknown;
  category?: unknown;
  year?: unknown;
  month?: unknown;
}): MemoryDiscoveryFilters {
  const query = normalizeText(input.query);
  if (query && query.length > MAX_MEMORY_SEARCH_LENGTH) {
    throw new MemoryDiscoveryValidationError('Search query is too long.');
  }

  const year = normalizeYear(input.year);
  const month = normalizeMonth(input.month);
  if (month !== null && year === null) {
    throw new MemoryDiscoveryValidationError('Month requires a year.');
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
