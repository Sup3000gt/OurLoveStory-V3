import { describe, expect, it } from 'vitest';
import {
  normalizeGalleryFilterState,
  parseGallerySearch,
  toGallerySearch,
} from './gallery-filters';

describe('gallery filters', () => {
  it('serializes non-default filters in stable order', () => {
    expect(toGallerySearch({
      query: '韩餐',
      category: 'Dining Out',
      year: '2026',
      month: 5,
    })).toBe('?q=%E9%9F%A9%E9%A4%90&category=Dining+Out&year=2026&month=5');
  });

  it('clears month when year is cleared', () => {
    expect(normalizeGalleryFilterState({
      query: '',
      category: 'All',
      year: '',
      month: 5,
    })).toEqual({
      query: '',
      category: 'All',
      year: '',
      month: null,
    });
  });

  it('parses supported parameters through the shared normalizer', () => {
    expect(parseGallerySearch(
      '?cursor=ignored&year=2026&q=%20%ED%95%9C%EC%8B%9D%20&month=5&category=Dining+Out&page=2',
    )).toEqual({
      query: '한식',
      category: 'Dining Out',
      year: '2026',
      month: 5,
    });
  });

  it('falls back to safe defaults for malformed URL filters', () => {
    expect(parseGallerySearch(
      `?q=${'x'.repeat(81)}&category=not-a-category&year=20&month=99`,
    )).toEqual({
      query: '',
      category: 'All',
      year: '',
      month: null,
    });
  });

  it('omits default filters from the URL', () => {
    expect(toGallerySearch({
      query: '',
      category: 'All',
      year: '',
      month: null,
    })).toBe('');
  });
});
