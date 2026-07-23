// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../env';
import worker from '../index';

const context = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;
const env = {} as Env;

describe('memory discovery route validation', () => {
  it.each([
    ['invalid category', '/api/memories?category=Unknown', 'Category must be a valid memory category.'],
    ['invalid year', '/api/memories?year=202', 'Year must use YYYY format.'],
    ['malformed month', '/api/memories?year=2026&month=May', 'Month must be an integer from 1 to 12.'],
    ['out-of-range month', '/api/memories?year=2026&month=13', 'Month must be an integer from 1 to 12.'],
    ['overlong query', `/api/memories?q=${'x'.repeat(81)}`, 'Search query is too long.'],
    ['month without year', '/api/memories?month=5', 'Month requires a year.'],
  ])('returns 400 for %s', async (_, path, error) => {
    const response = await worker.fetch(
      new Request(`https://example.com${path}`),
      env,
      context,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error });
  });
});
