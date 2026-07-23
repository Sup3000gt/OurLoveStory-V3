import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMemories } from './useMemories';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { useInfiniteQuery } = vi.hoisted(() => ({ useInfiniteQuery: vi.fn() }));

vi.mock('@clerk/react', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: undefined, getToken: vi.fn() }),
}));
vi.mock('@tanstack/react-query', () => ({ useInfiniteQuery }));
vi.mock('../lib/api', () => ({ getMemories: vi.fn() }));

describe('useMemories', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    useInfiniteQuery.mockReset();
  });

  it('keeps previous infinite-query data while a filtered request loads', () => {
    function Probe() {
      useMemories({ query: '韩餐' });
      return null;
    }

    useInfiniteQuery.mockReturnValue({});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(createElement(Probe)));

    const options = useInfiniteQuery.mock.calls[0][0];
    const previousData = { pages: [], pageParams: [] };
    expect(options.placeholderData(previousData, {
      queryKey: ['memories', {}, false, undefined],
    })).toBe(previousData);
  });

  it('does not reuse authenticated data after the user becomes a guest', () => {
    function Probe() {
      useMemories({ query: '韩餐' });
      return null;
    }

    useInfiniteQuery.mockReturnValue({});
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(createElement(Probe)));

    const options = useInfiniteQuery.mock.calls[0][0];
    const previousData = { pages: [], pageParams: [] };
    expect(options.placeholderData(previousData, {
      queryKey: ['memories', {}, true, 'owner-id'],
    })).toBeUndefined();
  });
});
