import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMemory } from './useMemory';
import { useMemoryFacets } from './useMemoryFacets';
import { useOwnerSession } from './useOwnerSession';
import { useUploadSession } from './useUploadSession';
import { useUploadSessions } from './useUploadSessions';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { auth, useQuery } = vi.hoisted(() => ({
  auth: vi.fn(),
  useQuery: vi.fn(),
}));

vi.mock('@clerk/react', () => ({ useAuth: auth }));
vi.mock('@tanstack/react-query', () => ({ useQuery }));
vi.mock('../lib/api', () => ({
  getMemory: vi.fn(),
  getMemoryFacets: vi.fn(),
  getOwnerSession: vi.fn(),
  getUploadSession: vi.fn(),
  listUploadSessions: vi.fn(),
}));

describe('owner query identity isolation', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    auth.mockReset();
    useQuery.mockReset();
  });

  it('includes the Clerk user identity in every owner-scoped query key', () => {
    let currentUserId = 'user-a';
    auth.mockImplementation(() => ({
      isLoaded: true,
      isSignedIn: true,
      userId: currentUserId,
      getToken: vi.fn(),
    }));
    useQuery.mockReturnValue({});

    function Probe() {
      useOwnerSession();
      useMemory('memory-a', undefined);
      useMemoryFacets();
      useUploadSessions(true);
      useUploadSession('session-a', true);
      return null;
    }

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(createElement(Probe)));

    expect(useQuery.mock.calls.map(([options]) => options.queryKey)).toEqual([
      ['owner-session', true, 'user-a'],
      ['memory', 'memory-a', true, 'user-a'],
      ['memory-facets', true, 'user-a'],
      ['upload-sessions', 'user-a'],
      ['upload-session', 'session-a', 'user-a'],
    ]);

    currentUserId = 'user-b';
    act(() => root?.render(createElement(Probe)));

    expect(useQuery.mock.calls.slice(-5).map(([options]) => options.queryKey)).toEqual([
      ['owner-session', true, 'user-b'],
      ['memory', 'memory-a', true, 'user-b'],
      ['memory-facets', true, 'user-b'],
      ['upload-sessions', 'user-b'],
      ['upload-session', 'session-a', 'user-b'],
    ]);
  });
});
