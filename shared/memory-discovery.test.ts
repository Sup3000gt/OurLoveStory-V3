import { describe, expect, it } from 'vitest';
import {
  MemoryDiscoveryValidationError,
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

  it('preserves absent and empty optional filters as null', () => {
    expect(normalizeMemoryDiscoveryFilters({
      category: ' ',
      year: '',
      month: '  ',
    })).toEqual({
      query: null,
      category: null,
      year: null,
      month: null,
    });
  });

  it('rejects invalid category, year, and month values', () => {
    expect(() => normalizeMemoryDiscoveryFilters({ category: 'Unknown' }))
      .toThrow('Category must be a valid memory category.');
    expect(() => normalizeMemoryDiscoveryFilters({ year: '202' }))
      .toThrow('Year must use YYYY format.');
    expect(() => normalizeMemoryDiscoveryFilters({ year: '2026', month: 'May' }))
      .toThrow('Month must be an integer from 1 to 12.');
    expect(() => normalizeMemoryDiscoveryFilters({ year: '2026', month: '13' }))
      .toThrow('Month must be an integer from 1 to 12.');
  });

  it('rejects month without year and an overlong query', () => {
    expect(() => normalizeMemoryDiscoveryFilters({ month: '5' }))
      .toThrow('Month requires a year.');
    expect(() => normalizeMemoryDiscoveryFilters({ query: 'x'.repeat(81) }))
      .toThrow('Search query is too long.');
  });

  it('throws the discovery validation error type', () => {
    expect(() => normalizeMemoryDiscoveryFilters({ year: 'invalid' }))
      .toThrow(MemoryDiscoveryValidationError);
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
