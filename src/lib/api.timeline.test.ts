import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearTimelineCover,
  getTimeline,
  setTimelineCover,
} from './api';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('timeline API', () => {
  it('gets the public timeline with same-origin credentials', async () => {
    const timeline = { years: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(timeline), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getTimeline()).resolves.toEqual(timeline);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/timeline',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('sets a cover with an owner bearer token', async () => {
    const input = {
      periodType: 'month' as const,
      periodKey: '2026-07',
      assetId: 'asset-1',
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(input), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(setTimelineCover(input, async () => 'owner-token'))
      .resolves.toEqual(input);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/timeline/covers',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(input),
        credentials: 'same-origin',
        headers: expect.objectContaining({
          get: expect.any(Function),
        }),
      }),
    );
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = new Headers(request.headers);
    expect(headers.get('content-type')).toBe('application/json');
    expect(headers.get('authorization')).toBe('Bearer owner-token');
  });

  it('clears an encoded period cover with DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(clearTimelineCover(
      'month',
      '2026/July & August',
      async () => 'owner-token',
    )).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/timeline/covers?periodType=month&periodKey=2026%2FJuly+%26+August',
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'same-origin',
      }),
    );
  });
});
