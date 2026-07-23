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
    hasNextPage: false,
    isFetchingNextPage: false,
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
  GalleryPage: ({ onFiltersChange }: { onFiltersChange: (next: { category: 'Travel' }) => void }) => (
    <button type="button" onClick={() => onFiltersChange({ category: 'Travel' })}>Filter Travel</button>
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
});
