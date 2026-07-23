import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../i18n/LanguageProvider';
import { emptyGalleryFilterState } from '../lib/gallery-filters';
import { GalleryPage } from './GalleryPage';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('GalleryPage pagination', () => {
  let root: ReturnType<typeof createRoot> | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('places desktop filters beside the gallery results', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GalleryPage
          memories={[]}
          isLoading={false}
          error={null}
          isOwner={false}
          filters={emptyGalleryFilterState}
          facets={undefined}
          totalCount={0}
          currentPage={1}
          totalPages={0}
          hasPreviousPage={false}
          hasNextPage={false}
          isFetchingPage={false}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          onFiltersChange={vi.fn()}
          onClearFilters={vi.fn()}
          onPrefetchNextPage={vi.fn()}
        />
      </LanguageProvider>,
    ));

    expect(container.querySelector('.gallery-layout')).not.toBeNull();
    expect(container.querySelector('.gallery-discovery-sidebar')).not.toBeNull();
    expect(container.querySelector('.gallery-results-column')).not.toBeNull();
  });

  it('shows page navigation instead of appending a Load more list', () => {
    const previousPage = vi.fn();
    const nextPage = vi.fn();
    const prefetchNextPage = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <GalleryPage
          memories={[]}
          isLoading={false}
          error={null}
          isOwner={false}
          filters={emptyGalleryFilterState}
          facets={undefined}
          totalCount={0}
          currentPage={1}
          totalPages={2}
          hasPreviousPage={false}
          hasNextPage
          isFetchingPage={false}
          onPreviousPage={previousPage}
          onNextPage={nextPage}
          onFiltersChange={vi.fn()}
          onClearFilters={vi.fn()}
          onPrefetchNextPage={prefetchNextPage}
        />
      </LanguageProvider>,
    ));

    expect(container.textContent).toContain('Page 1');
    expect(container.textContent).not.toContain('Load more');

    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Next page'));
    expect(button).toBeTruthy();

    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(nextPage).toHaveBeenCalledOnce();
    expect(previousPage).not.toHaveBeenCalled();

    act(() => button?.focus());
    expect(prefetchNextPage).toHaveBeenCalledOnce();
  });

  it('keeps the visible page unchanged when it prefetches the next page', () => {
    const nextPage = vi.fn();
    const prefetchNextPage = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <MemoryRouter>
          <GalleryPage
          memories={[]}
          isLoading={false}
          error={null}
          isOwner={false}
          filters={emptyGalleryFilterState}
          facets={undefined}
          totalCount={0}
          currentPage={1}
          totalPages={2}
          hasPreviousPage={false}
          hasNextPage
          isFetchingPage={false}
          onPreviousPage={vi.fn()}
          onNextPage={nextPage}
          onFiltersChange={vi.fn()}
          onClearFilters={vi.fn()}
          onPrefetchNextPage={prefetchNextPage}
          />
        </MemoryRouter>
      </LanguageProvider>,
    ));

    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Next page'));

    act(() => button?.focus());

    expect(prefetchNextPage).toHaveBeenCalledOnce();
    expect(nextPage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Page 1');
  });

  it('keeps the existing grid visible with a retry action while refreshing', () => {
    const retry = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <MemoryRouter>
          <GalleryPage
          memories={[{
            id: 'memory-1',
            title: 'A memory',
            location: 'Home',
            date: '2026-05-01',
            description: '',
            category: 'Daily Life',
            visibility: 'public',
            featured: false,
            status: 'published',
            coverAssetId: 'asset-1',
            assets: [{
              id: 'asset-1',
              type: 'image',
              thumbnailUrl: '/thumb',
              previewUrl: '/preview',
              originalUrl: null,
              filename: 'memory.jpg',
              mimeType: 'image/jpeg',
              sizeBytes: 1,
              width: 1200,
              height: 800,
              sortOrder: 0,
              visibility: 'public',
            }],
            createdAt: '',
            updatedAt: '',
          }]}
          isLoading={false}
          isFetching
          error={new Error('network')}
          isOwner={false}
          filters={emptyGalleryFilterState}
          facets={undefined}
          totalCount={1}
          currentPage={1}
          totalPages={1}
          hasPreviousPage={false}
          hasNextPage={false}
          isFetchingPage={false}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          onFiltersChange={vi.fn()}
          onClearFilters={vi.fn()}
          onPrefetchNextPage={vi.fn()}
          onRetry={retry}
          />
        </MemoryRouter>
      </LanguageProvider>,
    ));

    expect(container.querySelector('.memory-card')).not.toBeNull();
    const retryButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Try again'));
    expect(retryButton).toBeTruthy();
    act(() => retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('marks debounced search updates as history replacements', async () => {
    const onFiltersChange = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => root?.render(
      <LanguageProvider>
        <MemoryRouter>
          <GalleryPage
          memories={[]}
          isLoading={false}
          isFetching={false}
          error={null}
          isOwner={false}
          filters={emptyGalleryFilterState}
          facets={undefined}
          totalCount={0}
          currentPage={1}
          totalPages={0}
          hasPreviousPage={false}
          hasNextPage={false}
          isFetchingPage={false}
          onPreviousPage={vi.fn()}
          onNextPage={vi.fn()}
          onFiltersChange={onFiltersChange}
          onClearFilters={vi.fn()}
          onPrefetchNextPage={vi.fn()}
          onRetry={vi.fn()}
          />
        </MemoryRouter>
      </LanguageProvider>,
    ));

    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    act(() => {
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      setValue?.call(input, '韩餐');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    });

    expect(onFiltersChange).toHaveBeenLastCalledWith(
      { ...emptyGalleryFilterState, query: '韩餐' },
      { replace: true },
    );
  });
});
