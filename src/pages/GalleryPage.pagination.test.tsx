import { act } from 'react';
import { createRoot } from 'react-dom/client';
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
      </LanguageProvider>,
    ));

    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes('Next page'));

    act(() => button?.focus());

    expect(prefetchNextPage).toHaveBeenCalledOnce();
    expect(nextPage).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Page 1');
  });
});
