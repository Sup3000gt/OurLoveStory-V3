import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseTimelineCoverInput } from './timeline-validation';

const migration = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../database/migrations/0004_timeline_covers.sql',
  ),
  'utf8',
);

describe('parseTimelineCoverInput', () => {
  it('accepts a year cover and preserves the period key', () => {
    expect(
      parseTimelineCoverInput({
        periodType: 'year',
        periodKey: '2026',
        assetId: 'asset-1',
      }),
    ).toEqual({
      periodType: 'year',
      periodKey: '2026',
      assetId: 'asset-1',
    });
  });

  it('accepts a month cover and preserves the period key', () => {
    expect(
      parseTimelineCoverInput({
        periodType: 'month',
        periodKey: '2026-07',
        assetId: 'asset-1',
      }),
    ).toEqual({
      periodType: 'month',
      periodKey: '2026-07',
      assetId: 'asset-1',
    });
  });

  it.each([
    ['malformed year', { periodType: 'year', periodKey: '26', assetId: 'asset-1' }],
    ['malformed month', { periodType: 'month', periodKey: '2026-7', assetId: 'asset-1' }],
    ['unsupported period type', { periodType: 'week', periodKey: '2026-W30', assetId: 'asset-1' }],
    ['empty asset id', { periodType: 'year', periodKey: '2026', assetId: '   ' }],
    ['month outside 01-12', { periodType: 'month', periodKey: '2026-13', assetId: 'asset-1' }],
  ])('rejects a %s', (_, input) => {
    expect(() => parseTimelineCoverInput(input)).toThrow();
  });
});

describe('timeline cover migration parity', () => {
  it('defines the timeline_covers table and unique period constraint', () => {
    expect(migration).toMatch(/CREATE TABLE timeline_covers/i);
    expect(migration).toMatch(/period_type\s*,\s*period_key/i);
    expect(migration).toMatch(/UNIQUE\s*\(\s*period_type\s*,\s*period_key\s*\)/i);
  });
});
