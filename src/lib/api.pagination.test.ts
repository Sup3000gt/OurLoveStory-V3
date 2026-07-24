import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMemory,
  getMemories,
  updateMemory,
} from './api';

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

  it('passes a category filter to the memory page endpoint', async () => {
    const page = {
      memories: [],
      nextCursor: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getMemories(undefined, { category: 'Travel', limit: 12 }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/memories?limit=12&category=Travel',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('passes query and date filters to the memory endpoint', async () => {
    const page = {
      memories: [],
      nextCursor: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(page), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getMemories(undefined, {
        query: '韩餐',
        year: '2026',
        month: 5,
        limit: 12,
      }),
    ).resolves.toEqual(page);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/memories?limit=12&q=%E9%9F%A9%E9%A4%90&year=2026&month=5',
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

  it('updates memory metadata through the owner endpoint', async () => {
    const updated = {
      id: 'memory/a',
      title: 'Updated',
    };
    const fetchMock = vi.fn(
      async (
        _input:
          RequestInfo | URL,
        _init?: RequestInit,
      ) =>
        new Response(
          JSON.stringify(updated),
          {
            status: 200,
            headers: {
              'content-type':
                'application/json',
            },
          },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      updateMemory(
        'memory/a',
        { title: 'Updated' },
        async () => 'owner-token',
      ),
    ).resolves.toEqual(updated);

    const [
      path,
      init,
    ] = fetchMock.mock.calls[0]!;
    expect(path).toBe(
      '/api/memories/memory%2Fa',
    );
    expect(init).toEqual(
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Updated',
        }),
        credentials:
          'same-origin',
      }),
    );
    expect(
      new Headers(
        init?.headers,
      ).get('authorization'),
    ).toBe('Bearer owner-token');
  });
});
