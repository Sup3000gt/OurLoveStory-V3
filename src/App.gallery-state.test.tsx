import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/Header', () => ({
  Header: () => null,
}));

vi.mock('./contexts/PhotoSessionUploadContext', () => ({
  PhotoSessionUploadProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('./hooks/useMemories', () => ({
  useMemories: () => ({
    data: { pages: [{ memories: [], nextCursor: null, totalCount: 0 }] },
    isLoading: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    fetchStatus: 'idle',
    fetchNextPage: vi.fn(),
  }),
}));

vi.mock('./hooks/useOwnerSession', () => ({
  useOwnerSession: () => ({ data: { isOwner: false, displayName: null } }),
}));

vi.mock('./hooks/useMemoryFacets', () => ({
  useMemoryFacets: () => ({ data: { years: [] } }),
}));

vi.mock('./pages/GalleryPage', () => ({
  GalleryPage: ({
    onFiltersChange,
    onPrefetchNextPage,
  }: {
    onFiltersChange: (next: { category: 'Travel' }) => void;
    onPrefetchNextPage: () => void;
  }) => (
    <>
      <button type="button" onClick={() => onFiltersChange({ category: 'Travel' })}>Filter Travel</button>
      <button type="button" onClick={onPrefetchNextPage}>Prefetch next</button>
    </>
  ),
}));

describe('App gallery URL state', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    window.history.replaceState({}, '', '/');
  });

  it('replaces legacy pagination parameters when gallery filters change', () => {
    window.history.replaceState({}, '', '/gallery?cursor=old&page=3');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<App />));

    const button = container.querySelector('button');
    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(window.location.search).toBe('?category=Travel');
  });

  it('rewrites malformed and legacy gallery parameters on first render', () => {
    window.history.replaceState({}, '', '/gallery?year=bad&month=5&cursor=old&page=2');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<App />));

    expect(window.location.search).toBe('');
  });

  it('cancels a pending gallery prefetch when filters change', () => {
    window.history.replaceState({}, '', '/gallery');
    const requestIdleCallback = vi.fn((_run: () => void) => 11);
    const cancelIdleCallback = vi.fn();
    Object.assign(window, { requestIdleCallback, cancelIdleCallback });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(<App />));
    const buttons = container.querySelectorAll('button');
    act(() => buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    act(() => buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(cancelIdleCallback).toHaveBeenCalledWith(11);
  });
});
