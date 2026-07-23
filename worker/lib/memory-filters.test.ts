import { describe, expect, it } from 'vitest';
import {
  escapeMemorySearchPattern,
  memoryDateRange,
  memorySearchPattern,
} from './memory-filters';

describe('memory discovery filters', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeMemorySearchPattern('100% _ \\')).toBe('100\\% \\_ \\\\');
  });

  it('wraps a non-empty query for a parameterized LIKE search', () => {
    expect(memorySearchPattern('100% _ \\')).toBe('%100\\% \\_ \\\\%');
    expect(memorySearchPattern(null)).toBeNull();
  });

  it('builds inclusive year and exclusive month date ranges', () => {
    expect(memoryDateRange({ query: null, category: null, year: '2026', month: null })).toEqual({
      start: '2026-01-01',
      end: '2027-01-01',
    });
    expect(memoryDateRange({ query: null, category: null, year: '2026', month: 5 })).toEqual({
      start: '2026-05-01',
      end: '2026-06-01',
    });
  });
});
