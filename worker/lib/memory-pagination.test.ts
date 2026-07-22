import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MEMORY_PAGE_SIZE,
  MAX_MEMORY_PAGE_SIZE,
  decodeMemoryCursor,
  encodeMemoryCursor,
  normalizeMemoryPageSize,
  type MemoryCursor,
} from './memory-pagination';

const cursor: MemoryCursor = {
  takenAt: '2026-07-22',
  createdAt: '2026-07-22T12:34:56.000Z',
  id: 'memory-123',
};

describe('memory pagination helpers', () => {
  it('round-trips a stable cursor without exposing raw JSON', () => {
    const encoded = encodeMemoryCursor(cursor);

    expect(encoded).not.toContain('memory-123');
    expect(decodeMemoryCursor(encoded)).toEqual(cursor);
  });

  it('rejects malformed cursors', () => {
    expect(decodeMemoryCursor('not-a-cursor')).toBeNull();
    expect(decodeMemoryCursor('')).toBeNull();
  });

  it('normalizes page sizes to the supported range', () => {
    expect(normalizeMemoryPageSize(null)).toBe(DEFAULT_MEMORY_PAGE_SIZE);
    expect(normalizeMemoryPageSize('0')).toBe(1);
    expect(normalizeMemoryPageSize('7')).toBe(7);
    expect(normalizeMemoryPageSize(String(MAX_MEMORY_PAGE_SIZE + 1))).toBe(MAX_MEMORY_PAGE_SIZE);
    expect(normalizeMemoryPageSize('invalid')).toBe(DEFAULT_MEMORY_PAGE_SIZE);
  });
});
