import { describe, expect, it, vi } from 'vitest';
import {
  OwnerSessionTokenPendingError,
  requireOwnerSessionToken,
} from './owner-session';

describe('requireOwnerSessionToken', () => {
  it('returns a Clerk token when it is ready', async () => {
    const getToken = vi.fn().mockResolvedValue('session-token');

    await expect(requireOwnerSessionToken(getToken)).resolves.toBe('session-token');
    expect(getToken).toHaveBeenCalledTimes(1);
  });

  it('rejects a temporary missing token instead of making a guest request', async () => {
    const getToken = vi.fn().mockResolvedValue(null);

    await expect(requireOwnerSessionToken(getToken)).rejects.toBeInstanceOf(
      OwnerSessionTokenPendingError,
    );
  });
});