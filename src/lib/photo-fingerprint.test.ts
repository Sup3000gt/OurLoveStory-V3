import { describe, expect, it } from 'vitest';
import {
  assignOccurrenceIndexes,
  fingerprintPhoto,
} from './photo-fingerprint';

describe('fingerprintPhoto', () => {
  it('is stable for matching metadata and bytes', async () => {
    const first = new File(['same'], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 123,
    });
    const second = new File(['same'], 'a.jpg', {
      type: 'image/jpeg',
      lastModified: 123,
    });

    expect(await fingerprintPhoto(first)).toBe(
      await fingerprintPhoto(second),
    );
  });

  it('changes when the file bytes change', async () => {
    const first = new File(['left'], 'a.jpg', {
      lastModified: 123,
    });
    const second = new File(['right'], 'a.jpg', {
      lastModified: 123,
    });

    expect(await fingerprintPhoto(first)).not.toBe(
      await fingerprintPhoto(second),
    );
  });
});

describe('assignOccurrenceIndexes', () => {
  it('assigns a stable index to repeated fingerprints', () => {
    expect(
      assignOccurrenceIndexes(['a', 'a', 'b', 'a']),
    ).toEqual([0, 1, 0, 2]);
  });
});