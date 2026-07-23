import { describe, expect, it } from 'vitest';
import {
  normalizeMemoryDiscoveryFilters,
  parseMemoryDiscoveryFilters,
} from './memory-discovery';

describe('memory discovery filters', () => {
  it('normalizes query, category, year, and month', () => {
    expect(normalizeMemoryDiscoveryFilters({
      query: '  韩餐   ',
      category: 'Dining Out',
      year: '2026',
      month: '5',
    })).toEqual({
      query: '韩餐',
      category: 'Dining Out',
      year: '2026',
      month: 5,
    });
  });

  it('rejects month without year and an overlong query', () => {
    expect(() => normalizeMemoryDiscoveryFilters({ month: '5' }))
      .toThrow('Month requires a year.');
    expect(() => normalizeMemoryDiscoveryFilters({ query: 'x'.repeat(81) }))
      .toThrow('Search query is too long.');
  });

  it('parses URLSearchParams into the typed filter object', () => {
    expect(parseMemoryDiscoveryFilters(
      new URLSearchParams('q=%E9%9F%A9%E9%A4%90&category=Dining%20Out&year=2026&month=5'),
    )).toEqual({
      query: '韩餐',
      category: 'Dining Out',
      year: '2026',
      month: 5,
    });
  });
});
