import { describe, expect, it } from 'vitest';
import { canViewMemory, formatMemoryDate } from './format';

describe('formatMemoryDate', () => {
  it('formats an ISO date without changing the day across time zones', () => {
    expect(formatMemoryDate('2024-06-02')).toBe('June 2, 2024');
  });
});

describe('canViewMemory', () => {
  it('lets guests view public memories', () => expect(canViewMemory('public', false)).toBe(true));
  it('hides private memories from guests', () => expect(canViewMemory('private', false)).toBe(false));
  it('lets signed-in owners view private memories', () => expect(canViewMemory('private', true)).toBe(true));
});
