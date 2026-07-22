import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMemory, getMemories } from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getMemories pagination', () => {
  it('requests the next cursor and returns the server page envelope', async () => {
    const page = {
      memories: [],
      nextCursor: 'next-page',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getMemories(undefined, { cursor: 'next-page', limit: 12 }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/memories?limit=12&cursor=next-page',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('can load a memory directly when it is not in the current page', async () => {
    const memory = { id: 'memory/a' };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(memory), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getMemory('memory/a')).resolves.toEqual(memory);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/memories/memory%2Fa',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });
});
