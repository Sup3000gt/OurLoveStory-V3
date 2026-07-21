import { describe, expect, it } from 'vitest';
import { calculateUploadStats } from './UploadStats';

describe('calculateUploadStats', () => {
  it('summarizes selected, uploaded, duplicate, public, and private photos', () => {
    expect(
      calculateUploadStats([
        {
          status: 'uploaded',
          targetVisibility: 'public',
        },
        {
          status: 'duplicate',
          targetVisibility: 'private',
        },
        {
          status: 'pending',
          targetVisibility: 'private',
        },
      ]),
    ).toEqual({
      selected: 3,
      uploaded: 1,
      duplicate: 1,
      publicCount: 1,
      privateCount: 1,
    });
  });
});