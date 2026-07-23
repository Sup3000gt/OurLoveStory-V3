import type { MemoryDiscoveryFilters } from '../../shared/memory-discovery';

export function escapeMemorySearchPattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function memorySearchPattern(query: string | null): string | null {
  return query ? `%${escapeMemorySearchPattern(query)}%` : null;
}

export function memoryDateRange(filters: MemoryDiscoveryFilters): {
  start: string | null;
  end: string | null;
} {
  if (!filters.year) return { start: null, end: null };

  const year = Number(filters.year);
  if (filters.month === null) {
    return {
      start: `${filters.year}-01-01`,
      end: `${year + 1}-01-01`,
    };
  }

  const start = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
  const nextMonth = filters.month === 12 ? 1 : filters.month + 1;
  const endYear = filters.month === 12 ? year + 1 : year;
  return {
    start,
    end: `${endYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}
