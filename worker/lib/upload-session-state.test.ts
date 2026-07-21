import { describe, expect, it } from 'vitest';
import {
  calculateSessionProgress,
  ensureMemoryCapacity,
  nextSessionStatus,
  planInitialSessionFiles,
  shouldSkipDuplicate,
} from './upload-session-state';

describe('calculateSessionProgress', () => {
  it('counts uploaded and skipped rows as processed', () => {
    expect(
      calculateSessionProgress(['uploaded', 'skipped', 'pending']),
    ).toEqual({
      completedFileCount: 2,
      acceptedFileCount: 1,
    });
  });
});

describe('nextSessionStatus', () => {
  it('enters review when every file is uploaded or skipped', () => {
    expect(nextSessionStatus(['uploaded', 'skipped'])).toBe('review');
  });

  it('remains uploading while a file is failed', () => {
    expect(nextSessionStatus(['uploaded', 'failed'])).toBe('uploading');
  });
});

describe('ensureMemoryCapacity', () => {
  it('allows the final one thousandth asset', () => {
    expect(() => ensureMemoryCapacity(950, 50)).not.toThrow();
  });

  it('rejects the one thousand and first asset', () => {
    expect(() => ensureMemoryCapacity(950, 51)).toThrow('1,000');
  });
});

describe('duplicate planning', () => {
  it('skips duplicates by default', () => {
    expect(shouldSkipDuplicate(true, false)).toBe(true);
    expect(shouldSkipDuplicate(true, true)).toBe(false);
  });

  it('skips an existing hash and later repeated hashes', () => {
    const planned = planInitialSessionFiles(
      [
        { contentHash: 'a' },
        { contentHash: 'b' },
        { contentHash: 'b' },
        { contentHash: 'c' },
      ],
      new Set(['a']),
    );

    expect(planned).toEqual([
      { status: 'skipped', duplicate: true },
      { status: 'pending', duplicate: false },
      { status: 'skipped', duplicate: true },
      { status: 'pending', duplicate: false },
    ]);
  });
});