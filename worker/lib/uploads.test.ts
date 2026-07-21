import { describe, expect, it } from 'vitest';
import { PRESIGNED_URL_TTL_SECONDS } from './uploads';

describe('R2 upload authorization', () => {
  it('keeps upload links valid for thirty minutes', () => {
    expect(PRESIGNED_URL_TTL_SECONDS).toBe(30 * 60);
  });
});