import { describe, expect, it } from 'vitest';
import { hashFileBytes } from './photo-hash-core';

describe('hashFileBytes', () => {
  it('returns a SHA-256 hex digest', async () => {
    const file = new File(['hello'], 'hello.jpg');

    expect(await hashFileBytes(file)).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });

  it('returns the same digest for the same bytes', async () => {
    expect(
      await hashFileBytes(new File(['same'], 'first.jpg')),
    ).toBe(
      await hashFileBytes(new File(['same'], 'second.jpg')),
    );
  });
});